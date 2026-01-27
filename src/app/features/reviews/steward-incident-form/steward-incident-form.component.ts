import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  computed,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";
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
import { Penalty } from "@core/models/series.model";
import { SelectOption } from "@shared/components/select/select.component";

@Component({
  selector: "app-steward-incident-form",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    LoadingComponent,
    SearchSelectComponent,
    ToggleComponent,
  ],
  template: `
    <div class="space-y-6">
      @if (loading()) {
        <app-loading text="Loading..." />
      } @else if (!isReportingOpen() && reportingStatusMessage()) {
        <div>
          <h1 class="text-2xl font-bold text-gray-900">
            Create Steward Incident
          </h1>
          <p class="text-gray-500 mt-1">
            File an incident report and submit review with penalty
            recommendation
          </p>
        </div>
        <app-card title="Reporting Unavailable">
          <div class="text-center py-8">
            <svg
              class="w-16 h-16 mx-auto text-yellow-500 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            <p class="text-lg font-semibold text-gray-900">
              {{ reportingStatusMessage() }}
            </p>
          </div>
        </app-card>
      } @else {
        <div>
          <h1 class="text-2xl font-bold text-gray-900">
            Create Steward Incident
          </h1>
          <p class="text-gray-500 mt-1">
            File an incident report and submit review with penalty
            recommendation
          </p>
        </div>

        @if (reportingStatusMessage()) {
          <div class="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
            <p class="text-sm text-blue-800 flex items-center gap-2">
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
              {{ reportingStatusMessage() }}
            </p>
          </div>
        }

        <div class="grid lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2">
            <form [formGroup]="form" (ngSubmit)="onSubmit()">
              <app-card title="Incident Details">
                <div class="space-y-4">
                  <div>
                    <label class="label">Series</label>
                    <select
                      formControlName="seriesId"
                      class="input"
                      [class.input-error]="
                        form.get('seriesId')?.invalid &&
                        form.get('seriesId')?.touched
                      "
                      (change)="onSeriesChange()"
                    >
                      <option value="">Select series</option>
                      @for (s of series(); track s._id) {
                        <option [value]="s._id">
                          {{ s.name }}
                        </option>
                      }
                    </select>
                  </div>
                  <div>
                    <app-search-select
                      formControlName="reportedDriverId"
                      label="Reported Driver"
                      [options]="driverOptions()"
                      [error]="
                        form.get('reportedDriverId')?.invalid &&
                        form.get('reportedDriverId')?.touched
                          ? 'Reported driver is required'
                          : ''
                      "
                      placeholder="Search drivers by name or number..."
                      [required]="true"
                    />
                  </div>

                  <div>
                    <label class="label">Event *</label>
                    <select
                      formControlName="eventId"
                      class="input"
                      [class.input-error]="
                        form.get('eventId')?.invalid &&
                        form.get('eventId')?.touched
                      "
                      (change)="onEventChange()"
                    >
                      <option value="">Select event</option>
                      @for (event of filteredEvents(); track event._id) {
                        <option [value]="event._id">
                          {{ event.trackName }} - Round {{ event.eventNumber }}
                        </option>
                      }
                    </select>
                    @if (
                      form.get("eventId")?.invalid &&
                      form.get("eventId")?.touched
                    ) {
                      <p class="mt-1 text-sm text-red-600">Event is required</p>
                    }
                  </div>

                  <div>
                    <label class="label">Race *</label>
                    <select
                      formControlName="raceId"
                      class="input"
                      [class.input-error]="
                        form.get('raceId')?.invalid &&
                        form.get('raceId')?.touched
                      "
                      [disabled]="!form.get('eventId')?.value"
                    >
                      <option value="">Select race</option>
                      @for (race of races(); track race._id) {
                        <option [value]="race._id">
                          Race {{ race.raceNumber }}
                        </option>
                      }
                    </select>
                    @if (
                      form.get("raceId")?.invalid && form.get("raceId")?.touched
                    ) {
                      <p class="mt-1 text-sm text-red-600">Race is required</p>
                    }
                  </div>

                  <div>
                    <label class="label">Lap Number *</label>
                    <input
                      type="number"
                      formControlName="lap"
                      class="input"
                      [class.input-error]="
                        form.get('lap')?.invalid && form.get('lap')?.touched
                      "
                      placeholder="Enter the lap"
                      min="1"
                    />
                    @if (form.get("lap")?.invalid && form.get("lap")?.touched) {
                      <p class="mt-1 text-sm text-red-600">Lap is required</p>
                    }
                  </div>

                  <div>
                    <label class="label">Turn Number *</label>
                    <input
                      type="number"
                      formControlName="turn"
                      class="input"
                      [class.input-error]="
                        form.get('turn')?.invalid && form.get('turn')?.touched
                      "
                      placeholder="Enter the turn"
                      min="1"
                    />
                    @if (
                      form.get("turn")?.invalid && form.get("turn")?.touched
                    ) {
                      <p class="mt-1 text-sm text-red-600">Turn is required</p>
                    }
                  </div>

                  <div>
                    <label class="label">Incident Description *</label>
                    <textarea
                      formControlName="incidentDescription"
                      class="input min-h-[100px]"
                      [class.input-error]="
                        form.get('incidentDescription')?.invalid &&
                        form.get('incidentDescription')?.touched
                      "
                      placeholder="Describe the incident details..."
                      rows="4"
                    ></textarea>
                    @if (
                      form.get("incidentDescription")?.invalid &&
                      form.get("incidentDescription")?.touched
                    ) {
                      <p class="mt-1 text-sm text-red-600">
                        Incident description is required (minimum 10 characters)
                      </p>
                    }
                  </div>

                  <div>
                    <label class="label">Review Notes</label>
                    <textarea
                      formControlName="reviewNotes"
                      class="input min-h-[120px]"
                      placeholder="Your assessment of the incident, findings, and observations..."
                      rows="5"
                    ></textarea>
                  </div>

                  <div>
                    <label class="label">Recommended Penalty *</label>
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
                    <p class="text-xs text-gray-500 mt-1">
                      Pre-selected to reported driver, change if different
                    </p>
                  </div>

                  <div>
                    <app-toggle
                      formControlName="isSelfReport"
                      label="Self Report"
                      hint="Driver self reported?"
                    />
                  </div>

                  <div>
                    <app-toggle
                      formControlName="isAdjusted"
                      label="Adjusted"
                      hint="Incident description was adjusted?"
                    />
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
                      <p class="text-xs text-gray-500 mt-1">
                        This will be added as a note to the incident description
                      </p>
                    </div>
                  }

                  <div>
                    <label class="label">Video Timestamp</label>
                    <input
                      type="text"
                      formControlName="videoTimestamp"
                      class="input"
                      placeholder="e.g., 1:23:45 or Lap 15, T3 Entry"
                    />
                  </div>

                  <div>
                    <app-search-select
                      formControlName="secondStewardId"
                      label="Second Steward (Optional)"
                      [options]="stewardOptions()"
                      placeholder="Search stewards by name..."
                    />
                    <p class="text-xs text-gray-500 mt-1">
                      Stewards involved as drivers in this incident are excluded
                      from the list
                    </p>
                  </div>
                </div>

                <div
                  card-footer
                  class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between gap-3"
                >
                  <app-button
                    type="button"
                    variant="secondary"
                    (onClick)="cancel()"
                  >
                    Cancel
                  </app-button>
                  <div class="flex gap-3 items-center">
                    <label
                      class="flex items-center gap-2 text-sm text-gray-700"
                    >
                      <input
                        type="checkbox"
                        formControlName="createAnother"
                        class="rounded border-gray-300"
                      />
                      Create another
                    </label>
                    <app-button
                      type="submit"
                      variant="primary"
                      [loading]="submitting()"
                      [disabled]="form.invalid"
                    >
                      Submit Incident
                    </app-button>
                    @if (canMarkAsReviewed()) {
                      <app-button
                        type="button"
                        variant="success"
                        [loading]="submitting()"
                        [disabled]="form.invalid"
                        (onClick)="submitAndMarkReviewed()"
                      >
                        Submit & Mark Reviewed
                      </app-button>
                    }
                  </div>
                </div>
              </app-card>
            </form>
          </div>

          <div class="space-y-6">
            <app-card title="Reporter Information">
              <dl class="space-y-4">
                <div>
                  <dt class="text-sm text-gray-500">Reporter</dt>
                  <div class="flex items-center gap-2">
                    <dd class="font-medium text-gray-900">
                      {{ currentUser()?.name }}
                    </dd>
                    <app-badge variant="info" size="sm">Steward</app-badge>
                  </div>
                </div>
              </dl>
            </app-card>

            @if (selectedEvent()) {
              <app-card title="Event Information">
                <dl class="space-y-2 text-sm">
                  <div>
                    <dt class="text-gray-500">Track</dt>
                    <dd class="font-medium text-gray-900">
                      {{ selectedEvent()?.trackName }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-gray-500">Series</dt>
                    <dd class="font-medium text-gray-900">
                      {{ selectedEvent()?.series.name }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-gray-500">Round</dt>
                    <dd class="font-medium text-gray-900">
                      Round {{ selectedEvent()?.eventNumber }}
                    </dd>
                  </div>
                </dl>
              </app-card>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class StewardIncidentFormComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private convex = inject(ConvexService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  form: FormGroup;

  drivers = signal<any[]>([]);
  events = signal<any[]>([]);
  races = signal<any[]>([]);
  stewards = signal<any[]>([]);
  series = signal<any[]>([]);
  availablePenalties = signal<Penalty[]>([]);
  loading = signal(true);
  submitting = signal(false);
  secondStewardId = signal<string>("");
  eventId = signal<string>("");
  raceId = signal<string>("");
  eventWithSeries = signal<any>(null);
  selectedSeriesId = signal<string>("");

  driverOptions = computed(() => {
    return this.drivers().map((driver) => ({
      value: driver._id,
      label: `#${driver.driverNumber} - ${driver.driverName}`,
    }));
  });

  filteredEvents = computed(() => {
    const selectedSeriesId = this.selectedSeriesId();
    if (!selectedSeriesId) {
      return [];
    }
    const filtered = this.events().filter((event) => {
      const match = String(event.seriesId) === String(selectedSeriesId);
      return match;
    });
    return filtered;
  });

  currentUser = computed(() => this.authService.user());
  selectedEvent = computed(() => {
    const eventId = this.form.get("eventId")?.value;
    return this.events().find((e) => e._id === eventId);
  });

  availableStewards = computed(() => {
    const currentUserId = this.authService.getUserId();
    if (!currentUserId) return this.stewards();

    return this.stewards().filter(
      (s) => String(s._id) !== String(currentUserId),
    );
  });

  stewardOptions = computed(() => {
    const currentUserId = this.authService.getUserId();
    const reportedDriverId = this.form.get("reportedDriverId")?.value;

    // Get the reported driver to check their userId
    const reportedDriver = reportedDriverId
      ? this.drivers().find((d) => d._id === reportedDriverId)
      : null;

    return [
      { value: "", label: "Reviewing alone" },
      ...this.stewards()
        .filter((steward) => {
          // Exclude current user
          if (String(steward._id) === String(currentUserId)) return false;

          // Exclude if steward is the reported driver
          if (
            reportedDriver?.userId &&
            String(steward._id) === String(reportedDriver.userId)
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

  canMarkAsReviewed = computed(() => {
    return !!this.secondStewardId();
  });

  isReportingOpen = computed(() => {
    const event = this.eventWithSeries();
    if (!event || !event.series) {
      return true;
    }

    const series = event.series;
    
    if (series.isReportingLocked === true) {
      return false;
    }

    if (!series.reportingOpenTime || !series.reportingCloseDuration) {
      return true;
    }

    const eventDate = new Date(event.eventDate);
    const [hours, minutes] = series.reportingOpenTime.split(":").map(Number);
    
    const openTime = new Date(eventDate);
    openTime.setUTCHours(hours, minutes, 0, 0);

    const closeTime = new Date(
      openTime.getTime() + series.reportingCloseDuration * 60 * 60 * 1000,
    );
    const now = new Date();

    return now >= openTime && now <= closeTime;
  });

  reportingStatusMessage = computed(() => {
    const event = this.eventWithSeries();
    if (!event || !event.series) {
      return "";
    }

    const series = event.series;
    
    if (series.isReportingLocked === true) {
      return 'Reports have been locked for this series';
    }

    if (!series.reportingOpenTime || !series.reportingCloseDuration) {
      return "";
    }

    const eventDate = new Date(event.eventDate);
    const [hours, minutes] = series.reportingOpenTime.split(":").map(Number);
    
    const openTime = new Date(eventDate);
    openTime.setUTCHours(hours, minutes, 0, 0);

    const closeTime = new Date(
      openTime.getTime() + series.reportingCloseDuration * 60 * 60 * 1000,
    );
    const now = new Date();

    if (now < openTime) {
      return `Reporting opens at ${openTime.toLocaleString()}`;
    } else if (now > closeTime) {
      return `Reporting is closed (closed at ${closeTime.toLocaleString()})`;
    } else {
      return `Reporting open until ${closeTime.toLocaleString()}`;
    }
  });

  private unsubscribes: (() => void)[] = [];

  constructor() {
    this.form = this.fb.group({
      seriesId: [""],
      reportedDriverId: ["", Validators.required],
      eventId: ["", Validators.required],
      raceId: ["", Validators.required],
      lap: ["", [Validators.required]],
      turn: ["", [Validators.required]],
      incidentDescription: [
        "",
        [Validators.required, Validators.minLength(10)],
      ],
      reviewNotes: [""],
      recommendedPenalty: ["", Validators.required],
      atFaultDriverId: [""],
      videoTimestamp: [""],
      secondStewardId: [""],
      isSelfReport: [false],
      isAdjusted: [false],
      adjustedReason: [""],
      createAnother: [false],
    });
  }

  ngOnInit(): void {
    this.loadData();
    this.loadSavedSteward();
    this.loadSavedCreateAnother();

    this.form.get("seriesId")?.valueChanges.subscribe((value) => {
      this.onSeriesChange();
      this.saveSeriesSelection(value);
    });

    this.form.get("secondStewardId")?.valueChanges.subscribe((value) => {
      this.secondStewardId.set(value);
      this.saveStewardSelection(value);
    });

    this.form.get("eventId")?.valueChanges.subscribe((value) => {
      this.eventId.set(value);
      this.saveEventSelection(value);
    });

    this.form.get("raceId")?.valueChanges.subscribe((value) => {
      this.raceId.set(value);
      this.saveRaceSelection(value);
    });

    this.form.get("createAnother")?.valueChanges.subscribe((value) => {
      localStorage.setItem("createAnother", value.toString());
      if (!value) {
        // Clear saved series, event and race when createAnother is unchecked
        localStorage.removeItem("stewardFormSeriesId");
        localStorage.removeItem("selectedEventId");
        localStorage.removeItem("selectedRaceId");
      }
    });

    // Pre-select atFaultDriverId when reportedDriverId changes
    this.form.get("reportedDriverId")?.valueChanges.subscribe((value) => {
      const atFaultDriverControl = this.form.get("atFaultDriverId");
      if (atFaultDriverControl && atFaultDriverControl.pristine) {
        atFaultDriverControl.setValue(value);
      }
    });
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach((unsub) => unsub());
  }

  private async loadData(): Promise<void> {
    const seriesQuery = this.convex.createReactiveQuery(
      this.convex.api.series.list,
      {},
    );
    this.unsubscribes.push(seriesQuery.unsubscribe);

    const checkSeries = setInterval(() => {
      const data = seriesQuery.data();
      if (data) {
        this.series.set(data);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkSeries));

    const driversQuery = this.convex.createReactiveQuery(
      this.convex.api.drivers.list,
      {},
    );
    this.unsubscribes.push(driversQuery.unsubscribe);

    const checkDrivers = setInterval(() => {
      const data = driversQuery.data();
      if (data) {
        this.drivers.set(data);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkDrivers));

    const eventsQuery = this.convex.createReactiveQuery(
      this.convex.api.events.list,
      {},
    );
    this.unsubscribes.push(eventsQuery.unsubscribe);

    const checkEvents = setInterval(() => {
      const data = eventsQuery.data();
      if (data) {
        this.events.set(data);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkEvents));

    this.loadStewards();
    this.loadSavedSeries();
    this.loading.set(false);
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
      this.secondStewardId.set(savedStewardId);
    } else {
      // Default to "Reviewing alone" (empty string)
      this.form.patchValue({ secondStewardId: "" });
      this.secondStewardId.set("");
    }
  }

  private loadSavedCreateAnother(): void {
    const savedCreateAnother = localStorage.getItem("createAnother");
    if (savedCreateAnother === "true") {
      this.form.patchValue({ createAnother: true });

      // Load saved event and race
      const savedEventId = localStorage.getItem("selectedEventId");
      const savedRaceId = localStorage.getItem("selectedRaceId");

      if (savedEventId) {
        this.form.patchValue({ eventId: savedEventId });
        this.eventId.set(savedEventId);
        this.loadRaces(savedEventId);
      }

      if (savedRaceId) {
        this.form.patchValue({ raceId: savedRaceId });
        this.raceId.set(savedRaceId);
      }
    }
  }

  private loadSavedSeries(): void {
    const savedSeriesId = localStorage.getItem("stewardFormSeriesId");
    if (savedSeriesId) {
      this.form.patchValue({ seriesId: savedSeriesId });
      this.selectedSeriesId.set(savedSeriesId);
      this.loadDriversBySeries(savedSeriesId);
    }
  }

  private saveEventSelection(eventId: string): void {
    if (eventId && this.form.get("createAnother")?.value) {
      localStorage.setItem("selectedEventId", eventId);
    } else if (!this.form.get("createAnother")?.value) {
      localStorage.removeItem("selectedEventId");
    }
  }

  private saveRaceSelection(raceId: string): void {
    if (raceId && this.form.get("createAnother")?.value) {
      localStorage.setItem("selectedRaceId", raceId);
    } else if (!this.form.get("createAnother")?.value) {
      localStorage.removeItem("selectedRaceId");
    }
  }

  private saveStewardSelection(stewardId: string): void {
    const reportedDriverId = this.form.get("reportedDriverId")?.value;
    const currentUserId = this.authService.getUserId();

    console.log(
      "[DEBUG STEWARD FORM] saveStewardSelection called with stewardId:",
      stewardId,
    );
    console.log("[DEBUG STEWARD FORM] Current userId:", currentUserId);

    if (!stewardId) {
      console.log(
        "[DEBUG STEWARD FORM] No stewardId provided, clearing saved value",
      );
      localStorage.removeItem("selectedSecondSteward");
      return;
    }

    if (!currentUserId) {
      console.log(
        "[DEBUG STEWARD FORM] No current user available, cannot validate conflict",
      );
      localStorage.setItem("selectedSecondSteward", stewardId);
      return;
    }

    const reportedDriver = reportedDriverId
      ? this.drivers().find((d) => d._id === reportedDriverId)
      : null;
    const reportedDriverUserId = reportedDriver?.userId;

    console.log("[DEBUG STEWARD FORM] Reported driver:", reportedDriver);
    console.log(
      "[DEBUG STEWARD FORM] Reported driver user ID:",
      reportedDriverUserId,
    );

    if (String(stewardId) === String(reportedDriverUserId)) {
      console.log(
        "[DEBUG STEWARD FORM] BLOCKING save - steward is reported driver",
      );
      localStorage.setItem("selectedSecondSteward", stewardId);
      return;
    }

    // Check if steward is current user (user shouldn't review their own review)
    if (String(stewardId) === String(currentUserId)) {
      console.log(
        "[DEBUG STEWARD FORM] BLOCKING save - steward is current user, user cannot review their own review",
      );
      localStorage.removeItem("selectedSecondSteward");
      return;
    }

    console.log("[DEBUG STEWARD FORM] Saving steward selection:", stewardId);
    localStorage.setItem("selectedSecondSteward", stewardId);
  }

  async onSeriesChange(): Promise<void> {
    const seriesId = this.form.get("seriesId")?.value;
    this.selectedSeriesId.set(seriesId);
    this.form.get("reportedDriverId")?.setValue("");
    this.form.get("eventId")?.setValue("");
    this.form.get("raceId")?.setValue("");
    this.form.get("recommendedPenalty")?.setValue("");

    if (seriesId) {
      await this.loadDriversBySeries(seriesId);
    } else {
      this.drivers.set([]);
      this.races.set([]);
      this.availablePenalties.set([]);
      this.eventWithSeries.set(null);
    }
  }

  private async loadDriversBySeries(seriesId: string): Promise<void> {
    try {
      const drivers = await this.convex.query(
        this.convex.api.drivers.getByChampionship,
        {
          championshipId: seriesId as any,
        },
      );
      this.drivers.set(drivers || []);
    } catch (error) {
      console.error("Failed to load drivers by series:", error);
      this.drivers.set([]);
    }
  }

  private saveSeriesSelection(seriesId: string): void {
    if (seriesId && this.form.get("createAnother")?.value) {
      localStorage.setItem("stewardFormSeriesId", seriesId);
    } else if (!this.form.get("createAnother")?.value) {
      localStorage.removeItem("stewardFormSeriesId");
    }
  }

  async onEventChange(): Promise<void> {
    const eventId = this.form.get("eventId")?.value;
    this.form.get("raceId")?.setValue("");
    this.form.get("recommendedPenalty")?.setValue("");

    if (eventId) {
      const event = this.events().find((e) => e._id === eventId);
      if (event?.seriesId) {
        this.selectedSeriesId.set(event.seriesId);
      }
      await this.loadRaces(eventId);
      await this.loadPenalties(eventId);
      await this.loadEventDetails(eventId);
    } else {
      this.races.set([]);
      this.availablePenalties.set([]);
      this.eventWithSeries.set(null);
    }
  }

  private async loadRaces(eventId: string): Promise<void> {
    try {
      const races = await this.convex.query(this.convex.api.races.getByEvent, {
        eventId: eventId as any,
      });
      this.races.set(races || []);
    } catch (error) {
      console.error("Failed to load races:", error);
    }
  }

  private async loadPenalties(eventId: string): Promise<void> {
    try {
      const event = this.events().find((e) => e._id === eventId);
      if (event?.seriesId) {
        const penalties = await this.convex.query(
          this.convex.api.penalties.getBySeries,
          { seriesId: event.seriesId as any },
        );
        this.availablePenalties.set(penalties || []);
      }
    } catch (error) {
      console.error("Failed to load penalties:", error);
    }
  }

  private async loadEventDetails(eventId: string): Promise<void> {
    try {
      const event = await this.convex.query(this.convex.api.events.getById, {
        eventId: eventId as any,
      });
      if (event && event.seriesId) {
        const series = await this.convex.query(this.convex.api.series.getById, {
          id: event.seriesId,
        });
        this.eventWithSeries.set({ ...event, series });
      } else {
        this.eventWithSeries.set(event);
      }
    } catch (error) {
      console.error("Failed to load event details:", error);
    }
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
        this.convex.api.reports.createBySteward,
        {
          reportingUserId: userId,
          reportedDriverId: formValue.reportedDriverId as any,
          eventId: formValue.eventId,
          raceId: formValue.raceId,
          lap: formValue.lap,
          turn: formValue.turn,
          description: formValue.description,
          incidentDescription: formValue.incidentDescription,
          reviewNotes: formValue.reviewNotes || "",
          recommendedPenalty: formValue.recommendedPenalty,
          atFaultDriverId: formValue.atFaultDriverId || undefined,
          videoTimestamp: formValue.videoTimestamp || "",
          secondStewardId: formValue.secondStewardId || undefined,
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

      this.toast.success("Incident created successfully");
      this.router.navigate(["/reports"]);
    } catch (error: any) {
      this.toast.error(error.message || "Failed to create incident");
    } finally {
      this.submitting.set(false);
    }
  }

  async submitAndMarkReviewed(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.form.get("secondStewardId")?.value) {
      this.toast.error("Second steward is required to mark as reviewed");
      return;
    }

    await this.onSubmit();
  }

  cancel(): void {
    this.router.navigate(["/reviews"]);
  }
}
