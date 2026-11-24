import { ChangeDetectionStrategy, Component, Input, output } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ButtonComponent } from "@shared/components/button/button.component";
import { BadgeComponent } from "@shared/components/badge/badge.component";
import { LoadingComponent } from "@shared/components/loading/loading.component";
import type { Series, SeriesCopyPreview, SeriesCopyResult } from "@core/models/series.model";
import type { Id } from "@convex/_generated/dataModel";

@Component({
  selector: "app-copy-series-modal",
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, BadgeComponent, LoadingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./copy-series-modal.component.html",
})
export class CopySeriesModalComponent {
  @Input({ required: true }) copyTargetSeries!: Series | null;
  @Input({ required: true }) copySourceSeriesId!: Id<"series"> | "";
  @Input({ required: true }) copySourceSeriesOptions!: Series[];
  @Input({ required: true }) copyLoading!: boolean;
  @Input({ required: true }) copyPreview!: SeriesCopyPreview | null;
  @Input({ required: true }) copyResult!: SeriesCopyResult | null;
  readonly sourceChange = output<Id<"series"> | "">();
  readonly close = output<void>();
  readonly preview = output<void>();
  readonly execute = output<void>();

  copySeriesPenaltiesToCreate(preview: SeriesCopyPreview): number {
    return preview.seriesPenalties.filter((seriesPenalty) => !seriesPenalty.alreadyExists).length;
  }

  copyThresholdCount(preview: SeriesCopyPreview): number {
    return preview.seriesPenalties
      .filter((seriesPenalty) => !seriesPenalty.alreadyExists)
      .reduce((total, seriesPenalty) => total + seriesPenalty.thresholds.length, 0);
  }

  copySessionCount(preview: SeriesCopyPreview): number {
    return Object.values(preview.sessions.byEvent).reduce(
      (total, event) => total + event.toCreate.length,
      0,
    );
  }

  copySessionEvents(preview: SeriesCopyPreview): Array<{
    eventNumber: number;
    sessions: string[];
  }> {
    return Object.entries(preview.sessions.byEvent)
      .map(([eventNumber, event]) => ({
        eventNumber: Number(eventNumber),
        sessions: event.toCreate.map((session) => session.sessionName || `Race ${session.raceNumber}`),
      }))
      .filter((event) => event.sessions.length > 0)
      .sort((a, b) => a.eventNumber - b.eventNumber);
  }
}
