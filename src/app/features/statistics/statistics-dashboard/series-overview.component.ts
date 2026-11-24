import { ChangeDetectionStrategy, Component, ElementRef, input, output, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { CardComponent } from "@shared/components/card/card.component";
import { BadgeComponent } from "@shared/components/badge/badge.component";
import { SelectComponent, SelectOption } from "@shared/components/select/select.component";
import { LegendComponent, LegendItem } from "@shared/components/legend/legend.component";
import type { DriverPointsRow, ImageExportRequest } from "./statistics-dashboard.models";
import { getSortIcon, getStripedRowClasses } from "./statistics-table.utils";

@Component({
  selector: "app-series-overview",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CardComponent, BadgeComponent, SelectComponent, LegendComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./series-overview.component.html",
  styles: `
    .export-container.export-active {
      padding: 2rem;
      min-width: 800px;
    }
  `,
})
export class SeriesOverviewComponent {
  readonly isExportMode = input.required<boolean>();
  readonly seriesPoints = input.required<DriverPointsRow[]>();
  readonly seriesOptions = input.required<SelectOption[]>();
  readonly selectedSeriesName = input.required<string>();
  readonly filteredAndSortedSeriesPoints = input.required<DriverPointsRow[]>();
  readonly seriesOverviewLegendItems = input.required<LegendItem[]>();
  readonly seriesSortColumn = input.required<keyof DriverPointsRow | "">();
  readonly seriesSortDirection = input.required<"asc" | "desc">();
  readonly selectedSeriesId = input.required<string>();
  readonly selectedSeriesIdChange = output<string>();
  readonly seriesFilterText = input.required<string>();
  readonly seriesFilterTextChange = output<string>();
  readonly sortChange = output<keyof DriverPointsRow>();
  readonly exportImage = output<ImageExportRequest>();

  @ViewChild("seriesOverviewExportContainer")
  private exportContainer?: ElementRef<HTMLElement>;

  protected requestExport(): void {
    const element = this.exportContainer?.nativeElement;
    if (element) {
      this.exportImage.emit({ element, filename: "series-overview.png" });
    }
  }

  protected readonly getSortIcon = getSortIcon;

  protected rowClasses(index: number): string {
    return getStripedRowClasses(index, this.isExportMode());
  }

}
