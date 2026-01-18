import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  computed,
  ElementRef,
  ViewChild,
  untracked,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ConvexService } from "@core/services/convex.service";
import { AuthService } from "@core/services/auth.service";
import { CardComponent } from "@shared/components/card/card.component";
import { BadgeComponent } from "@shared/components/badge/badge.component";
import { LoadingComponent } from "@shared/components/loading/loading.component";
import { ButtonComponent } from "@shared/components/button/button.component";
import {
  SelectComponent,
  SelectOption,
} from "@shared/components/select/select.component";
import { TabsComponent, Tab } from "@shared/components/tabs/tabs.component";
import html2canvas from "html2canvas";
import { RouterModule } from "@angular/router";
import { ActivatedRoute, Router } from "@angular/router";
import { effect, DestroyRef } from "@angular/core";
import { debounceTime, Subject } from "rxjs";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

interface EventRundownRow {
  reportId: string;
  driverId: string;
  carNumber: number | null;
  driverName: string | null;
  driverClass: string | null;
  incidentDescription: string;
  penaltyName: string | null;
  timePenaltySeconds: number;
  isSelfReport: boolean;
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
  ],
  template: `
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-900">Statistics</h1>

      @if (loading()) {
        <div>
          <app-loading text="Loading..." />
        </div>
      } @else {
        <app-tabs
          [tabs]="visibleTabs()"
          [activeTab]="activeTab()"
          (activeTabChange)="selectTab($event)"
        />

        @if (activeTab() === "event_rundown") {
          <div class="space-y-6">
            <app-card title="Event Rundown">
              <div class="space-y-4">
                <div>
                  <label class="label">Select Event</label>
                  <app-select
                    [options]="eventOptions()"
                    [(ngModel)]="selectedEventId"
                    (ngModelChange)="loadEventRundown()"
                    placeholder="Choose an event"
                  />
                </div>

                @if (eventRundown().length > 0) {
                  <div class="flex items-center justify-between mb-4 gap-4">
                    <div class="flex-1 max-w-md">
                      <input
                        type="text"
                        class="input w-full"
                        placeholder="Filter by any field..."
                        [(ngModel)]="eventFilterText"
                      />
                    </div>
                    <app-button
                      variant="secondary"
                      size="sm"
                      (onClick)="exportEventRundownAsImage()"
                    >
                      <svg
                        class="w-4 h-4 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        ></path>
                      </svg>
                      Export as Image
                    </app-button>
                  </div>
                  @if (filteredAndSortedEventRundown().length > 0) {
                    <div #eventRundownTable class="overflow-x-auto">
                      <table class="w-full text-sm">
                        <thead class="bg-gray-50">
                          <tr class="text-left">
                            <th
                              class="px-4 py-3 font-medium text-gray-500 cursor-pointer hover:text-gray-700 align-middle leading-tight"
                              (click)="sortEventRundown('carNumber')"
                            >
                              Car #
                              {{
                                getSortIcon(
                                  "carNumber",
                                  eventSortColumn(),
                                  eventSortDirection()
                                )
                              }}
                            </th>
                            <th
                              class="px-4 py-3 font-medium text-gray-500 cursor-pointer hover:text-gray-700 align-middle leading-tight"
                              (click)="sortEventRundown('driverName')"
                            >
                              Driver
                              {{
                                getSortIcon(
                                  "driverName",
                                  eventSortColumn(),
                                  eventSortDirection()
                                )
                              }}
                            </th>
                            <th
                              class="px-4 py-3 font-medium text-gray-500 cursor-pointer hover:text-gray-700 align-middle leading-tight"
                              (click)="sortEventRundown('driverClass')"
                            >
                              Class
                              {{
                                getSortIcon(
                                  "driverClass",
                                  eventSortColumn(),
                                  eventSortDirection()
                                )
                              }}
                            </th>
                            <th
                              class="px-4 py-3 font-medium text-gray-500 cursor-pointer hover:text-gray-700 align-middle leading-tight"
                              (click)="sortEventRundown('incidentDescription')"
                            >
                              Incident Description
                              {{
                                getSortIcon(
                                  "incidentDescription",
                                  eventSortColumn(),
                                  eventSortDirection()
                                )
                              }}
                            </th>
                            <th
                              class="px-4 py-3 font-medium text-gray-500 cursor-pointer hover:text-gray-700 align-middle leading-tight"
                              (click)="sortEventRundown('penaltyName')"
                            >
                              Penalty
                              {{
                                getSortIcon(
                                  "penaltyName",
                                  eventSortColumn(),
                                  eventSortDirection()
                                )
                              }}
                            </th>
                            <th
                              class="px-4 py-3 font-medium text-gray-500 cursor-pointer hover:text-gray-700 align-middle leading-tight"
                              (click)="sortEventRundown('timePenaltySeconds')"
                            >
                              Time Penalty
                              {{
                                getSortIcon(
                                  "timePenaltySeconds",
                                  eventSortColumn(),
                                  eventSortDirection()
                                )
                              }}
                            </th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                          @for (
                            row of filteredAndSortedEventRundown();
                            track row.reportId
                          ) {
                            <tr class="hover:bg-gray-50">
                              <td class="px-4 py-3 align-middle leading-tight">
                                {{ row.carNumber ?? "-" }}
                              </td>
                              <td class="px-4 py-3 font-medium align-middle leading-tight">
                                @if (row.driverId) {
                                  <a
                                    [routerLink]="['/drivers', row.driverId]"
                                    class="text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    {{ row.driverName ?? "-" }}
                                  </a>
                                } @else {
                                  <span class="text-gray-900">
                                    {{ row.driverName ?? "-" }}
                                  </span>
                                }
                              </td>
                              <td class="px-4 py-3 text-gray-600 align-middle leading-tight">
                                {{ row.driverClass ?? "-" }}
                              </td>
                              <td
                                class="px-4 py-3 text-gray-700 max-w-md truncate align-middle leading-tight"
                              >
                                {{ row.incidentDescription }}
                              </td>
                              <td class="px-4 py-3 align-middle leading-tight">
                                @if (row.penaltyName) {
                                  <span class="text-gray-700">{{
                                    row.penaltyName
                                  }}</span>
                                } @else {
                                  <span class="text-gray-400">-</span>
                                }
                              </td>
                              <td class="px-4 py-3 align-middle leading-tight">
                                @if (row.timePenaltySeconds > 0) {
                                  <app-badge
                                    [variant]="
                                      row.isSelfReport ? 'success' : 'default'
                                    "
                                  >
                                    {{ row.timePenaltySeconds }}s
                                    @if (row.isSelfReport) {
                                      (SR)
                                    }
                                  </app-badge>
                                } @else {
                                  <span class="text-gray-400">-</span>
                                }
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  } @else {
                    <p class="text-gray-500 text-center py-4">
                      No results match your filter
                    </p>
                  }
                } @else if (selectedEventId) {
                  <p class="text-gray-500 text-center py-4">
                    No finalized reports for this event
                  </p>
                } @else {
                  <p class="text-gray-500 text-center py-4">
                    Select an event to view reports
                  </p>
                }
              </div>
            </app-card>
          </div>
        }

        @if (activeTab() === "series_overview" && canViewSeriesStats()) {
          <div class="space-y-6">
            <app-card title="Series Overview - License Points">
              <div class="space-y-4">
                <div>
                  <label class="label">Select Series</label>
                  <app-select
                    [options]="seriesOptions()"
                    [(ngModel)]="selectedSeriesId"
                    (ngModelChange)="loadSeriesPoints()"
                    placeholder="Choose a series"
                  />
                </div>

                @if (seriesPoints().length > 0) {
                  <div class="flex items-center justify-between mb-4 gap-4">
                    <div class="flex-1 max-w-md">
                      <input
                        type="text"
                        class="input w-full"
                        placeholder="Filter by any field..."
                        [(ngModel)]="seriesFilterText"
                      />
                    </div>
                    <app-button
                      variant="secondary"
                      size="sm"
                      (onClick)="exportSeriesPointsAsImage()"
                    >
                      <svg
                        class="w-4 h-4 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        ></path>
                      </svg>
                      Export as Image
                    </app-button>
                  </div>
                  @if (filteredAndSortedSeriesPoints().length > 0) {
                    <div #seriesPointsTable class="overflow-x-auto">
                      <table class="w-full text-sm">
                        <thead class="bg-gray-50">
                          <tr class="text-left">
                            <th
                              class="px-4 py-3 font-medium text-gray-500 cursor-pointer hover:text-gray-700 align-middle leading-tight"
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
                              class="px-4 py-3 font-medium text-gray-500 cursor-pointer hover:text-gray-700 align-middle leading-tight"
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
                              class="px-4 py-3 font-medium text-gray-500 cursor-pointer hover:text-gray-700 align-middle leading-tight"
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
                              class="px-4 py-3 font-medium text-gray-500 cursor-pointer hover:text-gray-700 align-middle leading-tight"
                              (click)="sortSeriesPoints('totalLicensePoints')"
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
                            <th class="px-4 py-3 font-medium text-gray-500 align-middle leading-tight">
                              Series Penalties
                            </th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                          @for (
                            row of filteredAndSortedSeriesPoints();
                            track row.driverId
                          ) {
                            <tr class="hover:bg-gray-50">
                              <td class="px-4 py-3 align-middle leading-tight">{{ row.driverNumber }}</td>
                              <td class="px-4 py-3 font-medium align-middle leading-tight">
                                <a
                                  [routerLink]="['/drivers', row.driverId]"
                                  class="text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  {{ row.driverName }}
                                </a>
                              </td>
                              <td class="px-4 py-3 text-gray-600 align-middle leading-tight">
                                {{ row.driverClass }}
                              </td>
                              <td class="px-4 py-3 align-middle leading-tight">
                                @if (row.totalLicensePoints > 0) {
                                  <app-badge>
                                    {{ row.totalLicensePoints }}
                                  </app-badge>
                                } @else {
                                  <span class="text-gray-400">0</span>
                                }
                              </td>
                              <td class="px-4 py-3 align-middle leading-tight">
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
                                        {{ penalty.seriesPenalty?.penaltyName }}
                                        ({{
                                          penalty.seriesPenaltyThreshold
                                            ?.threshold
                                        }}pts)
                                      </app-badge>
                                    }
                                  </div>
                                } @else {
                                  <span class="text-gray-400">-</span>
                                }
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  } @else {
                    <p class="text-gray-500 text-center py-4">
                      No results match your filter
                    </p>
                  }
                } @else if (selectedSeriesId) {
                  <p class="text-gray-500 text-center py-4">
                    No drivers found for this series
                  </p>
                } @else {
                  <p class="text-gray-500 text-center py-4">
                    Select a series to view license points
                  </p>
                }
              </div>
            </app-card>
          </div>
        }
      }
    </div>
  `,
})
export class StatisticsDashboardComponent implements OnInit, OnDestroy {
  private convex = inject(ConvexService);
  authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  events = signal<any[]>([]);
  series = signal<any[]>([]);
  eventRundown = signal<EventRundownRow[]>([]);
  seriesPoints = signal<DriverPointsRow[]>([]);
  loading = signal(true);
  activeTab = signal<"event_rundown" | "series_overview">("event_rundown");

