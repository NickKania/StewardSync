import { Component, inject, OnInit, OnDestroy, signal, computed, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ConvexService } from '@core/services/convex.service';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { CardComponent } from '@shared/components/card/card.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { LoadingComponent } from '@shared/components/loading/loading.component';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import { DateFormatPipe, TimeAgoPipe } from '@shared/pipes/date-format.pipe';
import { Penalty } from '@core/models/series.model';

@Component({
  selector: 'app-finalize-form',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    FormsModule,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    LoadingComponent,
    ModalComponent,
    ToggleComponent,
    DateFormatPipe,
    TimeAgoPipe
  ],
  template: `
    <div class="space-y-6">
      @if (loading()) {
        <app-loading text="Loading report..." />
      } @else if (report()) {
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Finalize Report</h1>
            <p class="text-gray-500 mt-1">
              {{ report()?.event?.trackName }} - Race {{ report()?.race?.raceNumber }}
            </p>
          </div>
          <a [routerLink]="['/reports', report()?._id]">
            <app-button variant="secondary">View Full Report</app-button>
          </a>
        </div>

        <div class="grid lg:grid-cols-3 gap-6">
          <!-- Finalization form -->
          <div class="lg:col-span-2">
            <form [formGroup]="form" (ngSubmit)="onSubmit()">
              <app-card title="Finalize Report">
                <div class="space-y-4">
                  <!-- Incident description -->
                  <div>
                    <label class="label">Incident Description *</label>
                    <textarea
                      formControlName="incidentDescription"
                      class="input min-h-[100px]"
                      [class.input-error]="form.get('incidentDescription')?.invalid && form.get('incidentDescription')?.touched"
                      placeholder="Describe the incident as observed in the steward review..."
                      rows="4"
                    ></textarea>
                    <p class="text-xs text-gray-500 mt-1">You can modify the incident description if needed</p>
                    @if (form.get('incidentDescription')?.invalid && form.get('incidentDescription')?.touched) {
                      <p class="mt-1 text-sm text-red-600">Incident description is required</p>
                    }
                  </div>

                  <!-- Applied penalty -->
                  <div>
                    <label class="label">Applied Penalty *</label>
                    <select
                      formControlName="appliedPenalty"
                      class="input"
                      [class.input-error]="form.get('appliedPenalty')?.invalid && form.get('appliedPenalty')?.touched"
                    >
                      <option value="">Select penalty</option>
                      @for (penalty of availablePenalties(); track penalty._id) {
                        <option [value]="penalty._id">
                          {{ penalty.name }}
                        </option>
                      }
                    </select>
                    @if (form.get('appliedPenalty')?.invalid && form.get('appliedPenalty')?.touched) {
                      <p class="mt-1 text-sm text-red-600">Penalty selection is required</p>
                    }
                    @if (availablePenalties().length === 0) {
                      <p class="mt-1 text-sm text-yellow-600">No penalties configured for this series. Please configure penalties first.</p>
                    }
                  </div>

                  <!-- Self report toggle -->
                  <div>
                    <app-toggle
                      formControlName="isSelfReport"
                      label="Self Report"
                      hint="Mark if this is a self-reported incident"
                    />
                  </div>

                  <!-- Official notes -->
                  <div>
                    <label class="label">Official Notes</label>
                    <textarea
                      formControlName="officialNotes"
                      class="input min-h-[100px]"
                      placeholder="Additional notes for the official record..."
                      rows="4"
                    ></textarea>
                  </div>
                </div>

                <!-- Footer -->
                <div card-footer class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between gap-3">
                  <app-button
                    type="button"
                    variant="danger"
                    (onClick)="showRejectModal = true"
                  >
                    Reject Report
                  </app-button>
                  <div class="flex gap-3">
                    <app-button
                      type="button"
                      variant="secondary"
                      (onClick)="cancel()"
                    >
                      Cancel
                    </app-button>
                    <app-button
                      type="submit"
                      variant="success"
                      [loading]="submitting()"
                      [disabled]="form.invalid"
                    >
                      Finalize Report
                    </app-button>
                  </div>
                </div>
              </app-card>
            </form>

            <!-- Steward reviews summary -->
            @if (reviews().length > 0) {
              <app-card title="Steward Reviews" class="mt-6">
                <div class="space-y-4">
                  @for (review of reviews(); track review._id) {
                    <div class="p-4 bg-gray-50 rounded-lg">
                      <div class="flex items-start justify-between mb-3">
                        <div>
                          @if (review.linkedReview) {
                            <div class="flex items-center gap-2">
                              <app-badge variant="success" size="sm">Joint Review</app-badge>
                              <p class="font-medium text-gray-900">{{ review.reviewer?.name }} & {{ review.linkedReview.reviewer?.name }}</p>
                            </div>
                          } @else {
                            <p class="font-medium text-gray-900">{{ review.reviewer?.name }}</p>
                          }
                          <p class="text-sm text-gray-500">{{ review.reviewDate | timeAgo }}</p>
                        </div>
                        @if (review.recommendedPenaltyObj) {
                          <app-badge variant="info">
                            Recommends: {{ review.recommendedPenaltyObj.name }}
                          </app-badge>
                        }
                      </div>
                      <p class="text-gray-700 text-sm whitespace-pre-wrap">{{ review.reviewNotes }}</p>
                    </div>
                  }
                </div>
              </app-card>
            }
          </div>

          <!-- Sidebar with report details -->
          <div class="space-y-6">
            <app-card title="Incident Summary">
              <dl class="space-y-4">
                <div>
                  <dt class="text-sm text-gray-500">Reported Driver</dt>
                  <dd class="font-medium text-gray-900">{{ report()?.reportedDriver?.driverName }}</dd>
                  <dd class="text-sm text-gray-500">#{{ report()?.reportedDriver?.driverNumber }}</dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500">Reporting Driver</dt>
                  <dd class="font-medium text-gray-900">{{ report()?.reportingDriver?.driverName }}</dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500">Location</dt>
                  <dd class="font-medium text-gray-900">Turn {{ report()?.turn }}</dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500">Reviews</dt>
                  <dd class="font-medium text-gray-900">{{ report()?.reviews?.length || 0 }} review(s)</dd>
                </div>
              </dl>
            </app-card>

            <app-card title="Original Description">
              <p class="text-gray-700 text-sm whitespace-pre-wrap">{{ report()?.description }}</p>
            </app-card>

            <!-- Penalty recommendations summary -->
            @if (penaltyRecommendations().length > 0) {
              <app-card title="Penalty Recommendations">
                <div class="space-y-2">
                  @for (rec of penaltyRecommendations(); track rec.penaltyId) {
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-gray-700">{{ rec.penaltyName }}</span>
                      <app-badge variant="default">{{ rec.count }}</app-badge>
                    </div>
                  }
                </div>
              </app-card>
            }
          </div>
        </div>
      } @else {
        <app-card>
          <div class="text-center py-12">
            <p class="text-gray-500">Report not found</p>
            <a routerLink="/finalize" class="mt-4 inline-block">
              <app-button variant="primary">Back to Finalization</app-button>
            </a>
          </div>
        </app-card>
      }
    </div>

    <!-- Reject confirmation modal -->
    <app-modal
      [isOpen]="showRejectModal"
      title="Reject Report"
      (close)="showRejectModal = false"
    >
      <p class="text-gray-600 mb-4">
        Are you sure you want to reject this report? This action cannot be undone.
      </p>
      <div>
        <label class="label">Rejection Reason</label>
        <textarea
          [(ngModel)]="rejectionReason"
          class="input min-h-[80px]"
          placeholder="Explain why this report is being rejected..."
          rows="3"
        ></textarea>
      </div>
      <div modal-footer class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
        <app-button variant="secondary" (onClick)="showRejectModal = false">
          Cancel
        </app-button>
        <app-button
          variant="danger"
          [loading]="submitting()"
          [disabled]="!rejectionReason"
          (onClick)="rejectReport()"
        >
          Reject Report
        </app-button>
      </div>
    </app-modal>
  `
})
export class FinalizeFormComponent implements OnInit, OnDestroy {
  @Input() reportId!: string;

