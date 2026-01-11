import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  computed,
  Input,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, RouterLink } from "@angular/router";
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from "@angular/forms";
import { ConvexService } from "@core/services/convex.service";
import { AuthService } from "@core/services/auth.service";
import { ToastService } from "@core/services/toast.service";
import { CardComponent } from "@shared/components/card/card.component";
import { ButtonComponent } from "@shared/components/button/button.component";
import { BadgeComponent } from "@shared/components/badge/badge.component";
import { LoadingComponent } from "@shared/components/loading/loading.component";
import { SearchSelectComponent } from "@shared/components/search-select/search-select.component";
import { DateFormatPipe, TimeAgoPipe } from "@shared/pipes/date-format.pipe";
import { Penalty } from "@core/models/series.model";

@Component({
  selector: "app-review-form",
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    LoadingComponent,
    SearchSelectComponent,
    DateFormatPipe,
    TimeAgoPipe,
  ],
  template: `
    <div class="space-y-6">
      @if (loading()) {
        <app-loading text="Loading report..." />
      } @else if (report()) {
        <!-- Header -->
        <div
          class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
        >
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Review Incident</h1>
            <p class="text-gray-500 mt-1">
              {{ report()?.event?.trackName }} - Race
              {{ report()?.race?.raceNumber }}
            </p>
          </div>
          <a [routerLink]="['/reports', report()?._id]">
            <app-button variant="secondary">View Full Report</app-button>
          </a>
        </div>

        <div class="grid lg:grid-cols-3 gap-6">
          <!-- Review form -->
          <div class="lg:col-span-2">
            <form [formGroup]="form" (ngSubmit)="onSubmit()">
              <app-card title="Your Review" [overflowHidden]="false">
                <div class="space-y-4">
                  <!-- Incident description (editable copy) -->
                  <div>
                    <label class="label">Incident Description</label>
                    <textarea
                      formControlName="incidentDescription"
                      class="input min-h-[100px]"
                      [class.input-error]="
                        form.get('incidentDescription')?.invalid &&
                        form.get('incidentDescription')?.touched
                      "
                      placeholder="Describe the incident as you see it..."
                      rows="4"
                    ></textarea>
                    <p class="text-xs text-gray-500 mt-1">
                      You can modify the incident description if needed
                    </p>
                  </div>

                  <!-- Review notes -->
                  <div>
                    <label class="label">Review Notes *</label>
                    <textarea
                      formControlName="reviewNotes"
                      class="input min-h-[120px]"
                      [class.input-error]="
                        form.get('reviewNotes')?.invalid &&
                        form.get('reviewNotes')?.touched
                      "
                      placeholder="Your assessment of the incident, findings, and observations..."
                      rows="5"
                    ></textarea>
                    @if (
                      form.get("reviewNotes")?.invalid &&
                      form.get("reviewNotes")?.touched
                    ) {
                      <p class="mt-1 text-sm text-red-600">
                        Review notes are required
                      </p>
                    }
                  </div>

                  <!-- Recommended penalty -->
                  <div>
                    <label class="label">Recommended Penalty</label>
                    <select formControlName="recommendedPenalty" class="input">
                      <option value="">No penalty recommended</option>
                      @for (
                        penalty of availablePenalties();
                        track penalty._id
                      ) {
                        <option [value]="penalty._id">
                          {{ penalty.name }} ({{ penalty.timePenalty }}s /
                          {{ penalty.timePenaltyWithSelfReport }}s SR,
                          {{ penalty.licensePoints }} pts)
                        </option>
                      }
                    </select>
                    @if (availablePenalties().length === 0) {
                      <p class="text-xs text-yellow-600 mt-1">
                        No penalties configured for this series
                      </p>
                    }
                  </div>

                  <!-- Video timestamp -->
                  <div>
                    <label class="label">Video Timestamp</label>
                    <input
                      type="text"
                      formControlName="videoTimestamp"
                      class="input"
                      placeholder="e.g., 1:23:45 or Lap 15, T3 Entry"
                    />
                    <p class="text-xs text-gray-500 mt-1">
                      Optional: Reference to video evidence
                    </p>
                  </div>

                  <!-- Second steward -->
                  <div>
                    <app-search-select
                      formControlName="secondStewardId"
                      label="Second Steward (Optional)"
                      [options]="stewardOptions()"
                      placeholder="Search stewards by name..."
                    />
                  </div>
                </div>

                <!-- Footer -->
                <div
                  card-footer
                  class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between gap-3"
                >
                  <div class="flex gap-3">
                    <app-button
                      type="button"
                      variant="secondary"
                      (onClick)="cancel()"
                    >
                      Cancel
                    </app-button>
                  </div>
                  <div class="flex gap-3">
                    <app-button
                      type="submit"
                      variant="primary"
                      [loading]="submitting()"
                      [disabled]="form.invalid"
                    >
                      Submit Review
                    </app-button>
                    @if (
                      authService.hasRole(
                        "steward",
                        "head_steward",
                        "event_manager"
                      )
                    ) {
                      <app-button
                        type="button"
                        variant="success"
                        [loading]="submitting()"
                        [disabled]="form.invalid || !canMarkAsReviewed()"
                        (onClick)="submitAndMarkReviewed()"
                      >
                        Submit & Mark Reviewed
                      </app-button>
                    }
                  </div>
                </div>
                @if (
                  authService.hasRole(
                    "steward",
                    "head_steward",
                    "event_manager"
                  ) && !canMarkAsReviewed() && !form.invalid
                ) {
                  <div
                    card-footer
                    class="px-6 py-2 bg-amber-50 border-t border-amber-100 text-center"
                  >
                    <p class="text-xs text-amber-800">
                      Need at least 2 reviews or review with a second
                      steward to mark as reviewed
                    </p>
                  </div>
                }
              </app-card>
            </form>

            <!-- Existing reviews -->
            @if (existingReviews().length > 0) {
              <app-card title="Other Reviews" class="mt-6">
                <div class="space-y-4">
                  @for (review of existingReviews(); track review._id) {
                    <div class="p-4 bg-gray-50 rounded-lg">
                      <div class="flex items-start justify-between mb-3">
                        <div>
                          <p class="font-medium text-gray-900">
                            {{ review.reviewer?.name }}
                          </p>
                          @if (review.linkedReview) {
                            <p class="text-xs text-gray-500">
                              Joint review with {{ review.linkedReview.reviewer?.name }}
                            </p>
                          }
                          <p class="text-sm text-gray-500">
                            {{ review.reviewDate | timeAgo }}
                          </p>
                        </div>
                        @if (review.recommendedPenalty) {
                          <app-badge variant="info">
                            {{ review.recommendedPenalty.replace("_", " ") }}
                          </app-badge>
                        }
                      </div>
                      <p class="text-gray-700 text-sm whitespace-pre-wrap">
                        {{ review.reviewNotes }}
                      </p>
                    </div>
                  }
                </div>
              </app-card>
            }
          </div>

          <!-- Sidebar with report details -->
          <div class="space-y-6">
            <app-card title="Incident Details">
              <dl class="space-y-4">
                <div>
                  <dt class="text-sm text-gray-500">Reported Driver</dt>
                  <dd class="font-medium text-gray-900">
                    {{ report()?.reportedDriver?.driverName }}
                  </dd>
                  <dd class="text-sm text-gray-500">
                    #{{ report()?.reportedDriver?.driverNumber }}
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500">Reporting Driver</dt>
                  <dd class="font-medium text-gray-900">
                    {{ report()?.reportingDriver?.driverName }}
                  </dd>
                  <dd class="text-sm text-gray-500">
                    #{{ report()?.reportingDriver?.driverNumber }}
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500">Location</dt>
                  <dd class="font-medium text-gray-900">
                    Turn {{ report()?.turn }}
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500">Filed</dt>
                  <dd class="text-gray-900">
                    {{ report()?.reportDate | dateFormat: "PPp" }}
                  </dd>
                </div>
              </dl>
            </app-card>

            <app-card title="Original Description">
              <p class="text-gray-700 text-sm whitespace-pre-wrap">
                {{ report()?.description }}
              </p>
            </app-card>
          </div>
        </div>
      } @else {
        <app-card>
          <div class="text-center py-12">
            <p class="text-gray-500">Report not found</p>
            <a routerLink="/reviews" class="mt-4 inline-block">
              <app-button variant="primary">Back to Reviews</app-button>
            </a>
          </div>
        </app-card>
      }
    </div>
  `,
})
export class ReviewFormComponent implements OnInit, OnDestroy {
  @Input() reportId!: string;

