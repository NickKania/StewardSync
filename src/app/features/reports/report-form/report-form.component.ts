import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  Input,
  computed,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, ActivatedRoute } from "@angular/router";
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from "@angular/forms";
import { ConvexService } from "@core/services/convex.service";
import { ToastService } from "@core/services/toast.service";
import { AuthService } from "@core/services/auth.service";
import { CardComponent } from "@shared/components/card/card.component";
import { ButtonComponent } from "@shared/components/button/button.component";
import { InputComponent } from "@shared/components/input/input.component";
import {
  SelectComponent,
  SelectOption,
} from "@shared/components/select/select.component";
import { LoadingComponent } from "@shared/components/loading/loading.component";
import { SearchSelectComponent } from "@shared/components/search-select/search-select.component";

@Component({
  selector: "app-report-form",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardComponent,
    ButtonComponent,
    InputComponent,
    SelectComponent,
    LoadingComponent,
    SearchSelectComponent,
  ],
  template: `
    <div class="max-w-2xl mx-auto space-y-6">
      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {{ isEdit ? "Edit Report" : "File a Report" }}
        </h1>
        <p class="text-gray-500 mt-1 dark:text-gray-400">
          {{
            isEdit
              ? "Update the incident details"
              : "Submit an incident report for steward review"
          }}
        </p>
       </div>

       @if (loading()) {
         <app-loading text="Loading..." />
       } @else if (!isReportingOpen() && reportingStatusMessage()) {
         <app-card title="Reporting Unavailable">
           <div class="text-center py-8">
             <svg class="w-16 h-16 mx-auto text-yellow-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
             </svg>
             <p class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ reportingStatusMessage() }}</p>
           </div>
         </app-card>
       } @else {
         <form [formGroup]="form" (ngSubmit)="onSubmit()">
           @if (reportingStatusMessage()) {
             <div class="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
               <p class="text-sm text-blue-800 flex items-center gap-2">
                 <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                 </svg>
                 {{ reportingStatusMessage() }}
               </p>
             </div>
           }

            <app-card title="Incident Details">
             <div class="space-y-4">
               <!-- Series -->
               <div>
                 <label class="label">Series *</label>
                 <select
                   formControlName="seriesId"
                   class="input"
                   [class.input-error]="
                     form.get('seriesId')?.invalid && form.get('seriesId')?.touched
                   "
                   (change)="onSeriesChange(form.get('seriesId')?.value)"
                 >
                   <option value="">Select series</option>
                   @for (s of series(); track s._id) {
                     <option [value]="s._id">
                       {{ s.name }}
                     </option>
                   }
                 </select>
                 @if (
                   form.get("seriesId")?.invalid && form.get("seriesId")?.touched
                 ) {
                   <p class="mt-1 text-sm text-red-600">Series is required</p>
                 }
               </div>

               <!-- Reported Driver -->
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

               <!-- Event -->
               <div>
                 <label class="label">Event *</label>
                 <select
                   formControlName="eventId"
                   class="input"
                   [class.input-error]="
                     form.get('eventId')?.invalid && form.get('eventId')?.touched
                   "
                   (change)="onEventChange()"
                 >
                   <option value="">Select the event</option>
                   @for (event of filteredEvents(); track event._id) {
                     <option [value]="event._id">
                       {{ event.trackName }} - {{ event.series?.name }} Round
                       {{ event.eventNumber }}
                     </option>
                   }
                 </select>
                 @if (
                   form.get("eventId")?.invalid && form.get("eventId")?.touched
                 ) {
                   <p class="mt-1 text-sm text-red-600">Event is required</p>
                 }
               </div>

              <!-- Race -->
              <div>
                <label class="label">Race *</label>
                <select
                  formControlName="raceId"
                  class="input"
                  [class.input-error]="
                    form.get('raceId')?.invalid && form.get('raceId')?.touched
                  "
                  [disabled]="!form.get('eventId')?.value"
                >
                  <option value="">Select the race</option>
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

              <!-- Turn -->
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
                @if (form.get("turn")?.invalid && form.get("turn")?.touched) {
                  <p class="mt-1 text-sm text-red-600">
                    Turn is required
                  </p>
                }
              </div>

              <!-- Lap -->
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
                  <p class="mt-1 text-sm text-red-600">
                    Lap is required
                  </p>
                }
              </div>

              <!-- Description -->
              <div>
                <label class="label">Incident Description *</label>
                <textarea
                  formControlName="description"
                  class="input min-h-[120px]"
                  [class.input-error]="
                    form.get('description')?.invalid &&
                    form.get('description')?.touched
                  "
                  placeholder="Describe what happened during the incident..."
                  rows="5"
                ></textarea>
                @if (
                  form.get("description")?.invalid &&
                  form.get("description")?.touched
                ) {
                  <p class="mt-1 text-sm text-red-600">
                    Description is required (minimum 20 characters)
                  </p>
                }
              </div>
            </div>

             <!-- Footer -->
             <div
               card-footer
               class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between gap-3 dark:bg-gray-800 dark:border-gray-700"
             >
               <app-button
                 type="button"
                 variant="secondary"
                 (onClick)="cancel()"
               >
                 Cancel
               </app-button>
               @if (!isEdit) {
                 <div class="flex gap-3 items-center">
                   <label
                     class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                   >
                     <input
                       type="checkbox"
                       formControlName="createAnother"
                       class="rounded border-gray-300 dark:border-gray-700"
                     />
                     Create another
                   </label>
                   <app-button
                     type="submit"
                     variant="primary"
                     [loading]="submitting()"
                     [disabled]="form.invalid"
                   >
                     Submit Report
                   </app-button>
                 </div>
               } @else {
                 <app-button
                   type="submit"
                   variant="primary"
                   [loading]="submitting()"
                   [disabled]="form.invalid"
                 >
                   Update Report
                 </app-button>
               }
             </div>
          </app-card>
        </form>
      }
    </div>
  `,
})
export class ReportFormComponent implements OnInit, OnDestroy {
  @Input() id?: string;