  private fb = inject(FormBuilder);
  private convex = inject(ConvexService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  form: FormGroup;
  report = signal<any>(null);
  availablePenalties = signal<Penalty[]>([]);
  loading = signal(true);
  submitting = signal(false);

  showRejectModal = false;
  rejectionReason = '';

  reviews = computed(() => {
    const allReviews = this.report()?.reviews || [];
    const seen = new Set<string>();
    const result: any[] = [];

    for (const review of allReviews) {
      const id = String(review._id);

      if (seen.has(id)) continue;

      if (review.linkedReviewId) {
        seen.add(id);
        const linkedId = String(review.linkedReviewId);
        seen.add(linkedId);
      }

      result.push(review);
    }

    return result;
  });

  private unsubscribes: (() => void)[] = [];

  constructor() {
    this.form = this.fb.group({
      incidentDescription: ['', [Validators.required, Validators.minLength(10)]],
      appliedPenalty: ['', Validators.required],
      officialNotes: [''],
      isSelfReport: [false]
    });
  }

  ngOnInit(): void {
    this.loadReport();
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach(unsub => unsub());
  }

  private loadReport(): void {
    if (!this.reportId) {
      this.loading.set(false);
      return;
    }

    const reportQuery = this.convex.createReactiveQuery(
      this.convex.api.reports.getById,
      { reportId: this.reportId as any }
    );
    this.unsubscribes.push(reportQuery.unsubscribe);

    const checkReport = setInterval(() => {
      const data = reportQuery.data();
      if (data !== undefined) {
        this.report.set(data);
        this.loading.set(false);

        // Auto-fill incident description and isSelfReport from latest review
        if (data?.reviews && data.reviews.length > 0) {
          const latestReview = data.reviews.reduce((latest, current) => {
            const latestDate = latest.reviewDate || latest.createdAt || 0;
            const currentDate = current.reviewDate || current.createdAt || 0;
            return currentDate > latestDate ? current : latest;
          });

          const incidentControl = this.form.get('incidentDescription');
          const selfReportControl = this.form.get('isSelfReport');

          if (latestReview?.incidentDescription && incidentControl) {
            const currentValue = incidentControl.value;
            const newValue = latestReview.incidentDescription;

            if (incidentControl.pristine && currentValue !== newValue) {
              incidentControl.setValue(newValue);
            }
          }

          if (latestReview?.isSelfReport !== undefined && selfReportControl) {
            const currentValue = selfReportControl.value;
            const newValue = latestReview.isSelfReport;

            if (selfReportControl.pristine && currentValue !== newValue) {
              selfReportControl.setValue(newValue);
            }
          }

          // Pre-select applied penalty from latest review's recommended penalty
          if (latestReview?.recommendedPenaltyObj && this.availablePenalties().length > 0) {
            const appliedPenaltyControl = this.form.get('appliedPenalty');
            if (appliedPenaltyControl) {
              const recommendedPenaltyId = latestReview.recommendedPenaltyObj._id;
              const currentValue = appliedPenaltyControl.value;

              if (appliedPenaltyControl.pristine && currentValue !== recommendedPenaltyId) {
                appliedPenaltyControl.setValue(recommendedPenaltyId);
              }
            }
          }
        }

        // Load penalties for this series
        if (data?.event?.seriesId) {
          this.loadPenalties(data.event.seriesId);
        }
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkReport));
  }

  private loadPenalties(seriesId: string): void {
    const penaltiesQuery = this.convex.createReactiveQuery(
      this.convex.api.penalties.getBySeries,
      { seriesId: seriesId as any }
    );
    this.unsubscribes.push(penaltiesQuery.unsubscribe);

    const checkPenalties = setInterval(() => {
      const data = penaltiesQuery.data();
      if (data !== undefined) {
        this.availablePenalties.set(data);

        // Pre-select applied penalty from latest review when penalties are loaded
        const report = this.report();
        if (report?.reviews && report.reviews.length > 0) {
          const latestReview = report.reviews.reduce((latest: any, current: any) => {
            const latestDate = latest.reviewDate || latest.createdAt || 0;
            const currentDate = current.reviewDate || current.createdAt || 0;
            return currentDate > latestDate ? current : latest;
          });

          if (latestReview?.recommendedPenaltyObj && data.length > 0) {
            const appliedPenaltyControl = this.form.get('appliedPenalty');
            if (appliedPenaltyControl) {
              const recommendedPenaltyId = latestReview.recommendedPenaltyObj._id;
              const currentValue = appliedPenaltyControl.value;

              if (appliedPenaltyControl.pristine && currentValue !== recommendedPenaltyId) {
                appliedPenaltyControl.setValue(recommendedPenaltyId);
              }
            }
          }
        }
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkPenalties));
  }

  penaltyRecommendations(): { penaltyId: string; penaltyName: string; count: number }[] {
    const reviews = this.report()?.reviews || [];
    const counts: Record<string, { name: string; count: number }> = {};

    reviews.forEach((r: any) => {
      if (r.recommendedPenaltyObj) {
        const penaltyId = r.recommendedPenaltyObj._id;
        if (counts[penaltyId]) {
          counts[penaltyId].count++;
        } else {
          counts[penaltyId] = {
            name: r.recommendedPenaltyObj.name,
            count: 1
          };
        }
      }
    });

    return Object.entries(counts)
      .map(([penaltyId, data]) => ({
        penaltyId,
        penaltyName: data.name,
        count: data.count
      }))
      .sort((a, b) => b.count - a.count);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);

    try {
      const userId = this.authService.getUserId();
      if (!userId) {
        throw new Error('Not authenticated');
      }

      const formValue = this.form.value;

      await this.convex.mutation(
        this.convex.api.reports.finalize,
        {
          reportId: this.reportId as any,
          userId,
          finalDecision: formValue.incidentDescription,
          appliedPenalty: formValue.appliedPenalty,
          officialNotes: formValue.officialNotes || '',
          isSelfReport: formValue.isSelfReport || false
        }
      );

      this.toast.success('Report finalized successfully');
      this.router.navigate(['/reports', this.reportId]);
    } catch (error: any) {
      this.toast.error(error.message || 'Failed to finalize report');
    } finally {
      this.submitting.set(false);
    }
  }

  async rejectReport(): Promise<void> {
    if (!this.rejectionReason) return;

    this.submitting.set(true);

    try {
      await this.convex.mutation(
        this.convex.api.reports.reject,
        {
          reportId: this.reportId as any,
          officialNotes: this.rejectionReason
        }
      );

      this.toast.success('Report rejected');
      this.showRejectModal = false;
      this.router.navigate(['/finalize']);
    } catch (error: any) {
      this.toast.error(error.message || 'Failed to reject report');
    } finally {
      this.submitting.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/finalize']);
  }
}