  private fb = inject(FormBuilder);
  private convex = inject(ConvexService);
  private router = inject(Router);
  private toast = inject(ToastService);
  authService = inject(AuthService);

  form: FormGroup;
  report = signal<any>(null);
  availablePenalties = signal<Penalty[]>([]);
  existingReviews = signal<any[]>([]);
  stewards = signal<any[]>([]);
  loading = signal(true);
  submitting = signal(false);

  availableStewards = computed(() => {
    const currentUserId = this.authService.getUserId();
    if (!currentUserId) return this.stewards();

    return this.stewards().filter(
      (s) => String(s._id) !== String(currentUserId),
    );
  });

  stewardOptions = computed(() => {
    return [
      { value: "", label: "Reviewing alone" },
      ...this.availableStewards().map((s) => ({
        value: s._id,
        label: `${s.name} (${s.role?.name})`,
      })),
    ];
  });

  canMarkAsReviewed = computed(() => {
    const existingReviewCount = this.existingReviews().length;
    const hasSecondSteward = !!this.form.get("secondStewardId")?.value;

    // Enable if:
    // - Already have 2+ reviews, OR
    // - Submitting with a second steward (counts as 2 reviews)
    return existingReviewCount >= 1 || hasSecondSteward;
  });

  private unsubscribes: (() => void)[] = [];

