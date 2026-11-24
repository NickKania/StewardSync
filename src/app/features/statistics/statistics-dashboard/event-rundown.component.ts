import { ChangeDetectionStrategy, Component, ElementRef, input, output, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { CardComponent } from "@shared/components/card/card.component";
import { BadgeComponent } from "@shared/components/badge/badge.component";
import { SelectComponent, SelectOption } from "@shared/components/select/select.component";
import { LegendComponent, LegendItem } from "@shared/components/legend/legend.component";
import { ToggleComponent } from "@shared/components/toggle/toggle.component";
import type { EventDetails, EventRundownRow, ImageExportRequest, RaceRundown } from "./statistics-dashboard.models";
import { getSortIcon, getStripedRowClasses } from "./statistics-table.utils";

@Component({
  selector: "app-event-rundown",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CardComponent, BadgeComponent, SelectComponent, LegendComponent, ToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./event-rundown.component.html",
  styles: `
    .export-container.export-active {
      padding: 2rem;
      min-width: 800px;
    }
  `,
})
export class EventRundownComponent {
  readonly isExportMode = input.required<boolean>();
  readonly eventRundown = input.required<RaceRundown[]>();
  readonly eventOptions = input.required<SelectOption[]>();
  readonly selectedEventDetails = input.required<EventDetails | null>();
  readonly filteredAndSortedRaces = input.required<RaceRundown[]>();
  readonly legendItems = input.required<LegendItem[]>();
  readonly eventSortColumn = input.required<Record<number, keyof EventRundownRow>>();
  readonly eventSortDirection = input.required<Record<number, "asc" | "desc">>();
  readonly selectedEventId = input.required<string>();
  readonly selectedEventIdChange = output<string>();
  readonly eventFilterText = input.required<string>();
  readonly eventFilterTextChange = output<string>();
  readonly hideNoDriverAtFaultWithoutTicket = input.required<boolean>();
  readonly hideNoDriverAtFaultWithoutTicketChange = output<boolean>();
  readonly sortChange = output<{ raceNumber: number; column: keyof EventRundownRow }>();
  readonly exportImage = output<ImageExportRequest>();

  @ViewChild("eventRundownExportContainer")
  private exportContainer?: ElementRef<HTMLElement>;

  protected requestExport(): void {
    const element = this.exportContainer?.nativeElement;
    if (element) {
      this.exportImage.emit({ element, filename: "event-rundown.png" });
    }
  }

  protected readonly getSortIcon = getSortIcon;

  protected rowClasses(index: number): string {
    return getStripedRowClasses(index, this.isExportMode());
  }

  getRaceReports(raceId: string): EventRundownRow[] {
    const race = this.filteredAndSortedRaces().find((r) => r.raceId === raceId);
    if (!race) return [];

    const raceNumber = race.raceNumber;
    const column = this.getRaceSortColumn(raceNumber);
    const direction = this.getRaceSortDirection(raceNumber);

    if (!column) return race.reports;

    return [...race.reports].sort((a, b) => {
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

  getRaceSortColumn(raceNumber: number): keyof EventRundownRow | "" {
    return this.eventSortColumn()[raceNumber] ?? "";
  }

  getRaceSortDirection(raceNumber: number): "asc" | "desc" {
    return this.eventSortDirection()[raceNumber] ?? "asc";
  }
}
