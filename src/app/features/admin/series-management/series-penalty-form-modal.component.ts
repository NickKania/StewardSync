import { ChangeDetectionStrategy, Component, Input, output } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ButtonComponent } from "@shared/components/button/button.component";
import { LoadingComponent } from "@shared/components/loading/loading.component";
import { MultiSelectComponent, MultiSelectOption } from "@shared/components/multi-select/multi-select.component";
import type { Id } from "@convex/_generated/dataModel";
import type { DriverClass } from "@core/models/driver.model";
import type { SeriesPenaltyForm, PenaltyThresholdForm } from "./series-management.models";

@Component({
  selector: "app-series-penalty-form-modal",
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, LoadingComponent, MultiSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./series-penalty-form-modal.component.html",
})
export class SeriesPenaltyFormModalComponent {
  @Input({ required: true }) editingSeriesPenaltyId!: Id<"seriesPenalties"> | null;
  @Input({ required: true }) seriesPenaltyForm!: SeriesPenaltyForm;
  @Input({ required: true }) loadingDriverClasses!: boolean;
  @Input({ required: true }) thresholds!: PenaltyThresholdForm[];
  @Input({ required: true }) availableDriverClasses!: DriverClass[];
  readonly thresholdAdd = output<void>();
  readonly thresholdRemove = output<string>();
  readonly thresholdClassesChange = output<{ id: string; options: string[] }>();
  readonly save = output<void>();
  readonly close = output<void>();

  getDriverClassOptions(selectedClasses: string[]): MultiSelectOption[] {
    return this.availableDriverClasses.map((dc) => ({
      value: typeof dc._id === "string" ? dc._id : String(dc._id),
      label: String(dc.className || "Unknown"),
      selected: selectedClasses.includes(
        typeof dc._id === "string" ? dc._id : String(dc._id),
      ),
    }));
  }
}
