import {
  Component,
  DestroyRef,
  ElementRef,
  HostBinding,
  inject,
  Input,
  OnDestroy,
  OnInit,
  QueryList,
  signal,
  untracked,
  ViewChild,
  ViewChildren,
  computed,
  effect,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { ActivatedRoute, Router } from "@angular/router";
import { toPng } from "html-to-image";
import { debounceTime, Subject } from "rxjs";
import { ConvexService } from "@core/services/convex.service";
import { AuthService } from "@core/services/auth.service";
import { SidebarStateService } from "@core/services/sidebar-state.service";
import { STATISTICS_TABS, StatisticsTabId } from "@core/models";
import { BadgeComponent } from "@shared/components/badge/badge.component";
import { ButtonComponent } from "@shared/components/button/button.component";
import { CardComponent } from "@shared/components/card/card.component";
import { LoadingComponent } from "@shared/components/loading/loading.component";
import {
  LegendComponent,
  LegendItem,
} from "@shared/components/legend/legend.component";
import {
  SelectComponent,
  SelectOption,
} from "@shared/components/select/select.component";
import { TabsComponent, Tab } from "@shared/components/tabs/tabs.component";
import { ToggleComponent } from "@shared/components/toggle/toggle.component";

interface EventRundownRow {
  reportId: string | number | null;
  driverId: string | null;
  carNumber: number | null;
  driverName: string | null;
  driverClass: string | null;
  lap: string | null;
  turn: string | null;
  incidentDescription: string;
  adjustedReason?: string;
  penaltyName: string | null;
  penaltyAllowsNoDriverAtFault: boolean;
  timePenaltySeconds: number;
  licensePoints: number | null;
  isSelfReport: boolean;
  isFinalized: boolean;
}

interface RaceRundown {
  raceId: string;
  raceNumber: number;
  raceName: string;
  reports: EventRundownRow[];
}

interface DriverPointsRow {
  driverId: string;
  driverNumber: number;
  driverName: string;
  driverClass: string;
  totalLicensePoints: number;
  eligibleSeriesPenalties?: any[];
  seriesPenalties?: any[];
}

interface SeriesPenaltyDefinition {
  _id: string;
  penaltyName: string;
  thresholds?: Array<{
    _id: string;
    threshold: number;
    driverClassObjects?: Array<{ displayName?: string }>;
  }>;
}

interface DriverTimePenaltyRow {
  driverId: string;
  carNumber: number;
  driverName: string;
  driverClass: string;
  totalTimePenaltySeconds: number;
}

interface RaceTimePenaltySummary {
  raceId: string;
  raceNumber: number;
  raceName: string;
  driverPenalties: DriverTimePenaltyRow[];
}

@Component({
  selector: "app-statistics-dashboard",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    CardComponent,
    BadgeComponent,
    LoadingComponent,
    ButtonComponent,
    SelectComponent,
    TabsComponent,
    LegendComponent,
    ToggleComponent,
  ],
  template: `
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Statistics
      </h1>

      @if (loading()) {
        <div>
          <app-loading text="Loading..." />
        </div>
      } @else {
        <!-- Normal Mode: Show Tabs -->
        @if (!isExportMode()) {
          <app-tabs
            [tabs]="visibleTabs()"
            [activeTab]="activeTab()"
            (activeTabChange)="selectTab($event)"
          />
        }

        <!-- Export Mode: Show Header -->
        @if (isExportMode()) {
          <div
            class="export-header bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
          >
            <div class="text-lg font-semibold text-gray-900 dark:text-gray-100">
              @if (activeTab() === STATISTICS_TABS.EVENT_RUNDOWN) {
                Event Rundown
              } @else if (activeTab() === STATISTICS_TABS.SERIES_OVERVIEW) {
                Series Overview - License Points
              } @else if (activeTab() === STATISTICS_TABS.TIME_PENALTY_SUMMARY) {
                Time Penalty Summary
              }
            </div>
          </div>
        }

        <!-- Content Area -->
        <div
          [class]="
            isExportMode()
              ? 'export-body bg-gray-50 dark:bg-gray-900'
              : 'space-y-6'
          "
        >
          @if (activeTab() === STATISTICS_TABS.EVENT_RUNDOWN) {
            <div class="space-y-6">
              <app-card>
                <div
                  class="px-6 py-4 border-b border-gray-200 flex items-center justify-between dark:border-gray-700"
                >
                  <h3
                    class="text-lg font-semibold text-gray-900 dark:text-gray-100"
                  >
                    Event Rundown
                  </h3>
                  <button
                    (click)="
                      exportTableImage(
                        eventRundownExportContainer,
                        'event-rundown.png'
                      )
                    "
                    class="text-gray-500 hover:text-gray-700 transition-colors p-1 rounded hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
                  >
                    <svg
                      class="h-5 w-5"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                  </button>
                </div>
                <div class="px-6 py-4 space-y-4">
                  @if (!isExportMode()) {
                    <div>
                      <label class="label">Select Event</label>
                      <app-select
                        [options]="eventOptions()"
                        [(ngModel)]="selectedEventId"
                        (ngModelChange)="loadEventRundown()"
                        placeholder="Choose an event"
                      />
                    </div>
                  }

                  @if (eventRundown().length > 0) {
                    @if (!isExportMode()) {
                      <div class="flex items-center justify-between mb-4 gap-4">
                        <div class="flex-1 max-w-md">
                          <input
                            type="text"
                            class="input w-full"
                            placeholder="Filter by any field..."
                            [(ngModel)]="eventFilterText"
                          />
                        </div>
                        <app-toggle
                          [(ngModel)]="hideNoDriverAtFaultWithoutTicket"
                          hint="Hide incidents without ticket and no at fault driver"
                        ></app-toggle>
                      </div>
                    }

                    <div
                      #eventRundownExportContainer
                      class="export-container bg-white dark:bg-gray-900"
                    >
                      @if (isExportMode() && selectedEventDetails()) {
                        <div
                          class="mb-4 border-b border-gray-200 pb-3 dark:border-gray-700"
                        >
                          <p
                            class="text-xl font-semibold text-gray-900 dark:text-gray-100"
                          >
                            {{ selectedEventDetails()?.seriesName }}
                          </p>
                          <p
                            class="text-lg font-semibold text-gray-800 dark:text-gray-200"
                          >
                            {{ selectedEventDetails()?.eventName }}
                          </p>
                        </div>
                      }
                      @for (
                        race of filteredAndSortedRaces();
                        track race.raceId
                      ) {
                        <div class="space-y-4">
                          <div class="flex items-center gap-2 pt-4">
                            <h3
                              class="text-lg font-semibold text-gray-900 dark:text-gray-100"
                            >
                              {{ race.raceName }}
                            </h3>
                          </div>
                          @if (getRaceReports(race.raceId).length > 0) {
                            <div #eventRundownTable class="overflow-x-auto">
                              <table
                                class="w-full text-sm border border-gray-300 dark:border-gray-700"
                              >
                                <thead
                                  class="bg-gray-50 border-b border-gray-300 dark:bg-gray-800 dark:border-gray-700"
                                >
                                  <tr>
                                    <th
                                      class="w-[5%] border-r border-gray-300 px-1.5 py-2 font-bold text-gray-500 text-center align-middle leading-tight text-xs dark:border-gray-700 dark:text-gray-400"
                                    >
                                      Ticket #
                                    </th>
                                    <th
                                      class="w-[5%] border-r border-gray-300 px-1.5 py-2 font-bold text-gray-500 text-center cursor-pointer hover:text-gray-700 align-middle leading-tight text-xs dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                      (click)="
                                        sortEventRundown(
                                          race.raceNumber,
                                          'carNumber'
                                        )
                                      "
                                    >
                                      Car #
                                      {{
                                        getSortIcon(
                                          "carNumber",
                                          getRaceSortColumn(race.raceNumber),
                                          getRaceSortDirection(race.raceNumber)
                                        )
                                      }}
                                    </th>
                                    <th
                                      class="w-[10%] border-r border-gray-300 px-3 py-2 font-bold text-gray-500 text-left cursor-pointer hover:text-gray-700 align-middle leading-tight text-xs dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                      (click)="
                                        sortEventRundown(
                                          race.raceNumber,
                                          'driverName'
                                        )
                                      "
                                    >
                                      Driver
                                      {{
                                        getSortIcon(
                                          "driverName",
                                          getRaceSortColumn(race.raceNumber),
                                          getRaceSortDirection(race.raceNumber)
                                        )
                                      }}
                                    </th>
                                    <th
                                      class="w-[8%] border-r border-gray-300 px-3 py-2 font-bold text-gray-500 text-left cursor-pointer hover:text-gray-700 align-middle leading-tight text-xs dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                      (click)="
                                        sortEventRundown(
                                          race.raceNumber,
                                          'driverClass'
                                        )
                                      "
                                    >
                                      Class
                                      {{
                                        getSortIcon(
                                          "driverClass",
                                          getRaceSortColumn(race.raceNumber),
                                          getRaceSortDirection(race.raceNumber)
                                        )
                                      }}
                                    </th>
                                    <th
                                      class="w-[3%] border-r border-gray-300 px-1.5 py-2 font-bold text-gray-500 text-center cursor-pointer hover:text-gray-700 align-middle leading-tight text-xs dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                      (click)="
                                        sortEventRundown(race.raceNumber, 'lap')
                                      "
                                    >
                                      Lap
                                      {{
                                        getSortIcon(
                                          "lap",
                                          getRaceSortColumn(race.raceNumber),
                                          getRaceSortDirection(race.raceNumber)
                                        )
                                      }}
                                    </th>
                                    <th
                                      class="w-[3%] border-r border-gray-300 px-1.5 py-2 font-bold text-gray-500 text-center cursor-pointer hover:text-gray-700 align-middle leading-tight text-xs dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                      (click)="
                                        sortEventRundown(
                                          race.raceNumber,
                                          'turn'
                                        )
                                      "
                                    >
                                      Turn
                                      {{
                                        getSortIcon(
                                          "turn",
                                          getRaceSortColumn(race.raceNumber),
                                          getRaceSortDirection(race.raceNumber)
                                        )
                                      }}
                                    </th>
                                    <th
                                      class="w-[47%] border-r border-gray-300 px-3 py-2 font-bold text-gray-500 text-left cursor-pointer hover:text-gray-700 align-middle leading-tight text-xs dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                      (click)="
                                        sortEventRundown(
                                          race.raceNumber,
                                          'incidentDescription'
                                        )
                                      "
                                    >
                                      Incident Description
                                      {{
                                        getSortIcon(
                                          "incidentDescription",
                                          getRaceSortColumn(race.raceNumber),
                                          getRaceSortDirection(race.raceNumber)
                                        )
                                      }}
                                    </th>
                                    <th
                                      class="w-[8%] border-r border-gray-300 px-3 py-2 font-bold text-gray-500 text-center cursor-pointer hover:text-gray-700 align-middle leading-tight text-xs dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                      (click)="
                                        sortEventRundown(
                                          race.raceNumber,
                                          'penaltyName'
                                        )
                                      "
                                    >
                                      Penalty
                                      {{
                                        getSortIcon(
                                          "penaltyName",
                                          getRaceSortColumn(race.raceNumber),
                                          getRaceSortDirection(race.raceNumber)
                                        )
                                      }}
                                    </th>
                                    <th
                                      class="w-[8%] border-r border-gray-300 px-1.5 py-2 font-bold text-gray-500 text-center cursor-pointer hover:text-gray-700 align-middle leading-tight text-xs dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                      (click)="
                                        sortEventRundown(
                                          race.raceNumber,
                                          'timePenaltySeconds'
                                        )
                                      "
                                    >
                                      Time Penalty
                                      {{
                                        getSortIcon(
                                          "timePenaltySeconds",
                                          getRaceSortColumn(race.raceNumber),
                                          getRaceSortDirection(race.raceNumber)
                                        )
                                      }}
                                    </th>
                                    <th
                                      class="w-[3%] px-1.5 py-2 font-bold text-gray-500 text-center cursor-pointer hover:text-gray-700 align-middle leading-tight text-xs dark:text-gray-400 dark:hover:text-gray-200"
                                      (click)="
                                        sortEventRundown(
                                          race.raceNumber,
                                          'licensePoints'
                                        )
                                      "
                                    >
                                      License Points
                                      {{
                                        getSortIcon(
                                          "licensePoints",
                                          getRaceSortColumn(race.raceNumber),
                                          getRaceSortDirection(race.raceNumber)
                                        )
                                      }}
                                    </th>
                                  </tr>
                                </thead>
                                <tbody
                                  class="divide-y divide-gray-100 dark:divide-gray-800"
                                >
                                  @for (
                                    row of getRaceReports(race.raceId);
                                    track row.reportId;
                                    let i = $index
                                  ) {
                                    <tr
                                      [class]="
                                        getStripedRowClasses(i) +
                                        (!row.isFinalized
                                          ? ' bg-danger-bg'
                                          : '')
                                      "
                                    >
                                      <td
                                        class="w-[5%] border-r border-gray-300 px-1.5 py-2 text-center align-middle leading-tight text-xs dark:border-gray-700"
                                      >
                                        {{ row.reportId || "-" }}
                                      </td>
                                      <td
                                        class="w-[5%] border-r border-gray-300 px-1.5 py-2 text-center align-middle leading-tight text-xs dark:border-gray-700"
                                      >
                                        {{ row.carNumber ?? "-" }}
                                      </td>
                                      <td
                                        class="w-[10%] border-r border-gray-300 px-3 py-2 font-medium text-left align-middle leading-tight text-xs dark:border-gray-700"
                                      >
                                        @if (row.driverId) {
                                          <a
                                            [routerLink]="[
                                              '/drivers',
                                              row.driverId,
                                            ]"
                                            class="text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                                          >
                                            {{ row.driverName ?? "-" }}
                                          </a>
                                        } @else {
                                          <span
                                            class="text-gray-900 dark:text-gray-100"
                                          >
                                            {{ row.driverName ?? "-" }}
                                          </span>
                                        }
                                      </td>
                                      <td
                                        class="w-[8%] border-r border-gray-300 px-3 py-2 text-gray-600 text-left align-middle leading-tight text-xs dark:border-gray-700 dark:text-gray-300"
                                      >
                                        {{ row.driverClass ?? "-" }}
                                      </td>
                                      <td
                                        class="w-[3%] border-r border-gray-300 px-1.5 py-2 text-center align-middle leading-tight text-xs dark:border-gray-700"
                                      >
                                        {{ row.lap ?? "-" }}
                                      </td>
                                      <td
                                        class="w-[3%] border-r border-gray-300 px-1.5 py-2 text-center align-middle leading-tight text-xs dark:border-gray-700"
                                      >
                                        {{ row.turn ?? "-" }}
                                      </td>
                                      <td
                                        class="w-[47%] border-r border-gray-300 px-3 py-2 text-gray-700 text-left align-middle leading-tight text-xs dark:border-gray-700 dark:text-gray-300"
                                      >
                                        <div class="whitespace-pre-wrap">
                                          {{ row.incidentDescription }}
                                        </div>
                                        @if (row.adjustedReason) {
                                          <div
                                            class="mt-0.5 whitespace-pre-wrap italic"
                                          >
                                            [Reason for adjustment:
                                            {{ row.adjustedReason }}]
                                          </div>
                                        }
                                      </td>
                                      <td
                                        class="w-[8%] border-r border-gray-300 px-3 py-2 text-center align-middle leading-tight text-xs dark:border-gray-700"
                                      >
                                        @if (row.penaltyName) {
                                          <span
                                            class="text-gray-700 dark:text-gray-300"
                                          >
                                            {{ row.penaltyName }}
                                          </span>
                                        } @else {
                                          <span
                                            class="text-gray-400 dark:text-gray-500"
                                            >-</span
                                          >
                                        }
                                      </td>
                                      <td
                                        class="w-[8%] border-r border-gray-300 px-1.5 py-2 text-center align-middle leading-tight text-xs dark:border-gray-700"
                                      >
                                        @if (row.timePenaltySeconds > 0) {
                                          <app-badge
                                            [variant]="
                                              row.isSelfReport
                                                ? 'success'
                                                : 'default'
                                            "
                                          >
                                            {{ row.timePenaltySeconds }}s
                                            @if (row.isSelfReport) {
                                              (SR)
                                            }
                                          </app-badge>
                                        } @else {
                                          <span
                                            class="text-gray-400 dark:text-gray-500"
                                            >-</span
                                          >
                                        }
                                      </td>
                                      <td
                                        class="w-[3%] px-1.5 py-2 text-center align-middle leading-tight text-xs"
                                      >
                                        @if (
                                          row.licensePoints &&
                                          row.licensePoints > 0
                                        ) {
                                          {{ row.licensePoints }}
                                        } @else {
                                          <span
                                            class="text-gray-400 dark:text-gray-500"
                                            >-</span
                                          >
                                        }
                                      </td>
                                    </tr>
                                  }
                                </tbody>
                              </table>
                            </div>
                          } @else {
                            <p
                              class="text-gray-500 text-center py-4 dark:text-gray-400"
                            >
                              No reviewed reports
                            </p>
                          }
                        </div>
                      }

                      @if (!isExportMode() && activeTab() === STATISTICS_TABS.EVENT_RUNDOWN) {
                        <div
                          class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700"
                        >
                          <app-legend
                            [items]="legendItems()"
                            [title]="legendItems().length > 0 ? 'Legend' : ''"
                          />
                          @if (hideNoDriverAtFaultWithoutTicket()) {
                            <p
                              class="mt-2 text-sm font-medium text-danger"
                            >
                              Incidents with no at-fault driver and no ticket
                              are hidden
                            </p>
                          }
                        </div>
                      }

                      @if (isExportMode()) {
                        <div
                          class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700"
                        >
                          <app-legend
                            [items]="legendItems()"
                            [title]="legendItems().length > 0 ? 'Legend' : ''"
                          />
                          @if (hideNoDriverAtFaultWithoutTicket()) {
                            <p
                              class="mt-2 text-sm font-medium text-danger"
                            >
                              Incidents with no at-fault driver and no ticket
                              are hidden
                            </p>
                          }
                        </div>
                      }
                    </div>
                  } @else if (selectedEventId) {
                    <p
                      class="text-gray-500 text-center py-4 dark:text-gray-400"
                    >
                      No finalized reports for this event
                    </p>
                  } @else {
                    <p
                      class="text-gray-500 text-center py-4 dark:text-gray-400"
                    >
                      Select an event to view reports
                    </p>
                  }
                </div>
              </app-card>
            </div>
          }

          @if (activeTab() === STATISTICS_TABS.SERIES_OVERVIEW && canViewSeriesStats()) {
            <div class="space-y-6">
              <app-card>
                <div
                  class="px-6 py-4 border-b border-gray-200 flex items-center justify-between dark:border-gray-700"
                >
                  <h3
                    class="text-lg font-semibold text-gray-900 dark:text-gray-100"
                  >
                    Series Overview - License Points
                  </h3>
                  <button
                    (click)="
                      exportTableImage(
                        seriesOverviewExportContainer,
                        'series-overview.png'
                      )
                    "
                    class="text-gray-500 hover:text-gray-700 transition-colors p-1 rounded hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
                  >
                    <svg
                      class="h-5 w-5"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                  </button>
                </div>
                <div class="px-6 py-4 space-y-4">
                  @if (!isExportMode()) {
                    <div>
                      <label class="label">Select Series</label>
                      <app-select
                        [options]="seriesOptions()"
                        [(ngModel)]="selectedSeriesId"
                        (ngModelChange)="loadSeriesPoints()"
                        placeholder="Choose a series"
                      />
                    </div>
                  }

                  @if (seriesPoints().length > 0) {
                    @if (!isExportMode()) {
                      <div class="flex items-center justify-between mb-4 gap-4">
                        <div class="flex-1 max-w-md">
                          <input
                            type="text"
                            class="input w-full"
                            placeholder="Filter by any field..."
                            [(ngModel)]="seriesFilterText"
                          />
                        </div>
                      </div>
                    }

                    @if (filteredAndSortedSeriesPoints().length > 0) {
                      <div
                        #seriesOverviewExportContainer
                        class="export-container bg-white dark:bg-gray-900"
                      >
                        @if (isExportMode() && selectedSeriesName()) {
                          <div
                            class="mb-4 border-b border-gray-200 pb-3 dark:border-gray-700"
                          >
                            <p
                              class="text-xl font-semibold text-gray-900 dark:text-gray-100"
                            >
                              {{ selectedSeriesName() }}
                            </p>
                          </div>
                        }
                        <div #seriesPointsTable class="overflow-x-auto">
                          <table
                            class="w-full text-sm border border-gray-300 dark:border-gray-700"
                          >
                            <thead
                              class="bg-gray-50 border-b border-gray-300 dark:bg-gray-800 dark:border-gray-700"
                            >
                              <tr>
                                <th
                                  class="w-[8%] border-r border-gray-300 px-3 py-2 font-bold text-gray-500 text-center cursor-pointer hover:text-gray-700 align-middle leading-tight text-xs dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                  (click)="sortSeriesPoints('driverNumber')"
                                >
                                  Car #
                                  {{
                                    getSortIcon(
                                      "driverNumber",
                                      seriesSortColumn(),
                                      seriesSortDirection()
                                    )
                                  }}
                                </th>
                                <th
                                  class="w-[18%] border-r border-gray-300 px-3 py-2 font-bold text-gray-500 text-left cursor-pointer hover:text-gray-700 align-middle leading-tight text-xs dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                  (click)="sortSeriesPoints('driverName')"
                                >
                                  Driver
                                  {{
                                    getSortIcon(
                                      "driverName",
                                      seriesSortColumn(),
                                      seriesSortDirection()
                                    )
                                  }}
                                </th>
                                <th
                                  class="w-[12%] border-r border-gray-300 px-3 py-2 font-bold text-gray-500 text-left cursor-pointer hover:text-gray-700 align-middle leading-tight text-xs dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                  (click)="sortSeriesPoints('driverClass')"
                                >
                                  Class
                                  {{
                                    getSortIcon(
                                      "driverClass",
                                      seriesSortColumn(),
                                      seriesSortDirection()
                                    )
                                  }}
                                </th>
                                <th
                                  class="w-[12%] border-r border-gray-300 px-3 py-2 font-bold text-gray-500 text-center cursor-pointer hover:text-gray-700 align-middle leading-tight text-xs dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                  (click)="
                                    sortSeriesPoints('totalLicensePoints')
                                  "
                                >
                                  Total Points
                                  {{
                                    getSortIcon(
                                      "totalLicensePoints",
                                      seriesSortColumn(),
                                      seriesSortDirection()
                                    )
                                  }}
                                </th>
                                <th
                                  class="w-[50%] px-3 py-2 font-bold text-gray-500 text-left align-middle leading-tight text-xs dark:text-gray-400"
                                >
                                  Series Penalties
                                </th>
                              </tr>
                            </thead>
                            <tbody
                              class="divide-y divide-gray-100 dark:divide-gray-800"
                            >
                              @for (
                                row of filteredAndSortedSeriesPoints();
                                track row.driverId;
                                let i = $index
                              ) {
                                <tr [class]="getStripedRowClasses(i)">
                                  <td
                                    class="w-[8%] border-r border-gray-300 px-3 py-2 text-center align-middle leading-tight text-xs dark:border-gray-700"
                                  >
                                    {{ row.driverNumber }}
                                  </td>
                                  <td
                                    class="w-[18%] border-r border-gray-300 px-3 py-2 font-medium text-left align-middle leading-tight text-xs dark:border-gray-700"
                                  >
                                    <a
                                      [routerLink]="['/drivers', row.driverId]"
                                      class="text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                                    >
                                      {{ row.driverName }}
                                    </a>
                                  </td>
                                  <td
                                    class="w-[12%] border-r border-gray-300 px-3 py-2 text-gray-600 text-left align-middle leading-tight text-xs dark:border-gray-700 dark:text-gray-300"
                                  >
                                    {{ row.driverClass }}
                                  </td>
                                  <td
                                    class="w-[12%] border-r border-gray-300 px-3 py-2 text-center align-middle leading-tight text-xs dark:border-gray-700"
                                  >
                                    @if (row.totalLicensePoints > 0) {
                                      <app-badge>
                                        {{ row.totalLicensePoints }}
                                      </app-badge>
                                    } @else {
                                      <span
                                        class="text-gray-400 dark:text-gray-500"
                                        >0</span
                                      >
                                    }
                                  </td>
                                  <td
                                    class="w-[50%] px-3 py-2 text-left align-middle leading-tight text-xs"
                                  >
                                    @if (
                                      row.seriesPenalties &&
                                      row.seriesPenalties.length > 0
                                    ) {
                                      <div class="flex flex-wrap gap-1">
                                        @for (
                                          penalty of row.seriesPenalties;
                                          track penalty._id
                                        ) {
                                          <app-badge
                                            [variant]="
                                              penalty.isServed
                                                ? 'success'
                                                : 'danger'
                                            "
                                            size="sm"
                                          >
                                            {{
                                              penalty.seriesPenalty?.penaltyName
                                            }}
                                            ({{
                                              penalty.seriesPenaltyThreshold
                                                ?.threshold
                                            }}pts)
                                          </app-badge>
                                        }
                                      </div>
                                    } @else {
                                      <span
                                        class="text-gray-400 dark:text-gray-500"
                                        >-</span
                                      >
                                    }
                                  </td>
                                </tr>
                              }
                            </tbody>
                          </table>
                        </div>

                        @if (isExportMode()) {
                          <div
                            class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700"
                          >
                            <app-legend
                              [items]="seriesOverviewLegendItems()"
                              [title]="
                                seriesOverviewLegendItems().length > 0
                                  ? 'Legend'
                                  : ''
                              "
                            />
                          </div>
                        }
                      </div>
                    } @else {
                      <p
                        class="text-gray-500 text-center py-4 dark:text-gray-400"
                      >
                        No results match your filter
                      </p>
                    }
                  } @else if (selectedSeriesId) {
                    <p
                      class="text-gray-500 text-center py-4 dark:text-gray-400"
                    >
                      No drivers found for this series
                    </p>
                  } @else {
                    <p
                      class="text-gray-500 text-center py-4 dark:text-gray-400"
                    >
                      Select a series to view license points
                    </p>
                  }
                </div>
              </app-card>
            </div>
          }

          @if (activeTab() === STATISTICS_TABS.TIME_PENALTY_SUMMARY) {
            <div class="space-y-6">
              <app-card>
                <div
                  class="px-6 py-4 border-b border-gray-200 flex items-center justify-between dark:border-gray-700"
                >
                  <h3
                    class="text-lg font-semibold text-gray-900 dark:text-gray-100"
                  >
                    Time Penalty Summary
                  </h3>
                  <button
                    (click)="
                      exportTableImage(
                        timePenaltySummaryExportContainer,
                        'time-penalty-summary.png'
                      )
                    "
                    class="text-gray-500 hover:text-gray-700 transition-colors p-1 rounded hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
                  >
                    <svg
                      class="h-5 w-5"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                  </button>
                </div>
                <div class="px-6 py-4 space-y-4">
                  @if (!isExportMode()) {
                    <div>
                      <label class="label">Select Series</label>
                      <app-select
                        [options]="seriesOptions()"
                        [(ngModel)]="timePenaltySeriesId"
                        (ngModelChange)="
                          timePenaltyEventId = ''; loadTimePenaltySummary()
                        "
                        placeholder="Choose a series"
                      />
                    </div>
                  }

                  @if (timePenaltySeriesId) {
                    @if (!isExportMode()) {
                      <div>
                        <label class="label">Select Event</label>
                        <app-select
                          [options]="timePenaltyEventOptions()"
                          [(ngModel)]="timePenaltyEventId"
                          (ngModelChange)="loadTimePenaltySummary()"
                          placeholder="Choose an event"
                        />
                      </div>
                    }

                    @if (timePenaltySummary().length > 0) {
                      @if (!isExportMode()) {
                        <div
                          class="flex items-center justify-between mb-4 gap-4"
                        >
                          <div class="flex-1 max-w-md">
                            <input
                              type="text"
                              class="input w-full"
                              placeholder="Filter by any field..."
                              [(ngModel)]="timePenaltyFilterText"
                            />
                          </div>
                        </div>
                      }

                      <div
                        #timePenaltySummaryExportContainer
                        class="export-container bg-white dark:bg-gray-900"
                      >
                        @if (isExportMode() && timePenaltyEventId) {
                          <div
                            class="mb-4 border-b border-gray-200 pb-3 dark:border-gray-700"
                          >
                            @if (selectedTimePenaltySeries()) {
                              <p
                                class="text-xl font-semibold text-gray-900 dark:text-gray-100"
                              >
                                {{ selectedTimePenaltySeries()?.name }}
                              </p>
                            }
                            @if (selectedTimePenaltyEvent()) {
                              <p
                                class="text-lg font-semibold text-gray-800 dark:text-gray-200"
                              >
                                Event
                                {{ selectedTimePenaltyEvent()?.eventNumber }} -
                                {{ selectedTimePenaltyEvent()?.trackName }}
                              </p>
                            }
                          </div>
                        }
                        @for (
                          race of filteredAndSortedTimePenaltySummary();
                          track race.raceId
                        ) {
                          <div class="space-y-4">
                            <div class="flex items-center gap-2 pt-4">
                              <h3
                                class="text-lg font-semibold text-gray-900 dark:text-gray-100"
                              >
                                {{ race.raceName }}
                              </h3>
                            </div>
                            @if (
                              getRaceTimePenaltyDrivers(race.raceId).length > 0
                            ) {
                              <div #timePenaltyTable class="overflow-x-auto">
                                <table
                                  class="w-full text-sm border border-gray-300 dark:border-gray-700"
                                >
                                  <thead
                                    class="bg-gray-50 border-b border-gray-300 dark:bg-gray-800 dark:border-gray-700"
                                  >
                                    <tr>
                                      <th
                                        class="w-[8%] border-r border-gray-300 px-3 py-2 font-bold text-gray-500 text-center cursor-pointer hover:text-gray-700 align-middle leading-tight text-xs dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                        (click)="
                                          sortTimePenaltySummary(
                                            race.raceNumber,
                                            'carNumber'
                                          )
                                        "
                                      >
                                        Car #
                                        {{
                                          getSortIcon(
                                            "carNumber",
                                            getTimePenaltyRaceSortColumn(
                                              race.raceNumber
                                            ),
                                            getTimePenaltyRaceSortDirection(
                                              race.raceNumber
                                            )
                                          )
                                        }}
                                      </th>
                                      <th
                                        class="w-[18%] border-r border-gray-300 px-3 py-2 font-bold text-gray-500 text-left cursor-pointer hover:text-gray-700 align-middle leading-tight text-xs dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                        (click)="
                                          sortTimePenaltySummary(
                                            race.raceNumber,
                                            'driverName'
                                          )
                                        "
                                      >
                                        Driver
                                        {{
                                          getSortIcon(
                                            "driverName",
                                            getTimePenaltyRaceSortColumn(
                                              race.raceNumber
                                            ),
                                            getTimePenaltyRaceSortDirection(
                                              race.raceNumber
                                            )
                                          )
                                        }}
                                      </th>
                                      <th
                                        class="w-[12%] border-r border-gray-300 px-3 py-2 font-bold text-gray-500 text-left cursor-pointer hover:text-gray-700 align-middle leading-tight text-xs dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                        (click)="
                                          sortTimePenaltySummary(
                                            race.raceNumber,
                                            'driverClass'
                                          )
                                        "
                                      >
                                        Class
                                        {{
                                          getSortIcon(
                                            "driverClass",
                                            getTimePenaltyRaceSortColumn(
                                              race.raceNumber
                                            ),
                                            getTimePenaltyRaceSortDirection(
                                              race.raceNumber
                                            )
                                          )
                                        }}
                                      </th>
                                      <th
                                        class="w-[12%] border-r border-gray-300 px-3 py-2 font-bold text-gray-500 text-center cursor-pointer hover:text-gray-700 align-middle leading-tight text-xs dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                        (click)="
                                          sortTimePenaltySummary(
                                            race.raceNumber,
                                            'totalTimePenaltySeconds'
                                          )
                                        "
                                      >
                                        Total Time Penalty
                                        {{
                                          getSortIcon(
                                            "totalTimePenaltySeconds",
                                            getTimePenaltyRaceSortColumn(
                                              race.raceNumber
                                            ),
                                            getTimePenaltyRaceSortDirection(
                                              race.raceNumber
                                            )
                                          )
                                        }}
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody
                                    class="divide-y divide-gray-100 dark:divide-gray-800"
                                  >
                                    @for (
                                      row of getRaceTimePenaltyDrivers(
                                        race.raceId
                                      );
                                      track row.driverId;
                                      let i = $index
                                    ) {
                                      <tr [class]="getStripedRowClasses(i)">
                                        <td
                                          class="w-[8%] border-r border-gray-300 px-3 py-2 text-center align-middle leading-tight text-xs dark:border-gray-700"
                                        >
                                          {{ row.carNumber }}
                                        </td>
                                        <td
                                          class="w-[18%] border-r border-gray-300 px-3 py-2 font-medium text-left align-middle leading-tight text-xs dark:border-gray-700"
                                        >
                                          <a
                                            [routerLink]="[
                                              '/drivers',
                                              row.driverId,
                                            ]"
                                            class="text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                                          >
                                            {{ row.driverName }}
                                          </a>
                                        </td>
                                        <td
                                          class="w-[12%] border-r border-gray-300 px-3 py-2 text-gray-600 text-left align-middle leading-tight text-xs dark:border-gray-700 dark:text-gray-300"
                                        >
                                          {{ row.driverClass }}
                                        </td>
                                        <td
                                          class="w-[12%] border-r border-gray-300 px-3 py-2 text-center align-middle leading-tight text-xs dark:border-gray-700"
                                        >
                                          @if (
                                            row.totalTimePenaltySeconds > 0
                                          ) {
                                            <app-badge>
                                              {{ row.totalTimePenaltySeconds }}s
                                            </app-badge>
                                          } @else {
                                            <span
                                              class="text-gray-400 dark:text-gray-500"
                                              >0s</span
                                            >
                                          }
                                        </td>
                                      </tr>
                                    }
                                  </tbody>
                                </table>
                              </div>
                            } @else {
                              <p
                                class="text-gray-500 text-center py-4 dark:text-gray-400"
                              >
                                No drivers with time penalties for this race
                              </p>
                            }
                          </div>
                        }
                      </div>
                    } @else if (timePenaltyEventId) {
                      <p
                        class="text-gray-500 text-center py-4 dark:text-gray-400"
                      >
                        No finalized reports with time penalties for this event
                      </p>
                    }
                  } @else if (timePenaltySeriesId) {
                    <p
                      class="text-gray-500 text-center py-4 dark:text-gray-400"
                    >
                      Select an event to view time penalty summary
                    </p>
                  }
                </div>
              </app-card>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host.export-mode .export-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem;
      flex-shrink: 0;
    }

    :host.export-mode .export-body {
      flex: 1;
      overflow: auto;
      padding: 1.5rem;
    }

    @media print {
      :host.export-mode .export-header {
        background: white !important;
      }
      :host.export-mode .export-header app-button {
        display: none;
      }
    }

    :host.export-mode .export-container {
      padding: 2rem;
      min-width: 800px;
    }
  `,
})
export class StatisticsDashboardComponent implements OnInit, OnDestroy {
  @Input() tabId: StatisticsTabId = STATISTICS_TABS.EVENT_RUNDOWN;

