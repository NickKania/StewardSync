import { ChangeDetectionStrategy, Component, Input, output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ButtonComponent } from "@shared/components/button/button.component";
import type { Id } from "@convex/_generated/dataModel";
import type { SeriesForm } from "./series-management.models";

@Component({
  selector: "app-series-form-modal",
  standalone: true,
  imports: [FormsModule, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./series-form-modal.component.html",
})
export class SeriesFormModalComponent {
  @Input({ required: true }) editingSeriesId!: Id<"series"> | null;
  @Input({ required: true }) seriesForm!: SeriesForm;
  @Input({ required: true }) timezoneDisplay!: string;
  readonly save = output<void>();
  readonly close = output<void>();

}