  selectedEventId = "";
  selectedSeriesId = "";
  eventsLoaded = signal(false);
  seriesLoaded = signal(false);
  private eventFilterSubject = new Subject<string>();
  private seriesFilterSubject = new Subject<string>();
  private queryParamsApplied = signal(false);
  private destroyRef = inject(DestroyRef);

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
        this.route.queryParams.subscribe((params) => {
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

  private eventSortEffect = effect(
    () => {
      const column = this.eventSortColumn();
      const direction = this.eventSortDirection();
      if (this.activeTab() === "event_rundown" && column) {
        this.updateQueryParams({
          sortColumn: column,
          sortDirection: direction,
        });
      }
    },
    { allowSignalWrites: true },
  );

  private seriesSortEffect = effect(
    () => {
      const column = this.seriesSortColumn();
      const direction = this.seriesSortDirection();
      if (this.activeTab() === "series_overview" && column) {
        this.updateQueryParams({
          sortColumn: column,
          sortDirection: direction,
        });
      }
    },
    { allowSignalWrites: true },
  );

  eventFilterText = signal("");
  eventSortColumn = signal<keyof EventRundownRow | "">("");
  eventSortDirection = signal<"asc" | "desc">("asc");

  seriesFilterText = signal("");
  seriesSortColumn = signal<keyof DriverPointsRow | "">("");
  seriesSortDirection = signal<"asc" | "desc">("asc");

  eventOptions = computed(() => {
    return [
      { value: "", label: "Choose an event" },
      ...this.events().map((e: any) => ({
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

  filteredAndSortedEventRundown = computed(() => {
    let data = this.eventRundown();

    if (this.eventFilterText()) {
      const filter = this.eventFilterText().toLowerCase();
      data = data.filter((row) => {
        const carNumber = row.carNumber?.toString() ?? "";
        const driverName = row.driverName?.toLowerCase() ?? "";
        const driverClass = row.driverClass?.toLowerCase() ?? "";
        const incident = row.incidentDescription?.toLowerCase() ?? "";
        const penalty = row.penaltyName?.toLowerCase() ?? "";
        const timePenalty = row.timePenaltySeconds?.toString() ?? "";

        return (
          carNumber.includes(filter) ||
          driverName.includes(filter) ||
          driverClass.includes(filter) ||
          incident.includes(filter) ||
          penalty.includes(filter) ||
          timePenalty.includes(filter)
        );
      });
    }

    if (this.eventSortColumn()) {
      data = [...data].sort((a, b) => {
        const aVal = a[this.eventSortColumn() as keyof EventRundownRow] ?? "";
        const bVal = b[this.eventSortColumn() as keyof EventRundownRow] ?? "";

        if (typeof aVal === "string" && typeof bVal === "string") {
          return this.eventSortDirection() === "asc"
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        if (typeof aVal === "number" && typeof bVal === "number") {
          return this.eventSortDirection() === "asc"
            ? aVal - bVal
            : bVal - aVal;
        }

        return 0;
      });
    }

    return data;
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

  canViewSeriesStats = computed(() => {
    return this.authService.hasMinimumRole("head_steward");
  });

  visibleTabs = computed((): Tab[] => {
    const tabs: Tab[] = [{ id: "event_rundown", label: "Event Rundown" }];

    if (this.canViewSeriesStats()) {
      tabs.push({ id: "series_overview", label: "Series Overview" });
    }

    return tabs;
  });

  selectTab(tabId: string): void {
    if (tabId === "event_rundown" || tabId === "series_overview") {
      untracked(() => {
        this.activeTab.set(tabId as "event_rundown" | "series_overview");

        if (tabId === "event_rundown") {
          this.eventFilterText.set(this.seriesFilterText());
        } else {
          this.seriesFilterText.set(this.eventFilterText());
        }

        this.updateQueryParams({
          tab: tabId,
          event:
            tabId === "series_overview"
              ? undefined
              : this.selectedEventId || undefined,
          series:
            tabId === "event_rundown"
              ? undefined
              : this.selectedSeriesId || undefined,
          sortColumn:
            tabId === "event_rundown"
              ? this.eventSortColumn() || undefined
              : this.seriesSortColumn() || undefined,
          sortDirection:
            tabId === "event_rundown"
              ? this.eventSortDirection() || undefined
              : this.seriesSortDirection() || undefined,
        });
      });
    }
  }

  sortEventRundown(column: keyof EventRundownRow): void {
    if (this.eventSortColumn() === column) {
      this.eventSortDirection.set(
        this.eventSortDirection() === "asc" ? "desc" : "asc",
      );
    } else {
      this.eventSortColumn.set(column);
      this.eventSortDirection.set("asc");
    }
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

  getSortIcon(column: string, activeColumn: string, direction: string): string {
    if (column !== activeColumn) return "→";
    return direction === "asc" ? "↑" : "↓";
  }

  @ViewChild("eventRundownTable") eventRundownTable!: ElementRef;
  @ViewChild("seriesPointsTable") seriesPointsTable!: ElementRef;

  private unsubscribes: (() => void)[] = [];

  private updateQueryParams(params: Record<string, string | undefined>): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: "merge",
    });
  }

  private setupFilterDebounce(): void {
    this.eventFilterSubject
      .pipe(debounceTime(1000), takeUntilDestroyed(this.destroyRef))
      .subscribe((filterText) => {
        if (this.activeTab() === "event_rundown") {
          this.updateQueryParams({ filter: filterText || undefined });
        }
      });

    this.seriesFilterSubject
      .pipe(debounceTime(1000), takeUntilDestroyed(this.destroyRef))
      .subscribe((filterText) => {
        if (this.activeTab() === "series_overview") {
          this.updateQueryParams({ filter: filterText || undefined });
        }
      });
  }

  private applyQueryParamsFromUrl(
    params: Record<string, string | undefined>,
  ): void {
    let needsUpdate = false;
    const paramsToUpdate: Record<string, string | undefined> = {};

    if (
      params["tab"] === "event_rundown" ||
      params["tab"] === "series_overview"
    ) {
      this.activeTab.set(params["tab"] as "event_rundown" | "series_overview");
    }

    if (params["event"]) {
      const eventExists = this.events().some((e) => e._id === params["event"]);
      if (eventExists) {
        this.selectedEventId = params["event"];
        if (params["tab"] === "event_rundown") {
          this.loadEventRundown();
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
        this.selectedSeriesId = params["series"];
        if (params["tab"] === "series_overview") {
          this.loadSeriesPoints();
        }
      } else {
        paramsToUpdate["series"] = undefined;
        needsUpdate = true;
      }
    }

    if (params["filter"]) {
      this.eventFilterText.set(params["filter"]);
      this.seriesFilterText.set(params["filter"]);
    }

    if (params["sortColumn"] && params["sortDirection"]) {
      const validEventColumns = [
        "carNumber",
        "driverName",
        "driverClass",
        "incidentDescription",
        "penaltyName",
        "timePenaltySeconds",
      ];
      const validDirections = ["asc", "desc"];

      if (
        validEventColumns.includes(params["sortColumn"]) &&
        validDirections.includes(params["sortDirection"])
      ) {
        this.eventSortColumn.set(params["sortColumn"] as keyof EventRundownRow);
        this.eventSortDirection.set(params["sortDirection"] as "asc" | "desc");
      } else {
        paramsToUpdate["sortColumn"] = undefined;
        paramsToUpdate["sortDirection"] = undefined;
        needsUpdate = true;
      }
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
      } else if (!paramsToUpdate["sortColumn"]) {
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
    this.setupFilterDebounce();
    this.loadData();
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach((unsub) => unsub());
  }

  private loadData(): void {
    this.loading.set(true);

    const eventsQuery = this.convex.createReactiveQuery(
      this.convex.api.events.list,
      {},
    );
    this.unsubscribes.push(eventsQuery.unsubscribe);

    const checkEvents = setInterval(() => {
      const data = eventsQuery.data();
      if (data) {
        this.events.set(data);
        this.eventsLoaded.set(true);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkEvents));

    const seriesQuery = this.convex.createReactiveQuery(
      this.convex.api.series.list,
      {},
    );
    this.unsubscribes.push(seriesQuery.unsubscribe);

    const checkSeries = setInterval(() => {
      const data = seriesQuery.data();
      if (data) {
        this.series.set(data);
        this.seriesLoaded.set(true);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkSeries));

    // Failsafe: stop loading after 10 seconds regardless of state
    setTimeout(() => {
      this.loading.set(false);
    }, 10000);
  }

  async loadEventRundown(): Promise<void> {
    if (!this.selectedEventId) {
      this.eventRundown.set([]);
      this.updateQueryParams({ event: undefined });
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
      });
    } catch (error: any) {
      console.error("Failed to load event rundown:", error);
      this.eventRundown.set([]);
    }
  }

  async loadSeriesPoints(): Promise<void> {
    if (!this.selectedSeriesId) {
      this.seriesPoints.set([]);
      this.updateQueryParams({ series: undefined });
      return;
    }

    try {
      const data = await this.convex.query(
        this.convex.api.statistics.getSeriesLicensePointsWithPenalties,
        { seriesId: this.selectedSeriesId as any },
      );
      this.seriesPoints.set(data || []);
      this.updateQueryParams({
        series: this.selectedSeriesId,
        event: undefined,
      });
    } catch (error: any) {
      console.error("Failed to load series points:", error);
      this.seriesPoints.set([]);
    }
  }

  async exportEventRundownAsImage(): Promise<void> {
    if (!this.eventRundownTable) return;

    const element = this.eventRundownTable.nativeElement;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true,
      });

      const link = document.createElement("a");
      link.download = `event-rundown-${new Date().toISOString().split("T")[0]}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Failed to export event rundown as image:", error);
    }
  }

  async exportSeriesPointsAsImage(): Promise<void> {
    if (!this.seriesPointsTable) return;

    const element = this.seriesPointsTable.nativeElement;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true,
      });

      const link = document.createElement("a");
      link.download = `series-points-${new Date().toISOString().split("T")[0]}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Failed to export series points as image:", error);
    }
  }
}
