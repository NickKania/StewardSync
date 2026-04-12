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
  FormsModule,
} from "@angular/forms";
import { ConvexService } from "@core/services/convex.service";
import { AuthService } from "@core/services/auth.service";
import { NavigationService } from "@core/services/navigation.service";
import { ToastService } from "@core/services/toast.service";
import { CardComponent } from "@shared/components/card/card.component";
import { ButtonComponent } from "@shared/components/button/button.component";
import { BadgeComponent } from "@shared/components/badge/badge.component";
import { LoadingComponent } from "@shared/components/loading/loading.component";
import { ModalComponent } from "@shared/components/modal/modal.component";
import { SearchSelectComponent } from "@shared/components/search-select/search-select.component";
import { ToggleComponent } from "@shared/components/toggle/toggle.component";
import { DateFormatPipe, TimeAgoPipe } from "@shared/pipes/date-format.pipe";
import { Penalty } from "@core/models/series.model";
import { User } from "@app/core/models";

@Component({
  selector: "app-finalize-form",
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
              Finalize Report
            </h1>
            <p class="text-gray-500 mt-1 dark:text-gray-400">
              {{ report()?.event?.trackName }} -
              {{ getSessionName(report()?.race) }}
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
                      [class.input-error]="
                        form.get('incidentDescription')?.invalid &&
                        form.get('incidentDescription')?.touched
                      "
                      placeholder="Describe the incident as observed in the steward review..."
                      rows="4"
                    ></textarea>
                    <p class="text-xs text-gray-500 mt-1 dark:text-gray-400">
                      You can modify the incident description if needed
                    </p>
                    @if (
                      form.get("incidentDescription")?.invalid &&
                      form.get("incidentDescription")?.touched
                    ) {
                      <p class="mt-1 text-sm text-danger">
                        Incident description is required
                      </p>
                    }
                  </div>

                  <!-- At fault driver -->
                  <div>
                    <app-search-select
                      formControlName="atFaultDriverId"
                      label="At Fault Driver"
                      [options]="driverOptions()"
                      placeholder="Search drivers by name..."
                    />
                    <p class="text-xs text-gray-500 mt-1 dark:text-gray-400">
                      Pre-selected from latest review, change if different
                    </p>
                  </div>

                  <!-- Applied penalty -->
                  <div>
                    <label class="label">Applied Penalty *</label>
                    <select
                      formControlName="appliedPenalty"
                      class="input"
                      [class.input-error]="
                        form.get('appliedPenalty')?.invalid &&
                        form.get('appliedPenalty')?.touched
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
                      form.get("appliedPenalty")?.invalid &&
                      form.get("appliedPenalty")?.touched
                    ) {
                      <p class="mt-1 text-sm text-danger">
                        Penalty selection is required
                      </p>
                    }
                    @if (availablePenalties().length === 0) {
                      <p class="mt-1 text-sm text-warning">
                        No penalties configured for this series. Please
                        configure penalties first.
                      </p>
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

                  <!-- Official notes -->
                  <div>
                    <label class="label"
                      >Official Notes
                      @if (form.get("candidateForStandardization")?.value) {
                        <span class="text-danger">*</span>
                      }
                    </label>
                    <textarea
                      formControlName="officialNotes"
                      class="input min-h-[100px]"
                      [class.input-error]="
                        form.get('officialNotes')?.invalid &&
                        form.get('officialNotes')?.touched
                      "
                      placeholder="Additional notes for the official record..."
                      rows="4"
                    ></textarea>
                    @if (
                      form.get("officialNotes")?.invalid &&
                      form.get("officialNotes")?.touched
                    ) {
                      <p class="mt-1 text-sm text-danger">
                        Official notes are required when marking for
                        standardization
                      </p>
                    }
                    <p class="text-xs text-gray-500 mt-1 dark:text-gray-400">
                      Not public facing - internal use only
                    </p>
                  </div>
                </div>

                <!-- Footer -->
                <div
                  card-footer
                  class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between gap-3 dark:bg-gray-800 dark:border-gray-700"
                >
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
                    <div class="p-4 bg-gray-50 rounded-lg dark:bg-gray-800">
                      <div class="flex items-start justify-between mb-3">
                        <div>
                          @if (review.linkedReview) {
                            <div class="flex items-center gap-2">
                              <app-badge variant="success" size="sm"
                                >Joint Review</app-badge
                              >
                              <p
                                class="font-medium text-gray-900 dark:text-gray-100"
                              >
                                {{ review.reviewer?.officialName }} &
                                {{ review.linkedReview.reviewer?.officialName }}
                              </p>
                            </div>
                          } @else {
                            <p
                              class="font-medium text-gray-900 dark:text-gray-100"
                            >
                              {{ review.reviewer?.name }}
                            </p>
                          }
                          <p class="text-sm text-gray-500 dark:text-gray-400">
                            {{ review.reviewDate | timeAgo }}
                          </p>
                        </div>
                        @if (review.recommendedPenaltyObj) {
                          <app-badge variant="info">
                            Recommends: {{ review.recommendedPenaltyObj.name }}
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
                          <br /><span class="text-warning-text"
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
                    Ticket Number
                  </dt>
                  <dd class="font-medium text-gray-900 dark:text-gray-100">
                    {{ report()?.reportId || "N/A" }}
                  </dd>
                </div>
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
                </div>
                <div>
                  <dt class="text-sm text-gray-500 dark:text-gray-400">
                    Location
                  </dt>
                  <dd class="font-medium text-gray-900 dark:text-gray-100">
                    {{ getSessionName(report()?.race) }}, Lap
                    {{ report()?.lap }}, Turn {{ report()?.turn }}
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500 dark:text-gray-400">
                    Video Link
                  </dt>
                  <dd class="font-medium text-gray-900 dark:text-gray-100">
                    @if (report()?.videoLink) {
                      <a
                        [href]="report()?.videoLink"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {{ report()?.videoLink }}
                      </a>
                    } @else {
                      Not provided
                    }
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500 dark:text-gray-400">
                    Video Timestamp
                  </dt>
                  <dd class="font-medium text-gray-900 dark:text-gray-100">
                    {{ report()?.videoTimestamp || "Not provided" }}
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500 dark:text-gray-400">
                    Reviews
                  </dt>
                  <dd class="font-medium text-gray-900 dark:text-gray-100">
                    {{ report()?.reviews?.length || 0 }} review(s)
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

            <!-- Penalty recommendations summary -->
            @if (penaltyRecommendations().length > 0) {
              <app-card title="Penalty Recommendations">
                <div class="space-y-2">
                  @for (rec of penaltyRecommendations(); track rec.penaltyId) {
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-gray-700 dark:text-gray-300">{{
                        rec.penaltyName
                      }}</span>
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
            <p class="text-gray-500 dark:text-gray-400">Report not found</p>
            <app-button
              class="mt-4 inline-flex"
              variant="primary"
              (onClick)="goBackToFinalization()"
            >
              Back to Finalization
            </app-button>
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
      <p class="text-gray-600 mb-4 dark:text-gray-300">
        Are you sure you want to reject this report? This action cannot be
        undone.
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
      <div
        modal-footer
        class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 dark:bg-gray-800 dark:border-gray-700"
      >
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
  `,
})
export class FinalizeFormComponent implements OnInit, OnDestroy {
  @Input() reportId!: string;
  readonly NO_DRIVER_OPTION_VALUE = "__NO_DRIVER__";

  private fb = inject(FormBuilder);
  private convex = inject(ConvexService);
  private authService = inject(AuthService);
  private navigationService = inject(NavigationService);
  private router = inject(Router);
  private toast = inject(ToastService);

  form: FormGroup;
  report = signal<any>(null);
  availablePenalties = signal<Penalty[]>([]);
  selectedAppliedPenaltyId = signal<string>("");
  drivers = signal<any[]>([]);
  loading = signal(true);
  submitting = signal(false);

  driverOptions = computed(() => {
    const options = this.drivers().map((driver) => ({
      value: String(driver._id),
      label: `${driver.driverName} (#${driver.driverNumber})`,
    }));
    if (this.selectedPenaltyAllowsNoDriver()) {
      return [
        { value: this.NO_DRIVER_OPTION_VALUE, label: "No Driver" },
        ...options,
      ];
    }
    return options;
  });
  selectedPenaltyAllowsNoDriver = computed(() => {
    const selectedPenaltyId = this.selectedAppliedPenaltyId();
    if (!selectedPenaltyId) {
      return false;
    }

    const selectedPenalty = this.availablePenalties().find(
      (penalty) => String(penalty._id) === String(selectedPenaltyId),
    );
    return Boolean(selectedPenalty?.allowNoDriverAtFault);
  });

  showRejectModal = false;
  rejectionReason = "";

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
      incidentDescription: [
        "",
        [Validators.required, Validators.minLength(10)],
      ],
      appliedPenalty: ["", Validators.required],
      atFaultDriverId: [""],
      officialNotes: [""],
      isSelfReport: [false],
      isAdjusted: [false],
      candidateForStandardization: [false],
      adjustedReason: [""],
    });

    this.form.get("isAdjusted")?.valueChanges.subscribe((isAdjusted) => {
      this.updateAdjustedReasonValidation(isAdjusted);
    });
    this.form
      .get("appliedPenalty")
      ?.valueChanges.subscribe((penaltyId: string) => {
        this.onAppliedPenaltyChange(penaltyId);
      });
    this.form
      .get("candidateForStandardization")
      ?.valueChanges.subscribe((candidate: boolean) => {
        this.updateOfficialNotesValidation(candidate);
      });
  }

  private updateOfficialNotesValidation(candidate: boolean): void {
    const officialNotesControl = this.form.get("officialNotes");
    if (!officialNotesControl) return;

    if (candidate) {
      officialNotesControl.setValidators([Validators.required]);
    } else {
      officialNotesControl.clearValidators();
    }
    officialNotesControl.updateValueAndValidity();
  }

  private updateAdjustedReasonValidation(isAdjusted: boolean): void {
    const adjustedReasonControl = this.form.get("adjustedReason");
    if (!adjustedReasonControl) return;

    if (isAdjusted) {
      adjustedReasonControl.setValidators([Validators.required]);
    } else {
      adjustedReasonControl.clearValidators();
    }
    adjustedReasonControl.updateValueAndValidity();
  }

  ngOnInit(): void {
    this.loadReport();
    this.loadDrivers();
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

    const checkReport = setInterval(() => {
      const data = reportQuery.data();
      if (data !== undefined) {
        this.report.set(data);
        this.loading.set(false);

        // Auto-fill incident description and isSelfReport from latest review
        if (data?.reviews && data.reviews.length > 0) {
          const latestReview = data.reviews.reduce(
            (latest: any, current: any) => {
              const latestDate = latest.reviewDate || latest.createdAt || 0;
              const currentDate = current.reviewDate || current.createdAt || 0;
              return currentDate > latestDate ? current : latest;
            },
          );

          const incidentControl = this.form.get("incidentDescription");
          const selfReportControl = this.form.get("isSelfReport");
          const standardizationControl = this.form.get(
            "candidateForStandardization",
          );
          const adjustedControl = this.form.get("isAdjusted");
          const adjustedReasonControl = this.form.get("adjustedReason");
          const atFaultDriverControl = this.form.get("atFaultDriverId");

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

          if (
            latestReview?.candidateForStandardization !== undefined &&
            standardizationControl
          ) {
            const currentValue = standardizationControl.value;
            const newValue = latestReview.candidateForStandardization;

            if (standardizationControl.pristine && currentValue !== newValue) {
              standardizationControl.setValue(newValue);
            }
          }

          if (latestReview?.isAdjusted !== undefined && adjustedControl) {
            const currentValue = adjustedControl.value;
            const newValue = latestReview.isAdjusted;

            if (adjustedControl.pristine && currentValue !== newValue) {
              adjustedControl.setValue(newValue);
            }
          }

          if (latestReview?.adjustedReason && adjustedReasonControl) {
            const currentValue = adjustedReasonControl.value;
            const newValue = latestReview.adjustedReason;

            if (adjustedReasonControl.pristine && currentValue !== newValue) {
              adjustedReasonControl.setValue(newValue);
            }
          }

          if (latestReview?.isAdjusted !== undefined) {
            this.updateAdjustedReasonValidation(
              Boolean(latestReview.isAdjusted),
            );
          }

          // Pre-select atFaultDriverId from latest review or reportedDriver
          // only when the field is still empty to avoid overriding user edits
          if (
            atFaultDriverControl &&
            atFaultDriverControl.pristine &&
            !atFaultDriverControl.value
          ) {
            const defaultDriver = latestReview?.isNoDriverAtFault
              ? this.NO_DRIVER_OPTION_VALUE
              : latestReview?.atFaultDriverId ||
                (data?.isNoDriverAtFault
                  ? this.NO_DRIVER_OPTION_VALUE
                  : data?.reportedDriverId);
            if (defaultDriver) {
              atFaultDriverControl.setValue(String(defaultDriver));
            }
          }

          // Pre-select applied penalty from latest review's recommended penalty
          if (
            latestReview?.recommendedPenaltyObj &&
            this.availablePenalties().length > 0
          ) {
            const appliedPenaltyControl = this.form.get("appliedPenalty");
            if (appliedPenaltyControl) {
              const recommendedPenaltyId =
                latestReview.recommendedPenaltyObj._id;
              const currentValue = appliedPenaltyControl.value;

              if (
                appliedPenaltyControl.pristine &&
                currentValue !== recommendedPenaltyId
              ) {
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
      { seriesId: seriesId as any },
    );
    this.unsubscribes.push(penaltiesQuery.unsubscribe);

    const checkPenalties = setInterval(() => {
      const data = penaltiesQuery.data();
      if (data !== undefined) {
        this.availablePenalties.set(data);
        this.enforceAtFaultDriverSelection();

        // Pre-select applied penalty from latest review when penalties are loaded
        const report = this.report();
        if (report?.reviews && report.reviews.length > 0) {
          const latestReview = report.reviews.reduce(
            (latest: any, current: any) => {
              const latestDate = latest.reviewDate || latest.createdAt || 0;
              const currentDate = current.reviewDate || current.createdAt || 0;
              return currentDate > latestDate ? current : latest;
            },
          );

          if (latestReview?.recommendedPenaltyObj && data.length > 0) {
            const appliedPenaltyControl = this.form.get("appliedPenalty");
            if (appliedPenaltyControl) {
              const recommendedPenaltyId =
                latestReview.recommendedPenaltyObj._id;
              const currentValue = appliedPenaltyControl.value;

              if (
                appliedPenaltyControl.pristine &&
                currentValue !== recommendedPenaltyId
              ) {
                appliedPenaltyControl.setValue(recommendedPenaltyId);
              }
            }
          }
        }
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkPenalties));
  }

  private onAppliedPenaltyChange(penaltyId: string): void {
    this.selectedAppliedPenaltyId.set(String(penaltyId || ""));
    this.enforceAtFaultDriverSelection();
  }

  private enforceAtFaultDriverSelection(): void {
    const atFaultDriverControl = this.form.get("atFaultDriverId");
    if (!atFaultDriverControl) {
      return;
    }
    if (this.availablePenalties().length === 0) {
      return;
    }

    const isNoDriverSelected =
      atFaultDriverControl.value === this.NO_DRIVER_OPTION_VALUE;
    if (!isNoDriverSelected || this.selectedPenaltyAllowsNoDriver()) {
      return;
    }

    const reportedDriverId = this.report()?.reportedDriverId;
    atFaultDriverControl.setValue(
      reportedDriverId ? String(reportedDriverId) : "",
    );
  }

  penaltyRecommendations(): {
    penaltyId: string;
    penaltyName: string;
    count: number;
  }[] {
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
            count: 1,
          };
        }
      }
    });

    return Object.entries(counts)
      .map(([penaltyId, data]) => ({
        penaltyId,
        penaltyName: data.name,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const userId = this.authService.getUserId();
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const reportData = this.report();

    if (!reportData) {
      this.toast.error("Report not found");
      return;
    }

    const reportingUserId = reportData.reportingUserId;

    if (reportingUserId === userId) {
      this.toast.error("You cannot finalize a report you submitted");
      return;
    }

    const atFaultDriverId = this.form.get("atFaultDriverId")?.value;
    const isNoDriverAtFault = atFaultDriverId === this.NO_DRIVER_OPTION_VALUE;

    if (atFaultDriverId && !isNoDriverAtFault) {
      const atFaultDriver = await this.convex.query(
        this.convex.api.drivers.getById,
        { driverId: atFaultDriverId as any },
      );

      if (
        atFaultDriver?.userId &&
        String(atFaultDriver.userId) === String(userId)
      ) {
        this.toast.error(
          "You cannot finalize a report where you are the at-fault driver",
        );
        return;
      }
    }

    const hasSubmittedReview = reportData.reviews?.some(
      (review: any) => String(review.userId) === String(userId),
    );

    if (hasSubmittedReview) {
      this.toast.error(
        "You cannot finalize a report you have already reviewed",
      );
      return;
    }

    this.submitting.set(true);

    try {
      const formValue = this.form.value;
      const isNoDriverAtFault =
        formValue.atFaultDriverId === this.NO_DRIVER_OPTION_VALUE;

      if (reportData?.reviews && reportData.reviews.length > 0) {
        const latestReview = reportData.reviews.reduce(
          (latest: any, current: any) => {
            const latestDate = latest.reviewDate || latest.createdAt || 0;
            const currentDate = current.reviewDate || current.createdAt || 0;
            return currentDate > latestDate ? current : latest;
          },
        );

        if (latestReview?._id) {
          await this.convex.mutation(this.convex.api.reviews.update, {
            reviewId: latestReview._id,
            userId,
            candidateForStandardization:
              formValue.candidateForStandardization || false,
            isAdjusted: formValue.isAdjusted || false,
            adjustedReason:
              formValue.isAdjusted && formValue.adjustedReason
                ? formValue.adjustedReason
                : undefined,
          });
        }
      }

      const result = await this.convex.mutation(
        this.convex.api.reports.finalize,
        {
          reportId: this.reportId as any,
          userId,
          finalDecision: formValue.incidentDescription,
          appliedPenalty: formValue.appliedPenalty,
          atFaultDriverId: isNoDriverAtFault
            ? undefined
            : formValue.atFaultDriverId || undefined,
          isNoDriverAtFault,
          officialNotes: formValue.officialNotes || "",
          isSelfReport: formValue.isSelfReport || false,
          isAdjusted: formValue.isAdjusted || false,
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

      this.toast.success("Report finalized successfully");
      this.router.navigate(["/reports", this.reportId]);
    } catch (error: any) {
      this.toast.error(error.message || "Failed to finalize report");
    } finally {
      this.submitting.set(false);
    }
  }

  private extractUserFacingError(errorMessage: string): string {
    // Convex wraps errors with a prefix like:
    // "[CONVEX M(reports:finalize)] [Request ID: xxx] Server Error Uncaught UserFacingError: ..."
    // We want to extract just the part after "Uncaught UserFacingError: " or "Error: "
    if (!errorMessage) return "";

    // Try to extract UserFacingError message
    const userFacingMatch = errorMessage.match(
      /Uncaught UserFacingError:\s*(.+?)(?:\s+at\s+|$)/s,
    );
    if (userFacingMatch) {
      return userFacingMatch[1].trim();
    }

    // Try to extract regular Error message as fallback
    const errorMatch = errorMessage.match(/Error:\s*(.+?)(?:\s+at\s+|$)/s);
    if (errorMatch) {
      return errorMatch[1].trim();
    }

    // If no pattern matches, return original message
    return errorMessage;
  }

  async rejectReport(): Promise<void> {
    if (!this.rejectionReason) return;

    this.submitting.set(true);

    try {
      const result = await this.convex.mutation(
        this.convex.api.reports.reject,
        {
          reportId: this.reportId as any,
          finalDecision: this.rejectionReason,
        },
      );

      if (!result.success) {
        this.toast.error(result.error);
        this.submitting.set(false);
        return;
      }

      this.toast.success("Report rejected");
      this.showRejectModal = false;
      this.router.navigate(["/reviews", "finalization"]);
    } catch (error: any) {
      this.toast.error(error.message || "Failed to reject report");
    } finally {
      this.submitting.set(false);
    }
  }

  cancel(): void {
    this.navigationService.goBack(["/reviews", "finalization"]);
  }

  getSessionName(
    race: { sessionName?: string; raceNumber?: number } | null | undefined,
  ): string {
    if (race?.sessionName?.trim()) return race.sessionName.trim();
    if (typeof race?.raceNumber === "number") return `Race ${race.raceNumber}`;
    return "Session";
  }

  goBackToFinalization(): void {
    this.navigationService.goBack(["/reviews", "finalization"]);
  }
}

export interface MarkAsReviewedOption {
  value: boolean;
  label: string;
}
