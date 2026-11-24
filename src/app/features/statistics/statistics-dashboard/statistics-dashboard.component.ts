import {
  Component,
  DestroyRef,
  HostBinding,
  inject,
  Input,
  OnDestroy,
  OnInit,
  signal,
  untracked,
  computed,
  effect,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { toPng } from "html-to-image";
import { debounceTime, Subject } from "rxjs";
import { ConvexService } from "@core/services/convex.service";
import { AuthService } from "@core/services/auth.service";
import { SidebarStateService } from "@core/services/sidebar-state.service";
import { STATISTICS_TABS, StatisticsTabId } from "@core/models";
import { areQueryParamsEqual } from "@core/utils/query-params.utils";
import { LoadingComponent } from "@shared/components/loading/loading.component";
import {
  LegendItem,
} from "@shared/components/legend/legend.component";
import {
  SelectOption,
} from "@shared/components/select/select.component";
import { TabsComponent, Tab } from "@shared/components/tabs/tabs.component";

import { TimePenaltySummaryComponent } from "./time-penalty-summary.component";
import { SeriesOverviewComponent } from "./series-overview.component";
import { EventRundownComponent } from "./event-rundown.component";
import type { EventRundownRow, RaceRundown, DriverPointsRow, SeriesPenaltyDefinition, DriverTimePenaltyRow, RaceTimePenaltySummary } from "./statistics-dashboard.models";

@Component({
  selector: "app-statistics-dashboard",
  standalone: true,
  imports: [LoadingComponent, TabsComponent, EventRundownComponent, SeriesOverviewComponent, TimePenaltySummaryComponent],
  templateUrl: "./statistics-dashboard.component.html",
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

  readonly selectedEventId = signal("");
  readonly selectedSeriesId = signal("");
  readonly timePenaltySeriesId = signal("");
  readonly timePenaltyEventId = signal("");
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
          description: "Self-reported incident (penalty adjusted)",
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
    if (!this.timePenaltySeriesId()) {
      return [{ value: "", label: "Choose a series first" }];
    }

    const filteredEvents = this.events().filter(
      (e) => e.seriesId.toString() === this.timePenaltySeriesId(),
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
      (event: any) => event._id === this.selectedEventId(),
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
      (series: any) => series._id === this.selectedSeriesId(),
    );
    return selectedSeries?.name ?? "";
  });

  selectedTimePenaltySeries = computed(() => {
    const selectedSeries = this.series().find(
      (series: any) => series._id === this.timePenaltySeriesId(),
    );
    return selectedSeries;
  });

  selectedTimePenaltyEvent = computed(() => {
    const selectedEvent = this.events().find(
      (event: any) => event._id === this.timePenaltyEventId(),
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

  private unsubscribes: (() => void)[] = [];

  private updateQueryParams(params: Record<string, string | undefined>): void {
    const currentQueryParams = this.route.snapshot.queryParams as Record<
      string,
      unknown
    >;
    const queryParams = this.getMergedQueryParams(currentQueryParams, params);

    if (areQueryParamsEqual(currentQueryParams, queryParams)) {
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
          this.selectedEventId.set(params["event"]);
          this.loadEventRundown();
        } else if (this.activeTab() === STATISTICS_TABS.TIME_PENALTY_SUMMARY) {
          this.timePenaltyEventId.set(params["event"]);
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
          this.selectedSeriesId.set(params["series"]);
          this.timePenaltySeriesId.set(params["series"]);
          this.loadSeriesPoints();
        } else if (this.activeTab() === STATISTICS_TABS.TIME_PENALTY_SUMMARY) {
          this.timePenaltySeriesId.set(params["series"]);
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
    if (!this.selectedEventId()) {
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
        { eventId: this.selectedEventId() as any },
      );
      this.eventRundown.set(data || []);
      this.updateQueryParams({
        event: this.selectedEventId(),
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
    if (!this.selectedSeriesId()) {
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
          { seriesId: this.selectedSeriesId() as any },
        ),
        this.convex.query(this.convex.api.seriesPenalties.listBySeries, {
          seriesId: this.selectedSeriesId() as any,
        }),
      ]);
      this.seriesPoints.set(data || []);
      this.seriesPenaltyDefinitions.set((seriesPenalties as any[]) || []);
      this.updateQueryParams({
        series: this.selectedSeriesId(),
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
    if (!this.timePenaltyEventId()) {
      this.timePenaltySummary.set([]);
      this.updateQueryParams({
        series: this.timePenaltySeriesId() || undefined,
        event: undefined,
        sortColumn: undefined,
        sortDirection: undefined,
      });
      return;
    }

    try {
      const data = await this.convex.query(
        this.convex.api.statistics.getEventTimePenaltySummary,
        { eventId: this.timePenaltyEventId() as any },
      );
      this.timePenaltySummary.set(data || []);
      this.updateQueryParams({
        series: this.timePenaltySeriesId() || undefined,
        event: this.timePenaltyEventId(),
        sortColumn: undefined,
        sortDirection: undefined,
      });
    } catch (error: any) {
      console.error("Failed to load time penalty summary:", error);
      this.timePenaltySummary.set([]);
    }
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
    element: HTMLElement,
    filename: string,
  ): Promise<void> {
    if (!element) {
      console.error("Export container not found");
      return;
    }

    // Activate export mode for clean UI
    this.isExportMode.set(true);
    this.sidebarStateService.setExportMode(true);

    // Wait for DOM to update and render
    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      const dataUrl = await toPng(element, {
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
        event: this.selectedEventId() || undefined,
        filter,
        series: undefined,
        sortColumn: undefined,
        sortDirection: undefined,
      };
    }

    if (tabId === STATISTICS_TABS.SERIES_OVERVIEW) {
      return {
        series: this.selectedSeriesId() || undefined,
        filter,
        sortColumn: this.seriesSortColumn() || undefined,
        sortDirection: this.seriesSortDirection() || undefined,
        event: undefined,
      };
    }

    return {
      series: this.timePenaltySeriesId() || undefined,
      event: this.timePenaltyEventId() || undefined,
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
