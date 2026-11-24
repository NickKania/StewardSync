import { ChangeDetectionStrategy, Component, Input, output } from "@angular/core";
import { ButtonComponent } from "@shared/components/button/button.component";
import type { ScheduledImportStatus } from "@core/models/series.model";
import { formatDaysOfWeek, formatSeriesDateRange } from "./scheduled-import.utils";

@Component({
  selector: "app-scheduled-import-section",
  host: { class: "block" },
  standalone: true,
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./scheduled-import-section.component.html",
})
export class ScheduledImportSectionComponent {
  @Input({ required: true }) status!: ScheduledImportStatus | undefined;
  readonly cancelSchedule = output<void>();
  readonly openSchedule = output<void>();

  formatNextRun(timestamp: number | null): string {
    if (!timestamp) return "Not scheduled";
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  protected readonly formatSeriesDateRange = formatSeriesDateRange;

  protected readonly formatDaysOfWeek = formatDaysOfWeek;
}
