import {
  Component,
  inject,
  Input,
  OnInit,
  OnDestroy,
  signal,
  computed,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { ConvexService } from "@core/services/convex.service";
import { AuthService } from "@core/services/auth.service";
import { REPORT_TABS, ReportTabId } from "@core/models";
import { CardComponent } from "@shared/components/card/card.component";
import { ButtonComponent } from "@shared/components/button/button.component";
import { BadgeComponent } from "@shared/components/badge/badge.component";
import {
  SelectComponent,
  SelectOption,
} from "@shared/components/select/select.component";
import { LoadingComponent } from "@shared/components/loading/loading.component";
import { TabsComponent, Tab } from "@shared/components/tabs/tabs.component";
import { DateFormatPipe } from "@shared/pipes/date-format.pipe";

@Component({
  selector: "app-report-list",
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    SelectComponent,
    LoadingComponent,
    TabsComponent,
    DateFormatPipe,
  ],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div
        class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Reports
          </h1>
          <p class="text-gray-500 mt-1 dark:text-gray-400">
            View and manage incident reports
          </p>
        </div>
        <a routerLink="/reports/new">
          <app-button variant="primary">
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
                d="M12 4v16m8-8H4"
              ></path>
            </svg>
            New Report
          </app-button>
        </a>
      </div>

      <app-tabs
        [tabs]="visibleTabs()"
        [activeTab]="activeTab()"
      />

      <!-- Filters -->
      <app-card>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <app-select
            label="Series"
            [options]="seriesOptions()"
            [(ngModel)]="selectedSeries"
            (ngModelChange)="onSeriesChange()"
            placeholder="All series"
          />
          <app-select
            label="Status"
            [options]="statusOptions"
            [(ngModel)]="selectedStatus"
            (ngModelChange)="onStatusChange()"
            placeholder="All statuses"
          />
          <app-select
            label="Event"
            [options]="eventOptions()"
            [(ngModel)]="selectedEvent"
            (ngModelChange)="onEventChange()"
            placeholder="All events"
          />
          <app-select
            label="Session"
            [options]="raceOptions()"
            [(ngModel)]="selectedRace"
            (ngModelChange)="onRaceChange()"
            placeholder="All sessions"
          />
        </div>
      </app-card>

      <!-- Reports table -->
      <app-card [noPadding]="true">
        @if (loading()) {
          <div class="py-12">
            <app-loading text="Loading reports..." />
          </div>
        } @else if (filteredReports().length > 0) {
          <!-- Desktop table view -->
          <div class="hidden md:block overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 dark:bg-gray-800">
                <tr class="text-left text-sm text-gray-500 dark:text-gray-400">
                  <th class="px-6 py-3 font-medium">Ticket #</th>
                  <th class="px-6 py-3 font-medium">At Fault Driver</th>
                  @if (canViewReportingUser()) {
                    <th class="px-6 py-3 font-medium">Reporting Driver</th>
                  }
                  <th class="px-6 py-3 font-medium">Event</th>
                  <th class="px-6 py-3 font-medium">Date</th>
                  <th class="px-6 py-3 font-medium">Status</th>
                  <th class="px-6 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                @for (report of filteredReports(); track report._id) {
                  <tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td
                      class="px-6 py-4 text-gray-900 dark:text-gray-100 font-medium"
                    >
                      {{ report.reportId || "-" }}
                    </td>
                    <td class="px-6 py-4">
                      <p class="font-medium text-gray-900 dark:text-gray-100">
                        {{
                          report.atFaultDriver?.displayName ||
                            report.atFaultDriver?.officialName ||
                            report.atFaultDriver?.driverName ||
                            report.reportedDriver?.displayName ||
                            report.reportedDriver?.officialName ||
                            report.reportedDriver?.driverName
                        }}
                      </p>
                      <p class="text-sm text-gray-500 dark:text-gray-400">
                        #{{
                          report.atFaultDriver?.driverNumber ||
                            report.reportedDriver?.driverNumber
                        }}
                      </p>
                    </td>
                    @if (canViewReportingUser()) {
                      <td class="px-6 py-4">
                        <p class="text-gray-900 dark:text-gray-100">
                          {{
                            report.reportingUser?.officialName ||
                              report.reportingUser?.name ||
                              "Unknown User"
                          }}
                        </p>
                        @if (report.isStewardReported) {
                          <p class="text-sm text-gray-500 dark:text-gray-400">
                            <app-badge variant="info" size="sm"
                              >Steward</app-badge
                            >
                          </p>
                        }
                      </td>
                    }
                    <td class="px-6 py-4">
                      <p class="text-gray-900 dark:text-gray-100">
                        {{ report.event?.trackName }}
                      </p>
                      <p class="text-sm text-gray-500 dark:text-gray-400">
                        {{ getSessionName(report.race) }}
                      </p>
                    </td>
                    <td class="px-6 py-4 text-gray-500 dark:text-gray-400">
                      {{ report.reportDate | dateFormat: "PP" }}
                    </td>
                    <td class="px-6 py-4">
                      <app-badge [variant]="getStatusVariant(report.status)">
                        {{ formatReportStatus(report.status) }}
                      </app-badge>
                    </td>
                    <td class="px-6 py-4">
                      <a
                        [routerLink]="['/reports', report._id]"
                        class="text-primary-600 hover:text-primary-700 font-medium text-sm dark:text-primary-400 dark:hover:text-primary-300"
                      >
                        View
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Mobile card view -->
          <div class="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
            @for (report of filteredReports(); track report._id) {
              <a
                [routerLink]="['/reports', report._id]"
                class="block p-4 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <div class="flex items-start justify-between gap-3 mb-2">
                  <div class="min-w-0 flex-1">
                    <p class="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {{ report.reportId || "-" }}
                    </p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{ report.reportDate | dateFormat: "PP" }}
                    </p>
                  </div>
                  <app-badge [variant]="getStatusVariant(report.status)" size="sm">
                    {{ formatReportStatus(report.status) }}
                  </app-badge>
                </div>
                <div class="space-y-1 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-500 dark:text-gray-400">At Fault</span>
                    <span class="text-gray-900 dark:text-gray-100 font-medium">
                      {{ report.atFaultDriver?.displayName || report.atFaultDriver?.driverName || report.reportedDriver?.driverName }}
                      #{{ report.atFaultDriver?.driverNumber || report.reportedDriver?.driverNumber }}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500 dark:text-gray-400">Event</span>
                    <span class="text-gray-900 dark:text-gray-100">
                      {{ report.event?.trackName }} - {{ getSessionName(report.race) }}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500 dark:text-gray-400">Turn</span>
                    <span class="text-gray-900 dark:text-gray-100">{{ report.turn }}</span>
                  </div>
                  @if (canViewReportingUser() && report.reportingUser) {
                    <div class="flex justify-between items-center">
                      <span class="text-gray-500 dark:text-gray-400">Reported by</span>
                      <span class="text-gray-900 dark:text-gray-100 flex items-center gap-1">
                        {{ report.reportingUser?.officialName || report.reportingUser?.name || "Unknown" }}
                        @if (report.isStewardReported) {
                          <app-badge variant="info" size="sm">Steward</app-badge>
                        }
                      </span>
                    </div>
                  }
                </div>
              </a>
            }
          </div>
        } @else {
          <div class="text-center py-12">
            <svg
              class="w-12 h-12 text-gray-300 mx-auto mb-4 dark:text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              ></path>
            </svg>
            <p class="text-gray-500 mb-4 dark:text-gray-400">
              No reports found
            </p>
            <a routerLink="/reports/new">
              <app-button variant="primary">File a Report</app-button>
            </a>
          </div>
        }
      </app-card>
    </div>
  `,
})
export class ReportListComponent implements OnInit, OnDestroy {
  @Input() tabId: ReportTabId = REPORT_TABS.MY;

  private convex = inject(ConvexService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private readonly validTabs = Object.values(REPORT_TABS) as readonly ReportTabId[];

  canViewReportingUser = computed(() =>
    this.authService.hasMinimumRole("steward"),
  );
  canViewAllReportsTab = computed(() =>
    this.authService.hasMinimumRole("steward"),
  );

  activeTab = signal<ReportTabId>(REPORT_TABS.MY);
  visibleTabs(): Tab[] {
    const queryParams = this.getFilterQueryParams();
    const tabs: Tab[] = [
      {
        id: REPORT_TABS.MY,
        label: "My Reports",
        routeCommands: ["/reports", "my"],
        queryParams,
      },
      {
        id: REPORT_TABS.FINALIZED,
        label: "All Finalized Reports",
        routeCommands: ["/reports", "finalized"],
        queryParams,
      },
    ];

    if (this.canViewAllReportsTab()) {
      tabs.push({
        id: REPORT_TABS.ALL,
        label: "All Reports",
        routeCommands: ["/reports", "all"],
        queryParams,
      });
    }

    return tabs;
  }

  reports = signal<any[]>([]);
  filteredReports = signal<any[]>([]);
  events = signal<any[]>([]);
  races = signal<any[]>([]);
  activeSeries = signal<any[]>([]);
  userSeriesIds = signal<string[]>([]);
  loading = signal(true);

  selectedStatus = "";
  selectedEvent = "";
  selectedSeries = "";
  selectedRace = "";

  statusOptions: SelectOption[] = [
    { value: "", label: "All statuses" },
    { value: "pending", label: "Pending" },
    { value: "reviewed", label: "Reviewed" },
    { value: "finalized", label: "Finalized" },
    { value: "rejected", label: "Rejected" },
  ];

  activeSeriesIds = computed(() =>
    this.activeSeries().map((s) => s._id.toString()),
  );

  seriesOptions(): SelectOption[] {
    return [
      { value: "", label: "All series" },
      ...this.activeSeries().map((s: any) => ({
        value: s._id.toString(),
        label: s.name,
      })),
    ];
  }

  eventOptions(): SelectOption[] {
    const activeIds = this.activeSeriesIds();
    let filteredEvents = this.events().filter((e) =>
      activeIds.includes(e.seriesId.toString()),
    );

    // Further filter by selected series if one is chosen
    if (this.selectedSeries) {
      filteredEvents = filteredEvents.filter(
        (e) => e.seriesId.toString() === this.selectedSeries.toString(),
      );
    }

    return [
      { value: "", label: "All events" },
      ...filteredEvents.map((e: any) => ({
        value: e._id.toString(),
        label: `${e.trackName} (${e.series.name})`,
      })),
    ];
  }

  raceOptions(): SelectOption[] {
    if (!this.selectedEvent) {
      return [{ value: "", label: "Select an event first" }];
    }

    let filteredRaces = this.races().filter(
      (r) => r.eventId?.toString() === this.selectedEvent.toString(),
    );
    filteredRaces = [...filteredRaces].sort((a, b) => {
      const aRaceNumber = typeof a.raceNumber === "number" ? a.raceNumber : Number.MAX_SAFE_INTEGER;
      const bRaceNumber = typeof b.raceNumber === "number" ? b.raceNumber : Number.MAX_SAFE_INTEGER;
      return aRaceNumber - bRaceNumber;
    });

    return [
      { value: "", label: "All sessions" },
      ...filteredRaces.map((r: any) => ({
        value: r._id.toString(),
        label: this.getSessionName(r),
      })),
    ];
  }

  private unsubscribes: (() => void)[] = [];

  ngOnInit(): void {
    this.applyRouteTab();
    this.loadData();
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach((unsub) => unsub());
  }

  private loadData(): void {
    // Load reports
    const reportsQuery = this.convex.createReactiveQuery(
      this.convex.api.reports.list,
      {},
    );
    this.unsubscribes.push(reportsQuery.unsubscribe);

    const checkReports = setInterval(() => {
      const data = reportsQuery.data();
      if (data) {
        this.reports.set(data);
        this.filterReports();
        this.loading.set(false);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkReports));

    // Load events for filter
    const eventsQuery = this.convex.createReactiveQuery(
      this.convex.api.events.list,
      {},
    );
    this.unsubscribes.push(eventsQuery.unsubscribe);

    const checkEvents = setInterval(() => {
      const data = eventsQuery.data();
      if (data) {
        this.events.set(data);
        this.filterReports();
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkEvents));

    // Load active series for filtering events
    const activeSeriesQuery = this.convex.createReactiveQuery(
      this.convex.api.series.listActive,
      {},
    );
    this.unsubscribes.push(activeSeriesQuery.unsubscribe);

    const checkActiveSeries = setInterval(() => {
      const data = activeSeriesQuery.data();
      if (data) {
        this.activeSeries.set(data);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkActiveSeries));

    // Load races for filter
    const racesQuery = this.convex.createReactiveQuery(
      this.convex.api.races.list,
      {},
    );
    this.unsubscribes.push(racesQuery.unsubscribe);

    const checkRaces = setInterval(() => {
      const data = racesQuery.data();
      if (data) {
        this.races.set(data);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkRaces));

    // Load user's series memberships if they're a driver
    if (this.authService.userRole() === "driver") {
      const currentUserId = this.authService.getUserId();
      if (currentUserId) {
        const userSeriesQuery = this.convex.createReactiveQuery(
          this.convex.api.drivers.getSeriesIdsForUser,
          { userId: currentUserId },
        );
        this.unsubscribes.push(userSeriesQuery.unsubscribe);

        const checkUserSeries = setInterval(() => {
          const data = userSeriesQuery.data();
          if (data) {
            this.userSeriesIds.set(data.map((id: any) => id.toString()));
            this.filterReports();
          }
        }, 100);
        this.unsubscribes.push(() => clearInterval(checkUserSeries));
      }
    }

    const queryParamsSubscription = this.route.queryParams.subscribe((params) => {
      this.selectedSeries = typeof params["series"] === "string" ? params["series"] : "";
      this.selectedStatus = typeof params["status"] === "string" ? params["status"] : "";
      this.selectedEvent = typeof params["event"] === "string" ? params["event"] : "";
      this.selectedRace = typeof params["race"] === "string" ? params["race"] : "";
      this.filterReports();
    });
    this.unsubscribes.push(() => queryParamsSubscription.unsubscribe());
  }

  onSeriesChange(): void {
    this.selectedEvent = "";
    this.selectedRace = "";
    this.filterReports();
    this.syncQueryParams();
  }

  onEventChange(): void {
    this.selectedRace = "";
    this.filterReports();
    this.syncQueryParams();
  }

  onStatusChange(): void {
    this.filterReports();
    this.syncQueryParams();
  }

  onRaceChange(): void {
    this.filterReports();
    this.syncQueryParams();
  }

  filterReports(): void {
    let filtered = [...this.reports()];

    // Base access: drivers can see their own reports and finalized reports in their series.
    const userRole = this.authService.userRole();
    const currentUserId = this.authService.getUserId();
    const userSeries = this.userSeriesIds();
    if (userRole === "driver") {
      filtered = filtered.filter((report) => {
        if (report.reportingUserId === currentUserId) return true;

        if (report.status === "finalized") {
          const event = this.events().find(
            (e) => e._id?.toString() === report.eventId?.toString(),
          );
          return event && userSeries.includes(event.seriesId.toString());
        }
        return false;
      });
    }

    if (this.activeTab() === REPORT_TABS.MY) {
      filtered = filtered.filter((report) => report.reportingUserId === currentUserId);
    } else if (this.activeTab() === REPORT_TABS.FINALIZED) {
      filtered = filtered.filter((report) => report.status === "finalized");
    } else if (this.activeTab() === REPORT_TABS.ALL) {
      // If user doesn't have access to all_reports, they'll see filtered results
      // based on the access control above (driver role check)
      if (!this.canViewAllReportsTab()) {
        filtered = filtered.filter((report) => report.reportingUserId === currentUserId);
      }
    }

    // Filter by series
    if (this.selectedSeries) {
      filtered = filtered.filter((r) => {
        const event = this.events().find(
          (e) => e._id?.toString() === r.eventId?.toString(),
        );
        return event && event.seriesId?.toString() === this.selectedSeries;
      });
    }

    if (this.selectedStatus) {
      filtered = filtered.filter((r) => r.status === this.selectedStatus);
    }

    if (this.selectedEvent) {
      filtered = filtered.filter(
        (r) => r.eventId?.toString() === this.selectedEvent,
      );
    }

    if (this.selectedRace) {
      filtered = filtered.filter(
        (r) => r.raceId?.toString() === this.selectedRace,
      );
    }

    this.filteredReports.set(filtered);
  }

  private isValidTab(tabId: string): tabId is ReportTabId {
    return this.validTabs.includes(
      tabId as ReportTabId,
    );
  }

  formatReportStatus(status: string | undefined): string {
    if (!status) return "";
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  getStatusVariant(status: string): "warning" | "info" | "success" | "danger" {
    switch (status) {
      case "pending":
        return "warning";
      case "reviewed":
        return "info";
      case "finalized":
        return "success";
      case "rejected":
        return "danger";
      default:
        return "info";
    }
  }

  getSessionName(race: { sessionName?: string; raceNumber?: number } | null | undefined): string {
    if (race?.sessionName?.trim()) return race.sessionName.trim();
    if (typeof race?.raceNumber === "number") return `Race ${race.raceNumber}`;
    return "Session";
  }

  private applyRouteTab(): void {
    const requestedTab = this.isValidTab(this.tabId) ? this.tabId : REPORT_TABS.MY;

    // Always follow the URL - if user doesn't have access to the requested tab,
    // fall back to a tab they can access without redirecting
    if (requestedTab === REPORT_TABS.ALL && !this.canViewAllReportsTab()) {
      this.activeTab.set(REPORT_TABS.MY);
      return;
    }

    this.activeTab.set(requestedTab);
  }

  private getFilterQueryParams(): Record<string, string | undefined> {
    return {
      series: this.selectedSeries || undefined,
      status: this.selectedStatus || undefined,
      event: this.selectedEvent || undefined,
      race: this.selectedRace || undefined,
    };
  }

  private syncQueryParams(): void {
    const currentQueryParams = this.route.snapshot.queryParams as Record<string, unknown>;
    const queryParams = this.getMergedQueryParams(currentQueryParams);

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
  ): Record<string, string | undefined> {
    const preservedParams: Record<string, string | undefined> = {};
    const filterKeys = new Set(["series", "status", "event", "race"]);

    Object.entries(currentQueryParams).forEach(([key, value]) => {
      if (!filterKeys.has(key) && typeof value === "string" && value) {
        preservedParams[key] = value;
      }
    });

    return {
      ...preservedParams,
      ...this.getFilterQueryParams(),
    };
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
}