  constructor() {
    this.form = this.fb.group({
      incidentDescription: ["", Validators.required],
      reviewNotes: ["", [Validators.required, Validators.minLength(10)]],
      recommendedPenalty: [""],
      videoTimestamp: [""],
      secondStewardId: [""],
    });
  }

  ngOnInit(): void {
    this.loadReport();
    this.loadStewards();
    this.loadSavedSteward();

    this.form.get("secondStewardId")?.valueChanges.subscribe((value) => {
      this.saveStewardSelection(value);
    });
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach((unsub) => unsub());
  }

  private loadReport(): void {
    if (!this.reportId) {
      this.loading.set(false);
      return;
    }

    const reportQuery = this.convex.createReactiveQuery(
      this.convex.api.reports.getById,
      { reportId: this.reportId as any },
    );
    this.unsubscribes.push(reportQuery.unsubscribe);

    const checkReport = setInterval(() => {
      const data = reportQuery.data();
      if (data !== undefined) {
        this.report.set(data);

        // Pre-fill incident description
        if (data) {
          this.form.patchValue({
            incidentDescription: data.description,
          });

          // Filter out current user's review if exists
          const userId = this.authService.getUserId();
          const otherReviews = (data.reviews || []).filter(
            (r: any) => r.userId !== userId,
          );
          this.existingReviews.set(otherReviews);

          // Load penalties for this series
          if (data?.event?.seriesId) {
            this.loadPenalties(data.event.seriesId);
          }
        }

        this.loading.set(false);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkReport));
  }

  private loadPenalties(seriesId: string): void {
    const penaltiesQuery = this.convex.createReactiveQuery(
      this.convex.api.penalties.getBySeries,
      { seriesId: seriesId as any },
    );
    this.unsubscribes.push(penaltiesQuery.unsubscribe);

    const checkPenalties = setInterval(() => {
      const data = penaltiesQuery.data();
      if (data !== undefined) {
        this.availablePenalties.set(data);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkPenalties));
  }

  private loadStewards(): void {
    const stewardsQuery = this.convex.createReactiveQuery(
      this.convex.api.users.listStewards,
      {},
    );
    this.unsubscribes.push(stewardsQuery.unsubscribe);

    const checkStewards = setInterval(() => {
      const data = stewardsQuery.data();
      if (data !== undefined) {
        this.stewards.set(data);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkStewards));
  }

  private loadSavedSteward(): void {
    const savedStewardId = localStorage.getItem("selectedSecondSteward");
    if (savedStewardId) {
      this.form.patchValue({ secondStewardId: savedStewardId });
    }
  }

  private saveStewardSelection(stewardId: string): void {
    if (stewardId) {
      localStorage.setItem("selectedSecondSteward", stewardId);
    } else {
      localStorage.removeItem("selectedSecondSteward");
    }
  }

  async onSubmit(markAsReviewed = false): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);

    try {
      const userId = this.authService.getUserId();
      if (!userId) {
        throw new Error("Not authenticated");
      }

      const formValue = this.form.value;

      // Create review
      await this.convex.mutation(this.convex.api.reviews.create, {
        userId,
        reportId: this.reportId as any,
        incidentDescription: formValue.incidentDescription,
        reviewNotes: formValue.reviewNotes,
        recommendedPenalty: formValue.recommendedPenalty || undefined,
        videoTimestamp: formValue.videoTimestamp || undefined,
        secondStewardId: formValue.secondStewardId || undefined,
      });

      // Optionally mark report as reviewed
      if (markAsReviewed) {
        await this.convex.mutation(this.convex.api.reports.markAsReviewed, {
          reportId: this.reportId as any,
        });
        this.toast.success("Review submitted and report marked as reviewed");
      } else {
        this.toast.success("Review submitted successfully");
      }

      this.router.navigate(["/reviews"]);
    } catch (error: any) {
      this.toast.error(error.message || "Failed to submit review");
    } finally {
      this.submitting.set(false);
    }
  }

  submitAndMarkReviewed(): void {
    this.onSubmit(true);
  }

  cancel(): void {
    this.router.navigate(["/reviews"]);
  }
}
