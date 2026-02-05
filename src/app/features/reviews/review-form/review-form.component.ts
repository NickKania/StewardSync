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
import { ToggleComponent } from "@shared/components/toggle/toggle.component";
import { DateFormatPipe, TimeAgoPipe } from "@shared/pipes/date-format.pipe";
import { Penalty } from "@core/models/series.model";
import { SelectOption } from "@shared/components/select/select.component";

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
    ToggleComponent,
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
            <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Review Incident
            </h1>
            <p class="text-gray-500 mt-1 dark:text-gray-400">
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
                    <p class="text-xs text-gray-500 mt-1 dark:text-gray-400">
                      You can modify the incident description if needed
                    </p>
                  </div>

                  <!-- Review notes -->
                  <div>
                    <label class="label">Review Notes</label>
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
                    <p class="text-xs text-gray-500 mt-1 dark:text-gray-400">
                      Not public facing - internal use only
                    </p>
                  </div>

                  <!-- Recommended penalty -->
                  <div>
                    <label class="label">Recommended Penalty</label>
                    <select
                      formControlName="recommendedPenalty"
                      class="input"
                      [class.input-error]="
                        form.get('recommendedPenalty')?.invalid &&
                        form.get('recommendedPenalty')?.touched
                      "
                    >
                      <option value="">Select penalty</option>
                      @for (
                        penalty of availablePenalties();
                        track penalty._id
                      ) {
                        <option [value]="penalty._id">
                          {{ penalty.name }}
                        </option>
                      }
                    </select>
                    @if (
                      form.get("recommendedPenalty")?.invalid &&
                      form.get("recommendedPenalty")?.touched
                    ) {
                      <p class="mt-1 text-sm text-red-600">
                        Recommended penalty is required
                      </p>
                    }
                    @if (availablePenalties().length === 0) {
                      <p class="text-xs text-yellow-600 mt-1">
                        No penalties configured for this series
                      </p>
                    }
                  </div>

                  <!-- At fault driver -->
                  <div>
                    <label class="label">At Fault Driver</label>
                    <select formControlName="atFaultDriverId" class="input">
                      <option value="">Select driver</option>
                      @for (driver of drivers(); track driver._id) {
                        <option [value]="driver._id">
                          {{ driver.driverName }} ({{ driver.driverNumber }})
                        </option>
                      }
                    </select>
                    <p class="text-xs text-gray-500 mt-1 dark:text-gray-400">
                      Pre-selected to reported driver, change if different
                    </p>
                  </div>

                  <!-- Self report toggle -->
                  <div>
                    <app-toggle
                      formControlName="isSelfReport"
                      label="Self Report"
                      hint="Driver self reported?"
                    />
                  </div>

                  <!-- Adjusted toggle -->
                  <div>
                    <app-toggle
                      formControlName="isAdjusted"
                      label="Adjusted"
                      hint="Incident description was adjusted?"
                    />
                  </div>

                  <!-- Candidate for standardization -->
                  <div>
                    <label
                      class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                    >
                      <input
                        type="checkbox"
                        formControlName="candidateForStandardization"
                        class="rounded border-gray-300 dark:border-gray-700"
                      />
                      Candidate for standardization
                    </label>
                    <p class="text-xs text-gray-500 mt-1 dark:text-gray-400">
                      Optional: Mark if this incident would be a good example
                      for standardization
                    </p>
                  </div>

                  <!-- Adjusted reason (conditionally shown) -->
                  @if (form.get("isAdjusted")?.value) {
                    <div>
                      <label class="label">Adjusted Reason</label>
                      <textarea
                        formControlName="adjustedReason"
                        class="input min-h-[80px]"
                        placeholder="Explain why the incident was adjusted..."
                        rows="3"
                      ></textarea>
                      <p class="text-xs text-gray-500 mt-1 dark:text-gray-400">
                        This will be added as a note to the incident description
                      </p>
                    </div>
                  }

                  <!-- Video timestamp -->
                  <div>
                    <label class="label">Video/Replay Timestamp</label>
                    <input
                      type="text"
                      formControlName="videoTimestamp"
                      class="input"
                      placeholder="e.g., 1:23:45 or Lap 15, T3 Entry"
                    />
                    <p class="text-xs text-gray-500 mt-1 dark:text-gray-400">
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
                    <p class="text-xs text-gray-500 mt-1 dark:text-gray-400">
                      Stewards involved as drivers in this incident are excluded
                      from the list
                    </p>
                  </div>
                </div>

                <!-- Footer -->
                <div
                  card-footer
                  class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between gap-3 dark:bg-gray-800 dark:border-gray-700"
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
                  </div>
                </div>
              </app-card>
            </form>

            <!-- Existing reviews -->
            @if (existingReviews().length > 0) {
              <app-card title="Other Reviews" class="mt-6">
                <div class="space-y-4">
                  @for (review of existingReviews(); track review._id) {
                    <div class="p-4 bg-gray-50 rounded-lg dark:bg-gray-800">
                      <div class="flex items-start justify-between mb-3">
                        <div>
                          <p
                            class="font-medium text-gray-900 dark:text-gray-100"
                          >
                            {{ review.reviewer?.name }}
                          </p>
                          @if (review.linkedReview) {
                            <p class="text-xs text-gray-500 dark:text-gray-400">
                              Joint review with
                              {{ review.linkedReview.reviewer?.name }}
                            </p>
                          }
                          <p class="text-sm text-gray-500 dark:text-gray-400">
                            {{ review.reviewDate | timeAgo }}
                          </p>
                        </div>
                        @if (review.recommendedPenalty) {
                          <app-badge variant="info">
                            {{
                              review.recommendedPenaltyObj.name.replace(
                                "_",
                                " "
                              )
                            }}
                          </app-badge>
                        }
                      </div>
                      @if (review.candidateForStandardization) {
                        <div class="mb-3">
                          <app-badge variant="warning"
                            >Candidate for standardization</app-badge
                          >
                        </div>
                      }
                      <p
                        class="text-gray-700 text-sm whitespace-pre-wrap dark:text-gray-300"
                      >
                        {{ review.reviewNotes }}
                        @if (review.isAdjusted && review.adjustedReason) {
                          <br /><span class="text-amber-700"
                            >[Adjusted: {{ review.adjustedReason }}]</span
                          >
                        }
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
                  <dt class="text-sm text-gray-500 dark:text-gray-400">
                    Reported Driver
                  </dt>
                  <dd class="font-medium text-gray-900 dark:text-gray-100">
                    {{ report()?.reportedDriver?.driverName }}
                  </dd>
                  <dd class="text-sm text-gray-500 dark:text-gray-400">
                    #{{ report()?.reportedDriver?.driverNumber }}
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500 dark:text-gray-400">
                    Reported By
                  </dt>
                  <dd class="font-medium text-gray-900 dark:text-gray-100">
                    {{ report()?.reportingUser?.name || "Unknown User" }}
                  </dd>
                  @if (report()?.isStewardReported) {
                    <dd class="text-sm text-gray-500 dark:text-gray-400">
                      <app-badge variant="info" size="sm">Steward</app-badge>
                    </dd>
                  }
                </div>
                <div>
                  <dt class="text-sm text-gray-500 dark:text-gray-400">
                    Location
                  </dt>
                  <dd class="font-medium text-gray-900 dark:text-gray-100">
                    Lap {{ report()?.lap }}, Turn {{ report()?.turn }}
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500 dark:text-gray-400">
                    Filed
                  </dt>
                  <dd class="text-gray-900 dark:text-gray-100">
                    {{ report()?.reportDate | dateFormat: "PPp" }}
                  </dd>
                </div>
              </dl>
            </app-card>

            <app-card title="Original Description">
              <p
                class="text-gray-700 text-sm whitespace-pre-wrap dark:text-gray-300"
              >
                {{ report()?.description }}
              </p>
            </app-card>
          </div>
        </div>
      } @else {
        <app-card>
          <div class="text-center py-12">
            <p class="text-gray-500 dark:text-gray-400">Report not found</p>
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
  drivers = signal<any[]>([]);
  loading = signal(true);
  submitting = signal(false);
  secondStewardUnsubscribe: (() => void) | null = null;

  availableStewards = computed(() => {
    const currentUserId = this.authService.getUserId();
    if (!currentUserId) return this.stewards();

    return this.stewards().filter(
      (s) => String(s._id) !== String(currentUserId),
    );
  });

  stewardOptions = computed(() => {
    const currentUserId = this.authService.getUserId();
    const report = this.report();

    if (!currentUserId || !report) {
      return [{ value: "", label: "Reviewing alone" }];
    }

    return [
      { value: "", label: "Reviewing alone" },
      ...this.stewards()
        .filter((steward) => {
          // Exclude current user
          if (String(steward._id) === String(currentUserId)) return false;

          // Exclude stewards who are involved as the reporting user or driver
          if (
            report.reportingUserId &&
            String(steward._id) === String(report.reportingUserId)
          ) {
            return false;
          }

          const reportedDriverUserId = report.reportedDriver?.userId;
          if (
            reportedDriverUserId &&
            String(steward._id) === String(reportedDriverUserId)
          ) {
            return false;
          }

          return true;
        })
        .map((steward) => ({
          value: steward._id,
          label: `${steward.name} (${steward.role?.name || "Unknown"})`,
        })),
    ];
  });

  private unsubscribes: (() => void)[] = [];

  constructor() {
    this.form = this.fb.group({
      incidentDescription: ["", Validators.required],
      reviewNotes: [""],
      recommendedPenalty: ["", Validators.required],
      atFaultDriverId: [""],
      videoTimestamp: [""],
      secondStewardId: [""],
      isSelfReport: [false],
      isAdjusted: [false],
      candidateForStandardization: [false],
      adjustedReason: [""],
    });
  }

  ngOnInit(): void {
    this.loadReport();
    this.loadStewards();
    this.loadDrivers();
    this.loadSavedSteward();
  }

  private loadDrivers(): void {
    const driversQuery = this.convex.createReactiveQuery(
      this.convex.api.drivers.list,
      {},
    );
    this.unsubscribes.push(driversQuery.unsubscribe);

    const checkDrivers = setInterval(() => {
      const data = driversQuery.data();
      if (data !== undefined) {
        this.drivers.set(data);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkDrivers));
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

    let checkCount = 0;
    const checkReport = setInterval(() => {
      checkCount++;
      const data = reportQuery.data();
      if (data !== undefined) {
        clearInterval(checkReport);
        this.report.set(data);

        // Pre-fill incident description (only if control is pristine and value has changed)
        if (data) {
          const incidentControl = this.form.get("incidentDescription");
          const newValue = data.description;

          if (
            incidentControl &&
            incidentControl.pristine &&
            incidentControl.value !== newValue
          ) {
            incidentControl.setValue(newValue);
          }

          // Pre-select atFaultDriverId to reportedDriver
          if (data.reportedDriverId) {
            const atFaultDriverControl = this.form.get("atFaultDriverId");
            if (atFaultDriverControl && atFaultDriverControl.pristine) {
              atFaultDriverControl.setValue(data.reportedDriverId);
            }
          }

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
    const currentUserId = this.authService.getUserId();
    const report = this.report();

    // Don't load saved steward if:
    // 1. No saved steward exists
    // 2. Current user is not authenticated
    // 3. No report data available yet
    if (!savedStewardId || !currentUserId || !report) {
      localStorage.removeItem("selectedSecondSteward");
      return;
    }

    // If saved steward matches reporting user, it would cause a conflict
    if (
      report.reportingUserId &&
      String(savedStewardId) === String(report.reportingUserId)
    ) {
      localStorage.removeItem("selectedSecondSteward");
      this.form.patchValue({ secondStewardId: "" });
      return;
    }

    // If saved steward is current user (user shouldn't review their own review)
    if (String(savedStewardId) === String(currentUserId)) {
      localStorage.removeItem("selectedSecondSteward");
      this.form.patchValue({ secondStewardId: "" });
      return;
    }

    // Also check if saved steward is linked to reported driver
    const reportedDriverUserId = report.reportedDriver?.userId;
    if (
      reportedDriverUserId &&
      String(savedStewardId) === String(reportedDriverUserId)
    ) {
      localStorage.removeItem("selectedSecondSteward");
      this.form.patchValue({ secondStewardId: "" });
      return;
    }

    // Also check if saved steward is linked to reporting driver
    const reportingDriverUserId = report.reportingDriver?.userId;
    if (
      reportingDriverUserId &&
      String(savedStewardId) === String(reportingDriverUserId)
    ) {
      localStorage.removeItem("selectedSecondSteward");
      this.form.patchValue({ secondStewardId: "" });
      return;
    }

    // Disconnects valueChanges subscription before patching to prevent re-saving
    const secondStewardControl = this.form.get("secondStewardId");
    if (secondStewardControl) {
      const subscription = secondStewardControl.valueChanges.subscribe(
        (value) => {
          this.saveStewardSelection(value);
        },
      );
      this.unsubscribes.push(() => subscription.unsubscribe());
    }

    this.form.patchValue({ secondStewardId: savedStewardId });
  }

  private saveStewardSelection(stewardId: string): void {
    const report = this.report();
    const currentUserId = this.authService.getUserId();

    if (!stewardId) {
      localStorage.removeItem("selectedSecondSteward");
      return;
    }

    if (!currentUserId) {
      localStorage.setItem("selectedSecondSteward", stewardId);
      return;
    }

    const reportedDriver = report.reportedDriver
      ? this.drivers().find((d) => d._id === report.reportedDriver)
      : null;
    const reportedDriverUserId = reportedDriver?.userId;

    if (String(stewardId) === String(reportedDriverUserId)) {
      localStorage.setItem("selectedSecondSteward", stewardId);
      return;
    }

    localStorage.setItem("selectedSecondSteward", stewardId);
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
        throw new Error("Not authenticated");
      }

      const formValue = this.form.value;

      const result = await this.convex.mutation(
        this.convex.api.reviews.create,
        {
          userId,
          reportId: this.reportId as any,
          incidentDescription: formValue.incidentDescription,
          reviewNotes: formValue.reviewNotes,
          recommendedPenalty: formValue.recommendedPenalty || undefined,
          atFaultDriverId: formValue.atFaultDriverId || undefined,
          videoTimestamp: formValue.videoTimestamp || undefined,
          secondStewardId: formValue.secondStewardId || undefined,
          isSelfReport: formValue.isSelfReport || false,
          isAdjusted: formValue.isAdjusted || false,
          candidateForStandardization:
            formValue.candidateForStandardization || false,
          adjustedReason:
            formValue.isAdjusted && formValue.adjustedReason
              ? formValue.adjustedReason
              : undefined,
        },
      );

      if (!result.success) {
        this.toast.error(result.error);
        this.submitting.set(false);
        return;
      }

      this.toast.success("Review submitted successfully");

      this.router.navigate(["/reviews"]);
    } catch (error: any) {
      this.toast.error(error.message || "Failed to submit review");
    } finally {
      this.submitting.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(["/reviews"]);
  }
}
