import { ChangeDetectionStrategy, Component, Input, output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ButtonComponent } from "@shared/components/button/button.component";
import type { Id } from "@convex/_generated/dataModel";
import type { PenaltyForm } from "./series-management.models";

@Component({
  selector: "app-penalty-form-modal",
  standalone: true,
  imports: [FormsModule, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./penalty-form-modal.component.html",
})
export class PenaltyFormModalComponent {
  @Input({ required: true }) editingPenaltyId!: Id<"penalties"> | null;
  @Input({ required: true }) penaltyForm!: PenaltyForm;
  readonly save = output<void>();
  readonly close = output<void>();

}
