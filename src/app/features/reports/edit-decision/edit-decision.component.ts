import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  signal,
  computed,
  Input,
  Output,
  EventEmitter,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormsModule,
} from "@angular/forms";
import { ConvexService } from "@core/services/convex.service";
import { AuthService } from "@core/services/auth.service";
import { ToastService } from "@core/services/toast.service";
import { ButtonComponent } from "@shared/components/button/button.component";
import { LoadingComponent } from "@shared/components/loading/loading.component";
import { SearchSelectComponent } from "@shared/components/search-select/search-select.component";
import { ToggleComponent } from "@shared/components/toggle/toggle.component";
import { SelectOption } from "@shared/components/select/select.component";
import { Penalty } from "@core/models/series.model";

@Component({
  selector: "app-edit-decision",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ButtonComponent,
    LoadingComponent,
    SearchSelectComponent,
    ToggleComponent,
  ],
  template: `
    <div class="space-y-6 text-gray-900 dark:text-gray-100">
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <div class="space-y-4">
          <!-- Decision description -->
          <div>
            <label class="label">Decision *</label>
            <textarea
              formControlName="finalDecision"
              class="input min-h-[100px]"
              [class.input-error]="
                form.get('finalDecision')?.invalid &&
                form.get('finalDecision')?.touched
              "
              placeholder="Describe the incident and decision..."
              rows="4"
            ></textarea>
            @if (
              form.get("finalDecision")?.invalid &&
              form.get("finalDecision")?.touched
            ) {
              <p class="mt-1 text-sm text-red-600">Decision is required</p>
            }
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
              @for (penalty of availablePenalties(); track penalty._id) {
                <option [value]="penalty._id">
                  {{ penalty.name }}
                </option>
              }
            </select>
            @if (
              form.get("appliedPenalty")?.invalid &&
              form.get("appliedPenalty")?.touched
            ) {
              <p class="mt-1 text-sm text-red-600">
                Penalty selection is required
              </p>
            }
            @if (availablePenalties().length === 0) {
              <p class="mt-1 text-sm text-yellow-600">
                No penalties configured for this series.
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
          </div>

          <!-- Self report toggle -->
          <div>
            <app-toggle
              formControlName="isSelfReport"
              label="Self Report"
              hint="Driver self reported?"
            />
          </div>

          <!-- Official notes -->
          <div>
            <label class="label">Official Notes *</label>
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
              <p class="mt-1 text-sm text-red-600">
                Official notes are required
              </p>
            }
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-3 pt-4">
          <app-button
            type="button"
            variant="secondary"
            (onClick)="close.emit()"
            [disabled]="submitting()"
          >
            Cancel
          </app-button>
          <app-button
            type="submit"
            variant="success"
            [loading]="submitting()"
            [disabled]="form.invalid || submitting()"
          >
            Update Decision
          </app-button>
        </div>
      </form>
    </div>
  `,
})
export class EditDecisionComponent implements OnInit, OnDestroy, OnChanges {
  @Input({ required: true }) report!: any;
  @Output() success = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();
  readonly NO_DRIVER_OPTION_VALUE = "__NO_DRIVER__";

  private fb = inject(FormBuilder);
  private convex = inject(ConvexService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);

  form: FormGroup;
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

  private unsubscribes: (() => void)[] = [];

  constructor() {
    this.form = this.fb.group({
      finalDecision: ["", Validators.required],
      appliedPenalty: ["", Validators.required],
      atFaultDriverId: [""],
      officialNotes: ["", Validators.required],
      isSelfReport: [false],
    });

    this.form
      .get("appliedPenalty")
      ?.valueChanges.subscribe((penaltyId: string) => {
        this.onAppliedPenaltyChange(penaltyId);
      });
  }

  ngOnInit(): void {
    this.loadDrivers();
    this.loadPenalties();
    if (this.report) {
      this.initializeForm();
    }
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach((unsub) => unsub());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["report"] && this.report) {
      this.loadPenalties();
    }
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
        this.initializeForm();
        clearInterval(checkDrivers);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkDrivers));
  }

  private loadPenalties(): void {
    if (!this.report?.event?.seriesId) {
      this.loading.set(false);
      return;
    }

    const penaltiesQuery = this.convex.createReactiveQuery(
      this.convex.api.penalties.getBySeries,
      { seriesId: this.report.event.seriesId as any },
    );
    this.unsubscribes.push(penaltiesQuery.unsubscribe);

    const checkPenalties = setInterval(() => {
      const data = penaltiesQuery.data();
      if (data !== undefined) {
        this.availablePenalties.set(data);
        this.enforceAtFaultDriverSelection();
        this.initializeForm();
        clearInterval(checkPenalties);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkPenalties));
  }

  private initializeForm(): void {
    if (this.report) {
      this.form.patchValue({
        finalDecision: this.report.finalDecision || "",
        appliedPenalty: this.report.appliedPenalty || "",
        atFaultDriverId: this.report.isNoDriverAtFault
          ? this.NO_DRIVER_OPTION_VALUE
          : this.report.atFaultDriverId
            ? String(this.report.atFaultDriverId)
            : "",
        officialNotes: this.report.officialNotes || "",
        isSelfReport: this.report.isSelfReport || false,
      });
      this.enforceAtFaultDriverSelection();
      this.loading.set(false);
    }
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

    const reportedDriverId = this.report?.reportedDriverId;
    atFaultDriverControl.setValue(
      reportedDriverId ? String(reportedDriverId) : "",
    );
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
      const isNoDriverAtFault =
        formValue.atFaultDriverId === this.NO_DRIVER_OPTION_VALUE;

      const result = (await this.convex.mutation(
        this.convex.api.reports.updateFinalizedDecision,
        {
          reportId: this.report._id,
          userId,
          finalDecision: formValue.finalDecision,
          appliedPenalty: formValue.appliedPenalty,
          atFaultDriverId: isNoDriverAtFault
            ? undefined
            : formValue.atFaultDriverId || undefined,
          isNoDriverAtFault,
          officialNotes: formValue.officialNotes,
          isSelfReport: formValue.isSelfReport || false,
        },
      )) as { success: boolean; error?: string; value?: any };

      if (!result.success) {
        this.toast.error(result.error || "Failed to update decision");
        this.submitting.set(false);
        return;
      }

      this.toast.success("Decision updated successfully");
      this.success.emit();
    } catch (error: any) {
      this.toast.error(error.message || "Failed to update decision");
    } finally {
      this.submitting.set(false);
    }
  }
}
