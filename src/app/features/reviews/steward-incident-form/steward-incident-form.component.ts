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

        <div class="grid lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2">
            <form [formGroup]="form" (ngSubmit)="onSubmit()">
              <app-card title="Incident Details">
                <div class="space-y-4">
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
                      @for (event of events(); track event._id) {
                        <option [value]="event._id">
                          {{ event.trackName }} - {{ event.series.name }} Round
                          {{ event.eventNumber }}
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
                      placeholder="Enter lap number"
                      min="1"
                    />
                    @if (form.get("lap")?.invalid && form.get("lap")?.touched) {
                      <p class="mt-1 text-sm text-red-600">
                        Lap number is required and must be positive
                      </p>
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
                      placeholder="Enter turn number"
                      min="1"
                    />
                    @if (
                      form.get("turn")?.invalid && form.get("turn")?.touched
                    ) {
                      <p class="mt-1 text-sm text-red-600">
                        Turn number is required and must be positive
                      </p>
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
                     <select
                       formControlName="atFaultDriverId"
                       class="input"
                     >
                       <option value="">Select driver</option>
                       @for (
                         driver of drivers();
                         track driver._id
                       ) {
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
                   @if (form.get('isAdjusted')?.value) {
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
                      Stewards involved as drivers in this incident are excluded from the list
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
  availablePenalties = signal<Penalty[]>([]);
  loading = signal(true);
  submitting = signal(false);
  secondStewardId = signal<string>("");
  eventId = signal<string>("");
  raceId = signal<string>("");

  driverOptions = computed(() => {
    return this.drivers().map((driver) => ({
      value: driver._id,
      label: `#${driver.driverNumber} - ${driver.driverName}`,
    }));
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
    const reportedDriverId = this.form.get('reportedDriverId')?.value;

    // Get the reported driver to check their userId
    const reportedDriver = reportedDriverId
      ? this.drivers().find(d => d._id === reportedDriverId)
      : null;

    return [
      { value: "", label: "Reviewing alone" },
      ...this.stewards()
        .filter((steward) => {
          // Exclude current user
          if (String(steward._id) === String(currentUserId)) return false;

          // Exclude if steward is the reported driver
          if (reportedDriver?.userId && String(steward._id) === String(reportedDriver.userId)) {
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

  private unsubscribes: (() => void)[] = [];

  constructor() {
    this.form = this.fb.group({
      reportedDriverId: ["", Validators.required],
      eventId: ["", Validators.required],
      raceId: ["", Validators.required],
      lap: ["", [Validators.required, Validators.min(1)]],
      turn: ["", [Validators.required, Validators.min(1)]],
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
        // Clear saved event and race when createAnother is unchecked
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
    if (stewardId) {
      localStorage.setItem("selectedSecondSteward", stewardId);
    } else {
      localStorage.removeItem("selectedSecondSteward");
    }
  }

  async onEventChange(): Promise<void> {
    const eventId = this.form.get("eventId")?.value;
    this.form.get("raceId")?.setValue("");
    this.form.get("recommendedPenalty")?.setValue("");

    if (eventId) {
      await this.loadRaces(eventId);
      await this.loadPenalties(eventId);
    } else {
      this.races.set([]);
      this.availablePenalties.set([]);
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
          lap: parseInt(formValue.lap, 10),
          turn: parseInt(formValue.turn, 10),
          description: formValue.description,
          incidentDescription: formValue.incidentDescription,
          reviewNotes: formValue.reviewNotes || "",
          recommendedPenalty: formValue.recommendedPenalty,
          atFaultDriverId: formValue.atFaultDriverId || undefined,
          videoTimestamp: formValue.videoTimestamp || "",
          secondStewardId: formValue.secondStewardId || undefined,
          isSelfReport: formValue.isSelfReport || false,
          isAdjusted: formValue.isAdjusted || false,
          adjustedReason: formValue.isAdjusted && formValue.adjustedReason ? formValue.adjustedReason : undefined
        }
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