  // Make STATISTICS_TABS available to the template
  readonly STATISTICS_TABS = STATISTICS_TABS;

  @HostBinding("class.export-mode") get exportModeClass() {
    return this.isExportMode();
  }

  private convex = inject(ConvexService);
  authService = inject(AuthService);
  readonly sidebarStateService = inject(SidebarStateService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  events = signal<any[]>([]);
  series = signal<any[]>([]);
  eventRundown = signal<RaceRundown[]>([]);
  seriesPoints = signal<DriverPointsRow[]>([]);
  timePenaltySummary = signal<RaceTimePenaltySummary[]>([]);
  loading = signal(true);
  activeTab = signal<StatisticsTabId>(STATISTICS_TABS.EVENT_RUNDOWN);
  isExportMode = signal<boolean>(false);

  selectedEventId = "";
  selectedSeriesId = "";
  timePenaltySeriesId = "";
  timePenaltyEventId = "";
  eventsLoaded = signal(false);
  seriesLoaded = signal(false);
  private eventFilterSubject = new Subject<string>();
  private seriesFilterSubject = new Subject<string>();
  private timePenaltyFilterSubject = new Subject<string>();
  private queryParamsApplied = signal(false);
  private destroyRef = inject(DestroyRef);
  private readonly validTabs = Object.values(STATISTICS_TABS) as readonly StatisticsTabId[];

  private loadingEffect = effect(
    () => {
      const eventsReady = this.eventsLoaded();
      const seriesReady = this.seriesLoaded();
      if (eventsReady && seriesReady) {
        this.loading.set(false);
      }
    },
    { allowSignalWrites: true },
  );

  private queryParamsEffect = effect(
    () => {
      if (
        this.eventsLoaded() &&
        this.seriesLoaded() &&
        !this.queryParamsApplied()
      ) {
        this.route.queryParams
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((params) => {
            this.applyQueryParamsFromUrl(params);
            this.queryParamsApplied.set(true);
          });
      }
    },
    { allowSignalWrites: true },
  );

  private eventFilterEffect = effect(
    () => {
      const filterText = this.eventFilterText();
      this.eventFilterSubject.next(filterText);
    },
    { allowSignalWrites: true },
  );

  private seriesFilterEffect = effect(
    () => {
      const filterText = this.seriesFilterText();
      this.seriesFilterSubject.next(filterText);
    },
    { allowSignalWrites: true },
  );

  private seriesSortEffect = effect(
    () => {
      const column = this.seriesSortColumn();
      const direction = this.seriesSortDirection();
      if (this.activeTab() === STATISTICS_TABS.SERIES_OVERVIEW && column) {
        this.updateQueryParams({
          sortColumn: column,
          sortDirection: direction,
        });
      }
    },
    { allowSignalWrites: true },
  );

  private timePenaltyFilterEffect = effect(
    () => {
      const filterText = this.timePenaltyFilterText();
      this.timePenaltyFilterSubject.next(filterText);
    },
    { allowSignalWrites: true },
  );

  eventFilterText = signal("");
  hideNoDriverAtFaultWithoutTicket = signal(false);
  eventSortColumn = signal<Record<number, keyof EventRundownRow>>({});
  eventSortDirection = signal<Record<number, "asc" | "desc">>({});

  seriesFilterText = signal("");
  seriesSortColumn = signal<keyof DriverPointsRow | "">("");
  seriesSortDirection = signal<"asc" | "desc">("asc");
  seriesPenaltyDefinitions = signal<SeriesPenaltyDefinition[]>([]);

  timePenaltyFilterText = signal("");
  timePenaltySortColumn = signal<Record<number, keyof DriverTimePenaltyRow>>(
    {},
  );
  timePenaltySortDirection = signal<Record<number, "asc" | "desc">>({});

  activeSeriesIds = computed(() => this.series().map((s) => s._id.toString()));

  legendItems = computed<LegendItem[]>(() => {
    if (this.activeTab() === STATISTICS_TABS.EVENT_RUNDOWN) {
      return [
        {
          label: "🟢 (SR)",
          description: "Self-reported incident (reduced time penalty)",
        },
        {
          label: "🔴 Red row",
          description: "Incident reviewed but not yet finalized",
        },
      ];
    } else if (this.activeTab() === STATISTICS_TABS.SERIES_OVERVIEW) {
      return [
        {
          label: "🟢 Name (Xpts)",
          description: "Series penalty served",
        },
        {
          label: "🔴 Name (Xpts)",
          description: "Series penalty not yet served",
        },
        {
          label: "(Xpts)",
          description: "License points threshold for this penalty",
        },
      ];
    } else {
      return [];
    }
  });

  seriesOverviewLegendItems = computed<LegendItem[]>(() => {
    if (this.activeTab() !== "series_overview") {
      return [];
    }

    const baseItems: LegendItem[] = [
      {
        label: "🟢 Name (Xpts)",
        description: "Series penalty served",
      },
      {
        label: "🔴 Name (Xpts)",
        description: "Series penalty not yet served",
      },
      {
        label: "(Xpts)",
        description: "License points threshold for this penalty",
      },
    ];

    const dynamicItems: LegendItem[] = this.seriesPenaltyDefinitions()
      .flatMap((penalty) =>
        (penalty.thresholds ?? []).map((threshold) => {
          const classNames = (threshold.driverClassObjects ?? [])
            .map((driverClass) => driverClass.displayName)
            .filter((name): name is string => Boolean(name))
            .sort((a, b) => a.localeCompare(b));

          const classText =
            classNames.length > 0 ? ` [${classNames.join(", ")}]` : "";

          return {
            label: `${penalty.penaltyName} (${threshold.threshold}pts)`,
            description: `${classText}`,
          };
        }),
      )
      .sort((a, b) => {
        const thresholdA = Number.parseInt(
          a.label.match(/\((\d+)pts\)/)?.[1] ?? "0",
          10,
        );
        const thresholdB = Number.parseInt(
          b.label.match(/\((\d+)pts\)/)?.[1] ?? "0",
          10,
        );

        if (thresholdA !== thresholdB) {
          return thresholdA - thresholdB;
        }

        return a.label.localeCompare(b.label);
      });

    return [...baseItems, ...dynamicItems];
  });

  eventOptions = computed(() => {
    const activeIds = this.activeSeriesIds();
    const filteredEvents = this.events().filter((e) =>
      activeIds.includes(e.seriesId.toString()),
    );
    return [
      { value: "", label: "Choose an event" },
      ...filteredEvents.map((e: any) => ({
        value: e._id,
        label: `${e.trackName} (${e.series.name})`,
      })),
    ];
  });

  seriesOptions = computed(() => {
    return [
      { value: "", label: "Choose a series" },
      ...this.series().map((s: any) => ({
        value: s._id,
        label: s.name,
      })),
    ];
  });

  timePenaltyEventOptions = computed(() => {
    if (!this.timePenaltySeriesId) {
      return [{ value: "", label: "Choose a series first" }];
    }

    const filteredEvents = this.events().filter(
      (e) => e.seriesId.toString() === this.timePenaltySeriesId,
    );
    return [
      { value: "", label: "Choose an event" },
      ...filteredEvents.map((e: any) => ({
        value: e._id,
        label: `${e.trackName} (${e.series.name})`,
      })),
    ];
  });

  selectedEventDetails = computed(() => {
    const selectedEvent = this.events().find(
      (event: any) => event._id === this.selectedEventId,
    );
    if (!selectedEvent) {
      return null;
    }

    return {
      seriesName: selectedEvent.series?.name ?? "Unknown Series",
      eventName: `Event ${selectedEvent.eventNumber} - ${selectedEvent.trackName}`,
    };
  });

  selectedSeriesName = computed(() => {
    const selectedSeries = this.series().find(
      (series: any) => series._id === this.selectedSeriesId,
    );
    return selectedSeries?.name ?? "";
  });

  selectedTimePenaltySeries = computed(() => {
    const selectedSeries = this.series().find(
      (series: any) => series._id === this.timePenaltySeriesId,
    );
    return selectedSeries;
  });

  selectedTimePenaltyEvent = computed(() => {
    const selectedEvent = this.events().find(
      (event: any) => event._id === this.timePenaltyEventId,
    );
    return selectedEvent;
  });

  filteredAndSortedRaces = computed(() => {
    let races = this.eventRundown();

    if (this.hideNoDriverAtFaultWithoutTicket()) {
      races = races.map((race) => ({
        ...race,
        reports: race.reports.filter((row) => {
          const hasTicketNumber =
            row.reportId !== null && row.reportId !== undefined;
          return !(row.penaltyAllowsNoDriverAtFault && !hasTicketNumber);
        }),
      }));
    }

    if (this.eventFilterText()) {
      const filter = this.eventFilterText().toLowerCase();

      races = races.map((race) => ({
        ...race,
        reports: race.reports.filter((row) => {
          const carNumber = row.carNumber?.toString() ?? "";
          const driverName = row.driverName?.toLowerCase() ?? "";
          const driverClass = row.driverClass?.toLowerCase() ?? "";
          const lap = row.lap?.toString() ?? "";
          const turn = row.turn?.toString() ?? "";
          const incident = row.incidentDescription?.toLowerCase() ?? "";
          const adjustedReason = row.adjustedReason?.toLowerCase() ?? "";
          const penalty = row.penaltyName?.toLowerCase() ?? "";
          const timePenalty = row.timePenaltySeconds?.toString() ?? "";
          const licensePoints = row.licensePoints?.toString() ?? "";

          return (
            carNumber.includes(filter) ||
            driverName.includes(filter) ||
            driverClass.includes(filter) ||
            lap.includes(filter) ||
            turn.includes(filter) ||
            incident.includes(filter) ||
            adjustedReason.includes(filter) ||
            penalty.includes(filter) ||
            timePenalty.includes(filter) ||
            licensePoints.includes(filter)
          );
        }),
      }));
    }

    return races;
  });

  filteredAndSortedSeriesPoints = computed(() => {
    let data = this.seriesPoints();

    if (this.seriesFilterText()) {
      const filter = this.seriesFilterText().toLowerCase();
      data = data.filter((row) => {
        const driverNumber = row.driverNumber?.toString() ?? "";
        const driverName = row.driverName?.toLowerCase() ?? "";
        const driverClass = row.driverClass?.toLowerCase() ?? "";
        const totalPoints = row.totalLicensePoints?.toString() ?? "";

        return (
          driverNumber.includes(filter) ||
          driverName.includes(filter) ||
          driverClass.includes(filter) ||
          totalPoints.includes(filter)
        );
      });
    }

    data = data.filter((row) => row.totalLicensePoints > 0);

    if (this.seriesSortColumn()) {
      data = [...data].sort((a, b) => {
        const aVal = a[this.seriesSortColumn() as keyof DriverPointsRow] ?? "";
        const bVal = b[this.seriesSortColumn() as keyof DriverPointsRow] ?? "";

        if (typeof aVal === "string" && typeof bVal === "string") {
          return this.seriesSortDirection() === "asc"
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        if (typeof aVal === "number" && typeof bVal === "number") {
          return this.seriesSortDirection() === "asc"
            ? aVal - bVal
            : bVal - aVal;
        }

        return 0;
      });
    }

    return data;
  });

  filteredAndSortedTimePenaltySummary = computed(() => {
    let races = this.timePenaltySummary();

    if (this.timePenaltyFilterText()) {
      const filter = this.timePenaltyFilterText().toLowerCase();

      races = races.map((race) => ({
        ...race,
        driverPenalties: race.driverPenalties.filter((row) => {
          const carNumber = row.carNumber?.toString() ?? "";
          const driverName = row.driverName?.toLowerCase() ?? "";
          const driverClass = row.driverClass?.toLowerCase() ?? "";
          const totalTimePenalty =
            row.totalTimePenaltySeconds?.toString() ?? "";

          return (
            carNumber.includes(filter) ||
            driverName.includes(filter) ||
            driverClass.includes(filter) ||
            totalTimePenalty.includes(filter)
          );
        }),
      }));
    }

    return races;
  });

  canViewSeriesStats = computed(() => {
    return this.authService.hasMinimumRole("head_steward");
  });

  visibleTabs = computed((): Tab[] => {
    const tabs: Tab[] = [
      { id: STATISTICS_TABS.EVENT_RUNDOWN, label: "Event Rundown" },
      { id: STATISTICS_TABS.TIME_PENALTY_SUMMARY, label: "Time Penalty Summary" },
    ];

    if (this.canViewSeriesStats()) {
      tabs.push({ id: STATISTICS_TABS.SERIES_OVERVIEW, label: "Series Overview" });
    }

    return tabs;
  });

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

  selectTab(tabId: string): void {
    if (!this.isValidTab(tabId)) {
      return;
    }

    untracked(() => {
      if (tabId === STATISTICS_TABS.EVENT_RUNDOWN) {
        this.eventFilterText.set(this.seriesFilterText());
      } else if (tabId === STATISTICS_TABS.SERIES_OVERVIEW) {
        this.seriesFilterText.set(this.eventFilterText());
      }

      void this.router.navigate(["/statistics", this.getTabRouteSegment(tabId)], {
        queryParams: this.getQueryParamsForTab(tabId),
      });
    });
  }

  sortEventRundown(raceNumber: number, column: keyof EventRundownRow): void {
    const currentSortColumn = this.eventSortColumn();
    const currentSortDirection = this.eventSortDirection();

    const newDirection =
      currentSortColumn[raceNumber] === column
        ? currentSortDirection[raceNumber] === "asc"
          ? "desc"
          : "asc"
        : "asc";

    this.eventSortColumn.update((state) => ({
      ...state,
      [raceNumber]: column,
    }));

    this.eventSortDirection.update((state) => ({
      ...state,
      [raceNumber]: newDirection,
    }));
  }

  sortSeriesPoints(column: keyof DriverPointsRow): void {
    if (this.seriesSortColumn() === column) {
      this.seriesSortDirection.set(
        this.seriesSortDirection() === "asc" ? "desc" : "asc",
      );
    } else {
      this.seriesSortColumn.set(column);
      this.seriesSortDirection.set("asc");
    }
  }

  sortTimePenaltySummary(
    raceNumber: number,
    column: keyof DriverTimePenaltyRow,
  ): void {
    const currentSortColumn = this.timePenaltySortColumn();
    const currentSortDirection = this.timePenaltySortDirection();

    const newDirection =
      currentSortColumn[raceNumber] === column
        ? currentSortDirection[raceNumber] === "asc"
          ? "desc"
          : "asc"
        : "asc";

    this.timePenaltySortColumn.update((state) => ({
      ...state,
      [raceNumber]: column,
    }));

    this.timePenaltySortDirection.update((state) => ({
      ...state,
      [raceNumber]: newDirection,
    }));
  }

  getSortIcon(column: string, activeColumn: string, direction: string): string {
    if (column !== activeColumn) return "";
    return direction === "asc" ? "↑" : "↓";
  }

  @ViewChildren("eventRundownTable") eventRundownTables!: QueryList<ElementRef>;
  @ViewChild("seriesPointsTable") seriesPointsTable!: ElementRef;
  @ViewChild("eventRundownExportContainer")
  eventRundownExportContainer!: ElementRef;
  @ViewChild("seriesOverviewExportContainer")
  seriesOverviewExportContainer!: ElementRef;
  @ViewChild("timePenaltySummaryExportContainer")
  timePenaltySummaryExportContainer!: ElementRef;

  private unsubscribes: (() => void)[] = [];

  private updateQueryParams(params: Record<string, string | undefined>): void {
    const currentQueryParams = this.route.snapshot.queryParams as Record<
      string,
      unknown
    >;
    const queryParams = this.getMergedQueryParams(currentQueryParams, params);

    if (this.areQueryParamsEqual(currentQueryParams, queryParams)) {
      return;
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
    });
  }

  private getMergedQueryParams(
    currentQueryParams: Record<string, unknown>,
    nextParams: Record<string, string | undefined>,
  ): Record<string, string | undefined> {
    const mergedParams: Record<string, string | undefined> = {};

    Object.entries(currentQueryParams).forEach(([key, value]) => {
      if (typeof value === "string" && value) {
        mergedParams[key] = value;
      }
    });

    Object.entries(nextParams).forEach(([key, value]) => {
      if (value) {
        mergedParams[key] = value;
      } else {
        delete mergedParams[key];
      }
    });

    return mergedParams;
  }

  private areQueryParamsEqual(
    current: Record<string, unknown>,
    next: Record<string, string | undefined>,
  ): boolean {
    const normalize = (params: Record<string, unknown>): Record<string, string> => {
      const normalized: Record<string, string> = {};

      Object.entries(params).forEach(([key, value]) => {
        if (typeof value === "string" && value) {
          normalized[key] = value;
        }
      });

      return normalized;
    };

    const normalizedCurrent = normalize(current);
    const normalizedNext = normalize(next);
    const currentKeys = Object.keys(normalizedCurrent).sort();
    const nextKeys = Object.keys(normalizedNext).sort();

    if (currentKeys.length !== nextKeys.length) {
      return false;
    }

    return currentKeys.every(
      (key, index) =>
        key === nextKeys[index] && normalizedCurrent[key] === normalizedNext[key],
    );
  }

  private setupFilterDebounce(): void {
    this.eventFilterSubject
      .pipe(debounceTime(1000), takeUntilDestroyed(this.destroyRef))
      .subscribe((filterText) => {
        if (this.activeTab() === STATISTICS_TABS.EVENT_RUNDOWN) {
          this.updateQueryParams({ filter: filterText || undefined });
        }
      });

    this.seriesFilterSubject
      .pipe(debounceTime(1000), takeUntilDestroyed(this.destroyRef))
      .subscribe((filterText) => {
        if (this.activeTab() === STATISTICS_TABS.SERIES_OVERVIEW) {
          this.updateQueryParams({ filter: filterText || undefined });
        }
      });

    this.timePenaltyFilterSubject
      .pipe(debounceTime(1000), takeUntilDestroyed(this.destroyRef))
      .subscribe((filterText) => {
        if (this.activeTab() === STATISTICS_TABS.TIME_PENALTY_SUMMARY) {
          this.updateQueryParams({ filter: filterText || undefined });
        }
      });
  }

  private applyQueryParamsFromUrl(
    params: Record<string, string | undefined>,
  ): void {
    let needsUpdate = false;
    const paramsToUpdate: Record<string, string | undefined> = {};

    if (params["event"]) {
      const eventExists = this.events().some((e) => e._id === params["event"]);
      if (eventExists) {
        if (this.activeTab() === STATISTICS_TABS.EVENT_RUNDOWN) {
          this.selectedEventId = params["event"];
          this.loadEventRundown();
        } else if (this.activeTab() === STATISTICS_TABS.TIME_PENALTY_SUMMARY) {
          this.timePenaltyEventId = params["event"];
          this.loadTimePenaltySummary();
        }
      } else {
        paramsToUpdate["event"] = undefined;
        needsUpdate = true;
      }
    }

    if (params["series"]) {
      const seriesExists = this.series().some(
        (s) => s._id === params["series"],
      );
      if (seriesExists) {
        if (this.activeTab() === STATISTICS_TABS.SERIES_OVERVIEW) {
          this.selectedSeriesId = params["series"];
          this.timePenaltySeriesId = params["series"];
          this.loadSeriesPoints();
        } else if (this.activeTab() === STATISTICS_TABS.TIME_PENALTY_SUMMARY) {
          this.timePenaltySeriesId = params["series"];
        }
      } else {
        paramsToUpdate["series"] = undefined;
        needsUpdate = true;
      }
    }

    if (params["filter"]) {
      this.eventFilterText.set(params["filter"]);
      this.seriesFilterText.set(params["filter"]);
      this.timePenaltyFilterText.set(params["filter"]);
    }

    if (params["sortColumn"] && params["sortDirection"]) {
      const validSeriesColumns = [
        "driverNumber",
        "driverName",
        "driverClass",
        "totalLicensePoints",
      ];
      const validDirections = ["asc", "desc"];

      if (
        validSeriesColumns.includes(params["sortColumn"]) &&
        validDirections.includes(params["sortDirection"])
      ) {
        this.seriesSortColumn.set(
          params["sortColumn"] as keyof DriverPointsRow,
        );
        this.seriesSortDirection.set(params["sortDirection"] as "asc" | "desc");
      } else {
        paramsToUpdate["sortColumn"] = undefined;
        paramsToUpdate["sortDirection"] = undefined;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      this.updateQueryParams(paramsToUpdate);
    }
  }

  ngOnInit(): void {
    this.applyRouteTab();
    this.setupFilterDebounce();
    this.loadData();
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach((unsub) => unsub());
    this.sidebarStateService.setExportMode(false);
  }

  private loadData(): void {
    this.loading.set(true);

    const eventsQuery = this.convex.createReactiveQuery(
      this.convex.api.events.list,
      {},
      (data) => {
        this.events.set(data);
        this.eventsLoaded.set(true);
      }
    );
    this.unsubscribes.push(eventsQuery.unsubscribe);

    const seriesQuery = this.convex.createReactiveQuery(
      this.convex.api.series.listActive,
      {},
      (data) => {
        this.series.set(data);
        this.seriesLoaded.set(true);
      }
    );
    this.unsubscribes.push(seriesQuery.unsubscribe);

    // Failsafe: stop loading after 10 seconds regardless of state
    setTimeout(() => {
      this.loading.set(false);
    }, 10000);
  }

  async loadEventRundown(): Promise<void> {
    if (!this.selectedEventId) {
      this.eventRundown.set([]);
      this.updateQueryParams({
        event: undefined,
        series: undefined,
        sortColumn: undefined,
        sortDirection: undefined,
      });
      return;
    }

    try {
      const data = await this.convex.query(
        this.convex.api.statistics.getEventRundown,
        { eventId: this.selectedEventId as any },
      );
      this.eventRundown.set(data || []);
      this.updateQueryParams({
        event: this.selectedEventId,
        series: undefined,
        sortColumn: undefined,
        sortDirection: undefined,
      });
    } catch (error: any) {
      console.error("Failed to load event rundown:", error);
      this.eventRundown.set([]);
    }
  }

  async loadSeriesPoints(): Promise<void> {
    if (!this.selectedSeriesId) {
      this.seriesPoints.set([]);
      this.seriesPenaltyDefinitions.set([]);
      this.updateQueryParams({
        series: undefined,
        event: undefined,
        sortColumn: undefined,
        sortDirection: undefined,
      });
      return;
    }

    try {
      const [data, seriesPenalties] = await Promise.all([
        this.convex.query(
          this.convex.api.statistics.getSeriesLicensePointsWithPenalties,
          { seriesId: this.selectedSeriesId as any },
        ),
        this.convex.query(this.convex.api.seriesPenalties.listBySeries, {
          seriesId: this.selectedSeriesId as any,
        }),
      ]);
      this.seriesPoints.set(data || []);
      this.seriesPenaltyDefinitions.set((seriesPenalties as any[]) || []);
      this.updateQueryParams({
        series: this.selectedSeriesId,
        event: undefined,
        sortColumn: this.seriesSortColumn() || undefined,
        sortDirection: this.seriesSortDirection() || undefined,
      });
    } catch (error: any) {
      console.error("Failed to load series points:", error);
      this.seriesPoints.set([]);
      this.seriesPenaltyDefinitions.set([]);
    }
  }

  async loadTimePenaltySummary(): Promise<void> {
    if (!this.timePenaltyEventId) {
      this.timePenaltySummary.set([]);
      this.updateQueryParams({
        series: this.timePenaltySeriesId || undefined,
        event: undefined,
        sortColumn: undefined,
        sortDirection: undefined,
      });
      return;
    }

    try {
      const data = await this.convex.query(
        this.convex.api.statistics.getEventTimePenaltySummary,
        { eventId: this.timePenaltyEventId as any },
      );
      this.timePenaltySummary.set(data || []);
      this.updateQueryParams({
        series: this.timePenaltySeriesId || undefined,
        event: this.timePenaltyEventId,
        sortColumn: undefined,
        sortDirection: undefined,
      });
    } catch (error: any) {
      console.error("Failed to load time penalty summary:", error);
      this.timePenaltySummary.set([]);
    }
  }

  getStripedRowClasses(index: number): string {
    const zebraClasses =
      index % 2 === 1
        ? "bg-gray-100 dark:bg-gray-800/70"
        : "bg-white dark:bg-gray-900";

    if (this.isExportMode()) {
      return zebraClasses;
    }

    const hoverClasses =
      index % 2 === 1
        ? "hover:bg-gray-200 dark:hover:bg-gray-700"
        : "hover:bg-gray-50 dark:hover:bg-gray-800";

    return `${zebraClasses} ${hoverClasses}`;
  }

  toggleExportMode(): void {
    this.isExportMode.update((mode) => {
      const newMode = !mode;
      this.sidebarStateService.setExportMode(newMode);
      return newMode;
    });
  }

  exitExportMode(): void {
    this.isExportMode.set(false);
    this.sidebarStateService.setExportMode(false);
  }

  async exportTableImage(
    elementRef: ElementRef,
    filename: string,
  ): Promise<void> {
    if (!elementRef?.nativeElement) {
      console.error("Export container not found");
      return;
    }

    // Activate export mode for clean UI
    this.isExportMode.set(true);
    this.sidebarStateService.setExportMode(true);

    // Wait for DOM to update and render
    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      const dataUrl = await toPng(elementRef.nativeElement, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });

      // Download the image
      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Failed to export image:", error);
    } finally {
      // Automatically exit export mode
      this.exitExportMode();
    }
  }

