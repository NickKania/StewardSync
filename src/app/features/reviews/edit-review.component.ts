import { Component, computed, inject, input, OnDestroy, OnInit, output, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Doc, Id } from "@convex/_generated/dataModel";
import { AuthService } from "@core/services/auth.service";
import { ConvexService } from "@core/services/convex.service";
import { ToastService } from "@core/services/toast.service";
import { ButtonComponent } from "@shared/components/button/button.component";
import { SelectComponent } from "@shared/components/select/select.component";

export type EditableReview = Doc<"reviews"> & {
  recommendedPenaltyObj?: Doc<"penalties"> | null;
  linkedReview?: Doc<"reviews"> | null;
};

@Component({
  selector: "app-edit-review",
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, SelectComponent],
  template: `
    <form [formGroup]="form" (ngSubmit)="save()" class="space-y-5">
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Correct the steward assessment. @if (review().linkedReviewId) {
          Both stewards' linked reviews will be updated.
        }
        @if (isFinalized()) {
          This report is finalized. To change the final ruling or applied penalty, use Edit Finalized Decision separately.
        }
      </p>
      <div>
        <label for="review-incident-description" class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200">
          Incident Description <span class="text-danger">*</span>
        </label>
        <textarea id="review-incident-description" formControlName="incidentDescription" rows="5"
          class="block w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700"></textarea>
        @if (form.controls.incidentDescription.touched && form.controls.incidentDescription.invalid) {
          <p class="mt-1 text-sm text-danger">Incident description is required.</p>
        }
      </div>
      <app-select [id]="'review-at-fault-driver'" label="At-Fault Driver" formControlName="atFaultDriverId"
        [options]="driverOptions()" [required]="true" placeholder="Select a driver" />
      @if (driverError()) {
        <p role="alert" class="text-sm text-danger">{{ driverError() }}</p>
      }
      <div class="flex justify-end gap-3 pt-4">
        <app-button type="button" variant="secondary" [disabled]="submitting()" (onClick)="close.emit()">Cancel</app-button>
        <app-button type="submit" [loading]="submitting()"
          [disabled]="form.invalid || loading() || !!driverError() || submitting()">Save Changes</app-button>
      </div>
    </form>
  `,
})
export class EditReviewComponent implements OnInit, OnDestroy {
  readonly review = input.required<EditableReview>();
  readonly seriesId = input.required<Id<"series">>();
  readonly isFinalized = input(false);
  readonly submitting = signal(false);
  readonly success = output<void>();
  readonly close = output<void>();
  private readonly convex = inject(ConvexService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly drivers = signal<Doc<"drivers">[]>([]);
  readonly loading = signal(true);
  readonly driverError = signal("");
  readonly noDriverValue = "__NO_DRIVER__";
  readonly driverOptions = computed(() => {
    const options = this.drivers().map(driver => ({
      value: String(driver._id),
      label: `${driver.driverName}${driver.driverNumber === undefined ? "" : ` (#${driver.driverNumber})`}`,
    }));
    return this.review().recommendedPenaltyObj?.allowNoDriverAtFault
      ? [{ value: this.noDriverValue, label: "No Driver" }, ...options]
      : options;
  });
  readonly form = this.fb.nonNullable.group({
    incidentDescription: ["", [Validators.required, Validators.pattern(/\S/)]],
    atFaultDriverId: ["", Validators.required],
  });
  private destroyed = false;

  ngOnInit(): void {
    const review = this.review();
    this.form.setValue({
      incidentDescription: review.incidentDescription,
      atFaultDriverId: review.isNoDriverAtFault ? this.noDriverValue : review.atFaultDriverId ?? "",
    });
    void this.loadDrivers();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
  }

  private async loadDrivers(): Promise<void> {
    try {
      const drivers: Doc<"drivers">[] = await this.convex.query(
        this.convex.api.drivers.getByChampionship, { championshipId: this.seriesId() },
      );
      if (!this.destroyed) this.drivers.set(drivers);
    } catch (error) {
      console.error("Failed to load review drivers", error);
      this.driverError.set("Could not load drivers. Close the editor and try again.");
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    if (this.form.invalid || this.submitting() || this.loading() || this.driverError()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    try {
      const currentUserId = this.auth.getUserId();
      if (!currentUserId || !this.auth.hasRole("league_manager")) throw new Error("League manager access is required");
      const { incidentDescription, atFaultDriverId } = this.form.getRawValue();
      const isNoDriverAtFault = atFaultDriverId === this.noDriverValue;
      const result = await this.convex.mutation(this.convex.api.reviews.correct, {
        currentUserId,
        reviewId: this.review()._id,
        incidentDescription,
        atFaultDriverId: isNoDriverAtFault ? undefined : atFaultDriverId as Id<"drivers">,
        isNoDriverAtFault,
      });
      if (!result.success) {
        this.toast.error(result.error);
        return;
      }
      this.toast.success("Review updated successfully");
      this.success.emit();
    } catch (error) {
      console.error("Failed to update review", error);
      this.toast.error(error instanceof Error ? error.message : "Failed to update review");
    } finally {
      this.submitting.set(false);
    }
  }
}
