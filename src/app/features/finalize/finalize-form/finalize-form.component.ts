import { Component, inject, OnInit, OnDestroy, signal, Input } from '@angular/core';
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
import { DateFormatPipe, TimeAgoPipe } from '@shared/pipes/date-format.pipe';

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
              <app-card title="Final Decision">
                <div class="space-y-4">
                  <!-- Final decision -->
                  <div>
                    <label class="label">Final Decision *</label>
                    <textarea
                      formControlName="finalDecision"
                      class="input min-h-[100px]"
                      [class.input-error]="form.get('finalDecision')?.invalid && form.get('finalDecision')?.touched"
                      placeholder="State the official decision regarding this incident..."
                      rows="4"
                    ></textarea>
                    @if (form.get('finalDecision')?.invalid && form.get('finalDecision')?.touched) {
                      <p class="mt-1 text-sm text-red-600">Final decision is required</p>
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
                      <option value="none">No Further Action</option>
                      <option value="warning">Warning</option>
                      <option value="time_penalty">Time Penalty</option>
                      <option value="drive_through">Drive Through</option>
                      <option value="stop_go">Stop & Go</option>
                      <option value="disqualification">Disqualification</option>
                    </select>
                    @if (form.get('appliedPenalty')?.invalid && form.get('appliedPenalty')?.touched) {
                      <p class="mt-1 text-sm text-red-600">Penalty selection is required</p>
                    }
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
                      Publish Decision
                    </app-button>
                  </div>
                </div>
              </app-card>
            </form>

            <!-- Steward reviews summary -->
            @if (report()?.reviews?.length > 0) {
              <app-card title="Steward Reviews" class="mt-6">
                <div class="space-y-4">
                  @for (review of report()?.reviews; track review._id) {
                    <div class="p-4 bg-gray-50 rounded-lg">
                      <div class="flex items-start justify-between mb-3">
                        <div>
                          <p class="font-medium text-gray-900">{{ review.reviewer?.name }}</p>
                          <p class="text-sm text-gray-500">{{ review.reviewDate | timeAgo }}</p>
                        </div>
                        @if (review.recommendedPenalty) {
                          <app-badge variant="info">
                            Recommends: {{ review.recommendedPenalty.replace('_', ' ') }}
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
                  @for (rec of penaltyRecommendations(); track rec.penalty) {
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-gray-700 capitalize">{{ rec.penalty.replace('_', ' ') }}</span>
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
  loading = signal(true);
  submitting = signal(false);

  showRejectModal = false;
  rejectionReason = '';

  private unsubscribes: (() => void)[] = [];

  constructor() {
    this.form = this.fb.group({
      finalDecision: ['', [Validators.required, Validators.minLength(10)]],
      appliedPenalty: ['', Validators.required],
      officialNotes: ['']
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
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkReport));
  }

  penaltyRecommendations(): { penalty: string; count: number }[] {
    const reviews = this.report()?.reviews || [];
    const counts: Record<string, number> = {};

    reviews.forEach((r: any) => {
      if (r.recommendedPenalty) {
        counts[r.recommendedPenalty] = (counts[r.recommendedPenalty] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([penalty, count]) => ({ penalty, count }))
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
          finalDecision: formValue.finalDecision,
          appliedPenalty: formValue.appliedPenalty,
          officialNotes: formValue.officialNotes || ''
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