  private applyRouteTab(): void {
    // Always follow the URL - if the tabId is invalid, fall back to event-rundown
    // without redirecting, so URL-based navigation takes precedence
    if (this.isValidTab(this.tabId)) {
      this.activeTab.set(this.tabId);
    } else {
      this.activeTab.set(STATISTICS_TABS.EVENT_RUNDOWN);
    }
  }

  private getQueryParamsForTab(
    tabId: StatisticsTabId,
  ): Record<string, string | undefined> {
    const filter =
      tabId === STATISTICS_TABS.EVENT_RUNDOWN
        ? this.eventFilterText() || undefined
        : tabId === STATISTICS_TABS.SERIES_OVERVIEW
          ? this.seriesFilterText() || undefined
          : this.timePenaltyFilterText() || undefined;

    if (tabId === STATISTICS_TABS.EVENT_RUNDOWN) {
      return {
        event: this.selectedEventId || undefined,
        filter,
        series: undefined,
        sortColumn: undefined,
        sortDirection: undefined,
      };
    }

    if (tabId === STATISTICS_TABS.SERIES_OVERVIEW) {
      return {
        series: this.selectedSeriesId || undefined,
        filter,
        sortColumn: this.seriesSortColumn() || undefined,
        sortDirection: this.seriesSortDirection() || undefined,
        event: undefined,
      };
    }

    return {
      series: this.timePenaltySeriesId || undefined,
      event: this.timePenaltyEventId || undefined,
      filter,
      sortColumn: undefined,
      sortDirection: undefined,
    };
  }

  private getTabRouteSegment(
    tabId: StatisticsTabId,
  ): "event-rundown" | "series-overview" | "time-penalty-summary" {
    if (tabId === STATISTICS_TABS.SERIES_OVERVIEW) {
      return "series-overview";
    }

    if (tabId === STATISTICS_TABS.TIME_PENALTY_SUMMARY) {
      return "time-penalty-summary";
    }

    return "event-rundown";
  }

  private isValidTab(
    tabId: string,
  ): tabId is StatisticsTabId {
    return this.validTabs.includes(
      tabId as StatisticsTabId,
    );
  }
}
