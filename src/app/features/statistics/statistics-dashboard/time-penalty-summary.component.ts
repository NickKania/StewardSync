import { ChangeDetectionStrategy, Component, ElementRef, input, output, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { CardComponent } from "@shared/components/card/card.component";
import { BadgeComponent } from "@shared/components/badge/badge.component";
import { SelectComponent, SelectOption } from "@shared/components/select/select.component";
import type { ImageExportRequest, DriverTimePenaltyRow, RaceTimePenaltySummary, TimePenaltyEvent } from "./statistics-dashboard.models";
import { getSortIcon, getStripedRowClasses } from "./statistics-table.utils";

@Component({
  selector: "app-time-penalty-summary",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CardComponent, BadgeComponent, SelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./time-penalty-summary.component.html",
  styles: `
    .export-container.export-active {
      padding: 2rem;
      min-width: 800px;
    }
  `,
})
export class TimePenaltySummaryComponent {
  readonly isExportMode = input.required<boolean>();
  readonly timePenaltySummary = input.required<RaceTimePenaltySummary[]>();
  readonly seriesOptions = input.required<SelectOption[]>();
  readonly timePenaltyEventOptions = input.required<SelectOption[]>();
  readonly selectedTimePenaltySeries = input.required<{ name: string } | undefined>();
  readonly selectedTimePenaltyEvent = input.required<TimePenaltyEvent | undefined>();
  readonly filteredAndSortedTimePenaltySummary = input.required<RaceTimePenaltySummary[]>();
  readonly timePenaltySortColumn = input.required<Record<number, keyof DriverTimePenaltyRow>>();
  readonly timePenaltySortDirection = input.required<Record<number, "asc" | "desc">>();
  readonly timePenaltySeriesId = input.required<string>();
  readonly timePenaltySeriesIdChange = output<string>();
  readonly timePenaltyEventId = input.required<string>();
  readonly timePenaltyEventIdChange = output<string>();
  readonly timePenaltyFilterText = input.required<string>();
  readonly timePenaltyFilterTextChange = output<string>();
  readonly sortChange = output<{ raceNumber: number; column: keyof DriverTimePenaltyRow }>();
  readonly exportImage = output<ImageExportRequest>();

  @ViewChild("timePenaltySummaryExportContainer")
  private exportContainer?: ElementRef<HTMLElement>;

  protected requestExport(): void {
    const element = this.exportContainer?.nativeElement;
    if (element) {
      this.exportImage.emit({ element, filename: "time-penalty-summary.png" });
    }
  }

  protected readonly getSortIcon = getSortIcon;

  protected rowClasses(index: number): string {
    return getStripedRowClasses(index, this.isExportMode());
  }

  getTimePenaltyRaceSortColumn(
    raceNumber: number,
  ): keyof DriverTimePenaltyRow | "" {
    return this.timePenaltySortColumn()[raceNumber] ?? "";
  }

  getTimePenaltyRaceSortDirection(raceNumber: number): "asc" | "desc" {
    return this.timePenaltySortDirection()[raceNumber] ?? "asc";
  }

  getRaceTimePenaltyDrivers(raceId: string): DriverTimePenaltyRow[] {
    const race = this.filteredAndSortedTimePenaltySummary().find(
      (r) => r.raceId === raceId,
    );
    if (!race) return [];

    const raceNumber = race.raceNumber;
    const column = this.getTimePenaltyRaceSortColumn(raceNumber);
    const direction = this.getTimePenaltyRaceSortDirection(raceNumber);

    if (!column) return race.driverPenalties;

    return [...race.driverPenalties].sort((a, b) => {
      const aVal = a[column] ?? "";
      const bVal = b[column] ?? "";

      if (typeof aVal === "string" && typeof bVal === "string") {
        return direction === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });
  }
}
