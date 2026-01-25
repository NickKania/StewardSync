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
        <h1 class="text-2xl font-bold text-gray-900">
          {{ isEdit ? "Edit Report" : "File a Report" }}
        </h1>
        <p class="text-gray-500 mt-1">
          {{
            isEdit
              ? "Update the incident details"
              : "Submit an incident report for steward review"
          }}
        </p>
      </div>

      @if (loading()) {
        <app-loading text="Loading..." />
      } @else {
        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <app-card title="Incident Details">
            <div class="space-y-4">
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
                  @for (event of events(); track event._id) {
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
                  placeholder="Enter the turn number"
                  min="1"
                />
                @if (form.get("turn")?.invalid && form.get("turn")?.touched) {
                  <p class="mt-1 text-sm text-red-600">
                    Turn number is required and must be positive
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
                  placeholder="Enter the lap number"
                  min="1"
                />
                @if (form.get("lap")?.invalid && form.get("lap")?.touched) {
                  <p class="mt-1 text-sm text-red-600">
                    Lap number is required and must be positive
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
              class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3"
            >
              <app-button
                type="button"
                variant="secondary"
                (onClick)="cancel()"
              >
                Cancel
              </app-button>
              <app-button
                type="submit"
                variant="primary"
                [loading]="submitting()"
                [disabled]="form.invalid"
              >
                {{ isEdit ? "Update Report" : "Submit Report" }}
              </app-button>
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

  drivers = signal<any[]>([]);
  events = signal<any[]>([]);
  races = signal<any[]>([]);
  loading = signal(true);
  submitting = signal(false);

  driverOptions = computed<SelectOption[]>(() => {
    return this.drivers().map((driver) => ({
      value: driver._id,
      label: `#${driver.driverNumber} - ${driver.driverName}`,
    }));
  });

  private unsubscribes: (() => void)[] = [];

  constructor() {
    this.form = this.fb.group({
      reportedDriverId: ["", Validators.required],
      eventId: ["", Validators.required],
      raceId: ["", Validators.required],
      lap: ["", [Validators.required, Validators.min(1)]],
      turn: ["", [Validators.required, Validators.min(1)]],
      description: ["", [Validators.required, Validators.minLength(20)]],
    });
  }

  ngOnInit(): void {
    this.isEdit = !!this.id;
    this.loadData();
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach((unsub) => unsub());
  }

  private async loadData(): Promise<void> {
    // Load drivers
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

    // Load events
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
          this.form.patchValue({
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
    }

    this.loading.set(false);
  }

  async onEventChange(): Promise<void> {
    const eventId = this.form.get("eventId")?.value;
    this.form.get("raceId")?.setValue("");

    if (eventId) {
      await this.loadRaces(eventId);
    } else {
      this.races.set([]);
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
          lap: parseInt(formValue.lap, 10),
          turn: parseInt(formValue.turn, 10),
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
          lap: parseInt(formValue.lap, 10),
          turn: parseInt(formValue.turn, 10),
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