  private fb = inject(FormBuilder);
  private convex = inject(ConvexService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);

  form: FormGroup;
  isEdit = false;

  series = signal<any[]>([]);
  drivers = signal<any[]>([]);
  events = signal<any[]>([]);
  races = signal<any[]>([]);
  selectedEvent = signal<any>(null);
  selectedSeriesId = signal<string>("");
  loading = signal(true);
  submitting = signal(false);

  driverOptions = computed<SelectOption[]>(() => {
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

  isReportingOpen = computed(() => {
    const event = this.selectedEvent();
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
    const [hours, minutes] = series.reportingOpenTime.split(':').map(Number);
    
    const openTime = new Date(eventDate);
    openTime.setUTCHours(hours, minutes, 0, 0);

    const closeTime = new Date(openTime.getTime() + series.reportingCloseDuration * 60 * 60 * 1000);
    const now = new Date();

    return now >= openTime && now <= closeTime;
  });

  reportingStatusMessage = computed(() => {
    const event = this.selectedEvent();
    if (!event || !event.series) {
      return '';
    }

    const series = event.series;
    
    if (series.isReportingLocked === true) {
      return 'Reports have been locked for this series';
    }

    if (!series.reportingOpenTime || !series.reportingCloseDuration) {
      return '';
    }

    const eventDate = new Date(event.eventDate);
    const [hours, minutes] = series.reportingOpenTime.split(':').map(Number);
    
    const openTime = new Date(eventDate);
    openTime.setUTCHours(hours, minutes, 0, 0);

    const closeTime = new Date(openTime.getTime() + series.reportingCloseDuration * 60 * 60 * 1000);
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
      seriesId: ["", Validators.required],
      reportedDriverId: ["", Validators.required],
      eventId: ["", Validators.required],
      raceId: ["", Validators.required],
      lap: ["", [Validators.required]],
      turn: ["", [Validators.required]],
      description: ["", [Validators.required, Validators.minLength(20)]],
      createAnother: [false],
    });
  }

  ngOnInit(): void {
    this.isEdit = !!this.id;
    this.loadData();

    if (!this.isEdit) {
      this.form.get("createAnother")?.valueChanges.subscribe((value) => {
        localStorage.setItem("reportFormCreateAnother", value.toString());
        if (!value) {
          localStorage.removeItem("reportFormSeriesId");
          localStorage.removeItem("reportFormSelectedEventId");
          localStorage.removeItem("reportFormSelectedRaceId");
        }
      });

      this.form.get("seriesId")?.valueChanges.subscribe((value) => {
        this.onSeriesChange(value);
        this.saveSeriesSelection(value);
      });

      this.form.get("eventId")?.valueChanges.subscribe((value) => {
        this.saveEventSelection(value);
      });

      this.form.get("raceId")?.valueChanges.subscribe((value) => {
        this.saveRaceSelection(value);
      });
    }
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach((unsub) => unsub());
  }

  private async loadData(): Promise<void> {
    // Load series
    const seriesQuery = this.convex.createReactiveQuery(
      this.convex.api.series.listActive,
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

    // Load all events (filtering done in computed)
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

    // If editing, load the report
    if (this.isEdit && this.id) {
      try {
        const report = await this.convex.query(
          this.convex.api.reports.getById,
          { reportId: this.id as any },
        );

        if (report) {
          // Load event details to get series
          const event = await this.convex.query(this.convex.api.events.getById, {
            eventId: report.eventId,
          });

          if (event && event.seriesId) {
            this.selectedSeriesId.set(event.seriesId);
            await this.loadDriversBySeries(event.seriesId);
          }

          this.form.patchValue({
            seriesId: event?.seriesId,
            reportedDriverId: report.reportedDriverId,
            eventId: report.eventId,
            raceId: report.raceId,
            lap: report.lap,
            turn: report.turn,
            description: report.description,
          });

          // Load races for the event
          await this.loadRaces(report.eventId);
        }
      } catch (error) {
        this.toast.error("Failed to load report");
        this.router.navigate(["/reports"]);
      }
    } else {
      this.loadSavedCreateAnother();
    }

    this.loading.set(false);
  }

  async onSeriesChange(seriesId: string): Promise<void> {
    this.selectedSeriesId.set(seriesId);
    this.form.get("reportedDriverId")?.setValue("");
    this.form.get("eventId")?.setValue("");
    this.form.get("raceId")?.setValue("");

    if (seriesId) {
      await this.loadDriversBySeries(seriesId);
    } else {
      this.drivers.set([]);
    }
  }

  async onEventChange(): Promise<void> {
    const eventId = this.form.get("eventId")?.value;
    this.form.get("raceId")?.setValue("");

    if (eventId) {
      await this.loadRaces(eventId);
      await this.loadEventDetails(eventId);
    } else {
      this.races.set([]);
      this.selectedEvent.set(null);
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

  private async loadDriversBySeries(seriesId: string): Promise<void> {
    try {
      const drivers = await this.convex.query(this.convex.api.drivers.getByChampionship, {
        championshipId: seriesId as any,
      });
      this.drivers.set(drivers || []);
    } catch (error) {
      console.error("Failed to load drivers by series:", error);
      this.drivers.set([]);
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
        this.selectedEvent.set({ ...event, series });
      } else {
        this.selectedEvent.set(event);
      }
    } catch (error) {
      console.error("Failed to load event details:", error);
    }
  }

  private saveSeriesSelection(seriesId: string): void {
    if (seriesId && this.form.get("createAnother")?.value) {
      localStorage.setItem("reportFormSeriesId", seriesId);
    } else if (!this.form.get("createAnother")?.value) {
      localStorage.removeItem("reportFormSeriesId");
    }
  }

  private saveEventSelection(eventId: string): void {
    if (eventId && this.form.get("createAnother")?.value) {
      localStorage.setItem("reportFormSelectedEventId", eventId);
    } else if (!this.form.get("createAnother")?.value) {
      localStorage.removeItem("reportFormSelectedEventId");
    }
  }

  private saveRaceSelection(raceId: string): void {
    if (raceId && this.form.get("createAnother")?.value) {
      localStorage.setItem("reportFormSelectedRaceId", raceId);
    } else if (!this.form.get("createAnother")?.value) {
      localStorage.removeItem("reportFormSelectedRaceId");
    }
  }

  private loadSavedCreateAnother(): void {
    const savedCreateAnother = localStorage.getItem("reportFormCreateAnother");
    if (savedCreateAnother === "true") {
      this.form.patchValue({ createAnother: true });

      const savedSeriesId = localStorage.getItem("reportFormSeriesId");
      const savedEventId = localStorage.getItem("reportFormSelectedEventId");
      const savedRaceId = localStorage.getItem("reportFormSelectedRaceId");

      if (savedSeriesId) {
        this.form.patchValue({ seriesId: savedSeriesId });
        this.selectedSeriesId.set(savedSeriesId);
        this.loadDriversBySeries(savedSeriesId);
      }

      if (savedEventId) {
        this.form.patchValue({ eventId: savedEventId });
        this.loadRaces(savedEventId);
      }

      if (savedRaceId) {
        this.form.patchValue({ raceId: savedRaceId });
      }
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);

    try {
      const formValue = this.form.value;

      if (this.isEdit && this.id) {
        await this.convex.mutation(this.convex.api.reports.update, {
          reportId: this.id as any,
          lap: formValue.lap,
          turn: formValue.turn,
          description: formValue.description,
        });
        this.toast.success("Report updated successfully");
      } else {
        const reportingUserId = this.authService.getUserId();
        if (!reportingUserId) {
          this.toast.error("User not authenticated");
          return;
        }
        await this.convex.mutation(this.convex.api.reports.create, {
          reportingUserId: reportingUserId,
          reportedDriverId: formValue.reportedDriverId,
          eventId: formValue.eventId,
          raceId: formValue.raceId,
          lap: formValue.lap,
          turn: formValue.turn,
          description: formValue.description,
        });
        this.toast.success("Report submitted successfully");
      }

      this.router.navigate(["/reports"]);
    } catch (error: any) {
      const errorMessage = this.extractUserFacingError(error.message);
      this.toast.error(errorMessage || "Failed to submit report");
    } finally {
      this.submitting.set(false);
    }
  }

  private extractUserFacingError(errorMessage: string): string {
    // Convex wraps errors with a prefix like:
    // "[CONVEX M(reports:create)] [Request ID: xxx] Server Error Uncaught UserFacingError: ..."
    // We want to extract just the part after "Uncaught UserFacingError: " or "Error: "
    if (!errorMessage) return "";

    // Try to extract UserFacingError message
    const userFacingMatch = errorMessage.match(/Uncaught UserFacingError:\s*(.+?)(?:\s+at\s+|$)/s);
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

  cancel(): void {
    this.router.navigate(["/reports"]);
  }
}
