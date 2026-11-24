import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  computed,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ConvexService } from "@core/services/convex.service";
import { AuthService } from "@core/services/auth.service";
import { CardComponent } from "@shared/components/card/card.component";
import { ButtonComponent } from "@shared/components/button/button.component";
import { BadgeComponent } from "@shared/components/badge/badge.component";
import { LoadingComponent } from "@shared/components/loading/loading.component";
import type { MultiSelectOption } from "@shared/components/multi-select/multi-select.component";
import {
  Series,
  Penalty,
  SeriesPenalty,
  SeriesPenaltyThreshold,
  SeriesCopyPreview,
  SeriesCopyResult,
  ScheduledImportStatus,
} from "@core/models/series.model";
import { DriverClass } from "@core/models/driver.model";
import { Id } from "@convex/_generated/dataModel";

import { SeriesPenaltyFormModalComponent } from "./series-penalty-form-modal.component";
import { PenaltyFormModalComponent } from "./penalty-form-modal.component";
import { SeriesFormModalComponent } from "./series-form-modal.component";
import { CopySeriesModalComponent } from "./copy-series-modal.component";
import { ScheduledImportSectionComponent } from "./scheduled-import-section.component";
import type { PenaltyForm, PenaltyThresholdForm, SeriesForm, SeriesPenaltyForm } from "./series-management.models";
import { DAYS_OF_WEEK, formatDaysOfWeek, formatSeriesDateRange } from "./scheduled-import.utils";

@Component({
  selector: "app-series-management",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    LoadingComponent,
    SeriesPenaltyFormModalComponent,
    PenaltyFormModalComponent,
    SeriesFormModalComponent,
    CopySeriesModalComponent,
    ScheduledImportSectionComponent,
  ],
  templateUrl: "./series-management.component.html",
})
export class SeriesManagementComponent implements OnInit, OnDestroy {
  private convex = inject(ConvexService);
  private authService = inject(AuthService);

  series = signal<Series[]>([]);
  penalties = signal<Penalty[]>([]);
  seriesPenalties = signal<SeriesPenalty[]>([]);
  availableDriverClasses = signal<DriverClass[]>([]);
  seriesPenaltyThresholds = signal<Map<string, any[]>>(new Map());
  loading = signal(true);
  expandedSeriesIds = signal<Set<Id<"series">>>(new Set());

  showSeriesModal = false;
  showPenaltyModal = false;
  showSeriesPenaltyModal = false;
  showSeriesPenaltyThresholdModal = false;
  showCopySeriesModal = false;
  editingSeriesId: Id<"series"> | null = null;
  editingPenaltyId: Id<"penalties"> | null = null;
  editingSeriesPenaltyId: Id<"seriesPenalties"> | null = null;
  editingSeriesPenaltyThresholdId: Id<"seriesPenaltyThresholds"> | null = null;
  isEditingThresholds = false;

  seriesForm: SeriesForm = {
    name: "",
    description: "",
    simgridLink: "",
    reportingOpenTime: "",
    reportingCloseDuration: 0,
    isReportingLocked: false,
    requireVideoEvidence: false,
    isActive: true,
    seriesPenaltyNotes: "",
  };

  penaltyForm: PenaltyForm = {
    seriesId: "" as Id<"series"> | "",
    name: "",
    timePenalty: 0,
    selfReportReduction: 0,
    timePenaltyLap1: 0,
    licensePoints: 0,
    selfReportLicensePointReduction: 0,
    allowNoDriverAtFault: false,
  };

  seriesPenaltyForm: SeriesPenaltyForm = {
    seriesId: "" as Id<"series"> | "",
    penaltyName: "",
    penaltyDescription: "",
  };

  seriesPenaltyThresholdForm = {
    driverClass: "",
    threshold: 0,
  };

  selectedDriverClasses = signal<MultiSelectOption[]>([]);
  classThresholds: Record<string, number> = {};
  loadingDriverClasses = false;

  // Driver Class Management
  showDriverClassModal = false;
  editingDriverClassSeriesId: Id<"series"> | null = null;
  driverClassesForManagement = signal<any[]>([]);
  editingDriverClassId: Id<"driverClasses"> | null = null;
  editingDriverClassName = "";

  // Driver classes by series for main page display
  driverClassesBySeries = signal<Map<Id<"series">, any[]>>(new Map());
  private driverClassesSubscriptions: Map<Id<"series">, () => void> = new Map();

  thresholds: PenaltyThresholdForm[] = [];

  selectedClassCount = computed(
    () => this.selectedDriverClasses().filter((opt) => opt.selected).length,
  );

  selectedClasses = computed(() =>
    this.selectedDriverClasses().filter((opt) => opt.selected),
  );

  copySourceSeriesOptions = computed(() =>
    this.series().filter((series) => series._id !== this.copyTargetSeries?._id),
  );

  timezoneDisplay = computed(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = new Date().getTimezoneOffset();
    const offsetHours = Math.abs(Math.floor(offset / 60));
    const offsetMinutes = Math.abs(offset % 60);
    const sign = offset <= 0 ? '+' : '-';
    return `${timeZone} (UTC${sign}${offsetHours.toString().padStart(2, '0')}:${offsetMinutes.toString().padStart(2, '0')})`;
  });

  private unsubscribes: (() => void)[] = [];
  importing = signal(false);
  importResult = signal<{ created: number; skipped: number } | null>(null);
  copyLoading = signal(false);
  copyPreview = signal<SeriesCopyPreview | null>(null);
  copyResult = signal<SeriesCopyResult | null>(null);
  copyTargetSeries: Series | null = null;
  copySourceSeriesId: Id<"series"> | "" = "";

  scheduledImportStatuses = signal<Map<Id<"series">, ScheduledImportStatus>>(new Map());
  showScheduleModal = false;
  scheduleForm = {
    seriesId: null as Id<"series"> | null,
    scheduledImportTime: "",
    scheduledImportDays: [] as number[],
  };
  scheduleSaving = signal(false);

  readonly DAYS_OF_WEEK = DAYS_OF_WEEK;

  ngOnInit(): void {
    this.loadSeries();
    this.loadPenalties();
    this.loadSeriesPenalties();
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach((unsub) => unsub());
  }

  private loadSeries(): void {
    const seriesQuery = this.convex.createReactiveQuery(
      this.convex.api.series.list,
      {},
      (data) => {
        this.series.set(data);
        this.loading.set(false);

        data.forEach((s: Series) => {
          this.subscribeToDriverClassesForSeries(s._id);
          this.subscribeToScheduledImportStatus(s._id);
        });
      }
    );
    this.unsubscribes.push(seriesQuery.unsubscribe);
  }

  private subscribeToScheduledImportStatus(seriesId: Id<"series">): void {
    const query = this.convex.createReactiveQuery(
      (this.convex.api as any).scheduledImports.getScheduleStatus,
      { seriesId },
      (data) => {
        this.scheduledImportStatuses.update((map) => {
          const newMap = new Map(map);
          newMap.set(seriesId, data);
          return newMap;
        });
      }
    );
    this.unsubscribes.push(query.unsubscribe);
  }

  private loadPenalties(): void {
    const penaltiesQuery = this.convex.createReactiveQuery(
      this.convex.api.penalties.list,
      {},
      (data) => {
        const validPenalties = data
          .filter((p: any) => p.series !== null)
          .map((p: any) => ({
            ...p,
            series: p.series || undefined,
          }));
        this.penalties.set(validPenalties);
      }
    );
    this.unsubscribes.push(penaltiesQuery.unsubscribe);
  }

  private loadSeriesPenalties(): void {
    const seriesPenaltiesQuery = this.convex.createReactiveQuery(
      this.convex.api.seriesPenalties.list,
      {},
      (data) => {
        const validSeriesPenalties = data.map((sp: any) => ({
          ...sp,
          series: sp.series || undefined,
        }));
        this.seriesPenalties.set(validSeriesPenalties);
      }
    );
    this.unsubscribes.push(seriesPenaltiesQuery.unsubscribe);
  }

  getSeriesPenalties(seriesId: Id<"series">): Penalty[] {
    return this.penalties().filter((p) => p.seriesId === seriesId);
  }

  isSeriesExpanded(seriesId: Id<"series">): boolean {
    return this.expandedSeriesIds().has(seriesId);
  }

  toggleSeriesExpanded(seriesId: Id<"series">): void {
    this.expandedSeriesIds.update((expandedSeriesIds) => {
      const next = new Set(expandedSeriesIds);
      if (next.has(seriesId)) {
        next.delete(seriesId);
      } else {
        next.add(seriesId);
      }
      return next;
    });
  }

  editSeries(series: Series): void {
    this.editingSeriesId = series._id;
    this.seriesForm = {
      name: series.name,
      description: series.description || "",
      simgridLink: series.simgridLink || "",
      reportingOpenTime: this.utcToLocalTime(series.reportingOpenTime || ""),
      reportingCloseDuration: series.reportingCloseDuration || 0,
      isReportingLocked: series.isReportingLocked || false,
      requireVideoEvidence: series.requireVideoEvidence || false,
      isActive: series.isActive !== false,
      seriesPenaltyNotes: series.seriesPenaltyNotes || "",
    };
    this.showSeriesModal = true;
  }

  async saveSeries(): Promise<void> {
    const utcTime = this.seriesForm.reportingOpenTime
      ? this.localToUtcTime(this.seriesForm.reportingOpenTime)
      : "";
    
    if (this.editingSeriesId) {
      await this.convex.mutation(this.convex.api.series.update, {
        id: this.editingSeriesId,
        currentUserId: this.authService.requireUserId(),
        name: this.seriesForm.name,
        description: this.seriesForm.description || undefined,
        simgridLink: this.seriesForm.simgridLink || undefined,
        reportingOpenTime: utcTime,
        reportingCloseDuration:
          this.seriesForm.reportingCloseDuration || undefined,
        isReportingLocked: this.seriesForm.isReportingLocked,
        requireVideoEvidence: this.seriesForm.requireVideoEvidence,
        isActive: this.seriesForm.isActive,
        seriesPenaltyNotes: this.seriesForm.seriesPenaltyNotes || undefined,
      });
    } else {
      await this.convex.mutation(this.convex.api.series.create, {
        currentUserId: this.authService.requireUserId(),
        name: this.seriesForm.name,
        description: this.seriesForm.description || undefined,
        simgridLink: this.seriesForm.simgridLink || undefined,
        reportingOpenTime: utcTime,
        reportingCloseDuration:
          this.seriesForm.reportingCloseDuration || undefined,
        isReportingLocked: this.seriesForm.isReportingLocked,
        requireVideoEvidence: this.seriesForm.requireVideoEvidence,
        isActive: this.seriesForm.isActive,
        seriesPenaltyNotes: this.seriesForm.seriesPenaltyNotes || undefined,
      });
    }
    this.closeSeriesModal();
  }

  async deleteSeries(seriesId: Id<"series">): Promise<void> {
    if (
      confirm(
        "Are you sure you want to delete this series? This will fail if there are existing events.",
      )
    ) {
      try {
        await this.convex.mutation(this.convex.api.series.remove, {
          id: seriesId,
          currentUserId: this.authService.requireUserId(),
        });
      } catch (error: any) {
        alert(error.message);
      }
    }
  }

  closeSeriesModal(): void {
    this.showSeriesModal = false;
    this.editingSeriesId = null;
    this.seriesForm = {
      name: "",
      description: "",
      simgridLink: "",
      reportingOpenTime: "",
      reportingCloseDuration: 0,
      isReportingLocked: false,
      requireVideoEvidence: false,
      isActive: true,
      seriesPenaltyNotes: "",
    };
  }

  private utcToLocalTime(utcTime: string | null | undefined): string {
    if (!utcTime) return "";
    const [hours, minutes] = utcTime.split(":").map(Number);
    const utcDate = new Date();
    utcDate.setUTCHours(hours, minutes, 0, 0);
    return utcDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  private localToUtcTime(localTime: string): string {
    if (!localTime) return "";
    const [hours, minutes] = localTime.split(":").map(Number);
    const localDate = new Date();
    localDate.setHours(hours, minutes, 0, 0);
    return localDate.getUTCHours().toString().padStart(2, "0") + ":" + localDate.getUTCMinutes().toString().padStart(2, "0");
  }

  addPenalty(seriesId: Id<"series">): void {
    this.penaltyForm.seriesId = seriesId;
    this.showPenaltyModal = true;
  }

  editPenalty(penalty: Penalty): void {
    this.editingPenaltyId = penalty._id;
    this.penaltyForm = {
      seriesId: penalty.seriesId,
      name: penalty.name,
      timePenalty: penalty.timePenalty,
      selfReportReduction: penalty.selfReportReduction ?? 0,
      timePenaltyLap1: penalty.timePenaltyLap1,
      licensePoints: penalty.licensePoints,
      selfReportLicensePointReduction:
        penalty.selfReportLicensePointReduction ?? 0,
      allowNoDriverAtFault: penalty.allowNoDriverAtFault ?? false,
    };
    this.showPenaltyModal = true;
  }

  async savePenalty(): Promise<void> {
    if (this.editingPenaltyId) {
      await this.convex.mutation(this.convex.api.penalties.update, {
        id: this.editingPenaltyId,
        currentUserId: this.authService.requireUserId(),
        name: this.penaltyForm.name,
        timePenalty: this.penaltyForm.timePenalty,
        selfReportReduction: this.penaltyForm.selfReportReduction,
        timePenaltyLap1: this.penaltyForm.timePenaltyLap1,
        licensePoints: this.penaltyForm.licensePoints,
        selfReportLicensePointReduction:
          this.penaltyForm.selfReportLicensePointReduction,
        allowNoDriverAtFault: this.penaltyForm.allowNoDriverAtFault,
      });
    } else {
      if (!this.penaltyForm.seriesId) return;
      await this.convex.mutation(this.convex.api.penalties.create, {
        currentUserId: this.authService.requireUserId(),
        seriesId: this.penaltyForm.seriesId as Id<"series">,
        name: this.penaltyForm.name,
        timePenalty: this.penaltyForm.timePenalty,
        selfReportReduction: this.penaltyForm.selfReportReduction,
        timePenaltyLap1: this.penaltyForm.timePenaltyLap1,
        licensePoints: this.penaltyForm.licensePoints,
        selfReportLicensePointReduction:
          this.penaltyForm.selfReportLicensePointReduction,
        allowNoDriverAtFault: this.penaltyForm.allowNoDriverAtFault,
      });
    }
    this.closePenaltyModal();
  }

  async deletePenalty(penaltyId: Id<"penalties">): Promise<void> {
    if (confirm("Are you sure you want to delete this penalty?")) {
      await this.convex.mutation(this.convex.api.penalties.remove, {
        id: penaltyId,
        currentUserId: this.authService.requireUserId(),
      });
    }
  }

  closePenaltyModal(): void {
    this.showPenaltyModal = false;
    this.editingPenaltyId = null;
    this.penaltyForm = {
      seriesId: "" as Id<"series"> | "",
      name: "",
      timePenalty: 0,
      selfReportReduction: 0,
      timePenaltyLap1: 0,
      licensePoints: 0,
      selfReportLicensePointReduction: 0,
      allowNoDriverAtFault: false,
    };
  }

  getSeriesPenaltiesBySeries(seriesId: Id<"series">): SeriesPenalty[] {
    return this.seriesPenalties().filter((sp) => sp.seriesId === seriesId);
  }

  addSeriesPenalty(seriesId: Id<"series">): void {
    this.loadingDriverClasses = true;
    this.editingSeriesPenaltyId = null;
    this.seriesPenaltyForm.seriesId = seriesId;
    this.seriesPenaltyForm.penaltyName = "";
    this.seriesPenaltyForm.penaltyDescription = "";
    this.thresholds = [];

    // Show modal immediately, then fetch data
    this.showSeriesPenaltyModal = true;

    // Fetch driver classes for this series asynchronously
    this.convex
      .query(this.convex.api.driverClasses.getDriverClassesWithUsage, {
        seriesId,
      })
      .then((classes) => {
        this.availableDriverClasses.set(classes);
        this.loadingDriverClasses = false;
      })
      .catch((error) => {
        console.error("Failed to load driver classes:", error);
        this.loadingDriverClasses = false;
      });
  }

  editSeriesPenalty(seriesPenalty: SeriesPenalty): void {
    this.loadingDriverClasses = true;
    this.editingSeriesPenaltyId = seriesPenalty._id;
    this.seriesPenaltyForm.seriesId = seriesPenalty.seriesId;
    this.seriesPenaltyForm.penaltyName = seriesPenalty.penaltyName;
    this.seriesPenaltyForm.penaltyDescription =
      seriesPenalty.penaltyDescription || "";

    this.thresholds =
      seriesPenalty.thresholds?.map((t: SeriesPenaltyThreshold) => ({
        id: t._id,
        threshold: t.threshold,
        requiresReview: t.requiresReview ?? false,
        selectedDriverClasses:
          t.driverClassIds?.map((id) => id.toString()) || [],
      })) || [];

    // Show modal immediately, then fetch data
    this.showSeriesPenaltyModal = true;

    // Fetch driver classes for this series asynchronously
    this.convex
      .query(this.convex.api.driverClasses.getDriverClassesWithUsage, {
        seriesId: seriesPenalty.seriesId,
      })
      .then((classes) => {
        this.availableDriverClasses.set(classes);
        this.loadingDriverClasses = false;
      })
      .catch((error) => {
        console.error("Failed to load driver classes:", error);
        this.loadingDriverClasses = false;
      });
  }

  addThreshold(): void {
    this.thresholds.push({
      id: `new-${Date.now()}`,
      threshold: 0,
      requiresReview: false,
      selectedDriverClasses: [],
    });
  }

  removeThreshold(id: string): void {
    this.thresholds = this.thresholds.filter((t) => t.id !== id);
  }

  onThresholdClassesChange(
    thresholdId: string,
    selectedValues: string[],
  ): void {
    const threshold = this.thresholds.find((t) => t.id === thresholdId);
    if (threshold) {
      threshold.selectedDriverClasses = selectedValues;
    }
  }

  async saveSeriesPenalty(): Promise<void> {
    const validThresholds = this.thresholds.filter(
      (t) => t.threshold > 0 && t.selectedDriverClasses.length > 0,
    );

    if (validThresholds.length === 0) {
      alert(
        "Please add at least one valid threshold with selected driver classes",
      );
      return;
    }

    try {
      if (this.editingSeriesPenaltyId) {
        await this.convex.mutation(this.convex.api.seriesPenalties.update, {
          id: this.editingSeriesPenaltyId,
          currentUserId: this.authService.requireUserId(),
          penaltyName: this.seriesPenaltyForm.penaltyName,
          penaltyDescription:
            this.seriesPenaltyForm.penaltyDescription || undefined,
        });

        const existingThresholds = await this.convex.query(
          this.convex.api.seriesPenaltyThresholds.listBySeriesPenalty,
          { seriesPenaltyId: this.editingSeriesPenaltyId },
        );

        for (const existing of existingThresholds) {
          await this.convex.mutation(
            this.convex.api.seriesPenaltyThresholds.remove,
            {
              id: existing._id,
              currentUserId: this.authService.requireUserId(),
            },
          );
        }

        for (const threshold of validThresholds) {
          await this.convex.mutation(
            this.convex.api.seriesPenaltyThresholds.create,
            {
              currentUserId: this.authService.requireUserId(),
              seriesPenaltyId: this.editingSeriesPenaltyId,
              threshold: threshold.threshold,
              requiresReview: threshold.requiresReview,
              driverClassIds: threshold.selectedDriverClasses.map(
                (id) => id as Id<"driverClasses">,
              ),
            },
          );
        }
      } else {
        const seriesPenaltyId = await this.convex.mutation(
          this.convex.api.seriesPenalties.create,
          {
            currentUserId: this.authService.requireUserId(),
            seriesId: this.seriesPenaltyForm.seriesId as Id<"series">,
            penaltyName: this.seriesPenaltyForm.penaltyName,
            penaltyDescription:
              this.seriesPenaltyForm.penaltyDescription || undefined,
          },
        );

        for (const threshold of validThresholds) {
          await this.convex.mutation(
            this.convex.api.seriesPenaltyThresholds.create,
            {
              currentUserId: this.authService.requireUserId(),
              seriesPenaltyId,
              threshold: threshold.threshold,
              requiresReview: threshold.requiresReview,
              driverClassIds: threshold.selectedDriverClasses.map(
                (id) => id as Id<"driverClasses">,
              ),
            },
          );
        }
      }
      this.closeSeriesPenaltyModal();
    } catch (error: any) {
      alert(`Failed to save series penalty: ${error.message}`);
    }
  }

  async deleteSeriesPenalty(
    seriesPenaltyId: Id<"seriesPenalties">,
  ): Promise<void> {
    if (confirm("Are you sure you want to delete this series penalty?")) {
      try {
        const thresholds = await this.convex.query(
          this.convex.api.seriesPenaltyThresholds.listBySeriesPenalty,
          { seriesPenaltyId },
        );

        for (const threshold of thresholds) {
          await this.convex.mutation(
            this.convex.api.seriesPenaltyThresholds.remove,
            {
              id: threshold._id,
              currentUserId: this.authService.requireUserId(),
            },
          );
        }

        await this.convex.mutation(this.convex.api.seriesPenalties.remove, {
          id: seriesPenaltyId,
          currentUserId: this.authService.requireUserId(),
        });
      } catch (error: any) {
        alert(`Failed to delete series penalty: ${error.message}`);
      }
    }
  }

  closeSeriesPenaltyModal(): void {
    this.showSeriesPenaltyModal = false;
    this.editingSeriesPenaltyId = null;
    this.seriesPenaltyForm = {
      seriesId: "" as Id<"series"> | "",
      penaltyName: "",
      penaltyDescription: "",
    };
    this.thresholds = [];
    this.availableDriverClasses.set([]);
  }

  openCopySeriesModal(targetSeries: Series): void {
    this.copyTargetSeries = targetSeries;
    this.copySourceSeriesId = "";
    this.copyPreview.set(null);
    this.copyResult.set(null);
    this.showCopySeriesModal = true;
  }

  closeCopySeriesModal(): void {
    this.showCopySeriesModal = false;
    this.copyTargetSeries = null;
    this.copySourceSeriesId = "";
    this.copyPreview.set(null);
    this.copyResult.set(null);
    this.copyLoading.set(false);
  }

  async previewCopySeries(): Promise<void> {
    if (!this.copyTargetSeries || !this.copySourceSeriesId) return;

    this.copyLoading.set(true);
    this.copyResult.set(null);

    try {
      const preview = await this.convex.query(
        (this.convex.api as any).seriesCopy.preview,
        {
          currentUserId: this.authService.requireUserId(),
          sourceSeriesId: this.copySourceSeriesId,
          targetSeriesId: this.copyTargetSeries._id,
        },
      );
      this.copyPreview.set(preview);
    } catch (error: any) {
      alert(`Failed to preview copy: ${error.message}`);
    } finally {
      this.copyLoading.set(false);
    }
  }

  async executeCopySeries(): Promise<void> {
    if (!this.copyTargetSeries || !this.copySourceSeriesId || !this.copyPreview()) {
      return;
    }

    this.copyLoading.set(true);

    try {
      const result = await this.convex.mutation(
        (this.convex.api as any).seriesCopy.execute,
        {
          currentUserId: this.authService.requireUserId(),
          sourceSeriesId: this.copySourceSeriesId,
          targetSeriesId: this.copyTargetSeries._id,
        },
      );
      this.copyResult.set(result);
      alert(
        `Copied ${result.penaltiesCreated} penalties, ${result.seriesPenaltiesCreated} series penalties, ${result.thresholdsCreated} thresholds, and ${result.sessionsCreated} sessions.`,
      );
      this.closeCopySeriesModal();
    } catch (error: any) {
      alert(`Failed to copy series configuration: ${error.message}`);
    } finally {
      this.copyLoading.set(false);
    }
  }

  async importEvents(seriesId: Id<"series">): Promise<void> {
    this.importing.set(true);
    this.importResult.set(null);

    try {
      const result = await this.convex.action(
        this.convex.api.events.importFromSimGrid,
        { seriesId, currentUserId: this.authService.requireUserId() },
      );
      this.importResult.set(result);

      if (result.created > 0) {
        alert(
          `Successfully imported ${result.created} events${result.skipped > 0 ? ` (${result.skipped} already exist)` : ""}`,
        );
      } else if (result.skipped > 0) {
        alert(
          `No new events imported. ${result.skipped} events already exist.`,
        );
      } else {
        alert("No events found on SimGrid.");
      }
    } catch (error: any) {
      alert(`Failed to import events: ${error.message}`);
    } finally {
      this.importing.set(false);
    }
  }

  async importDrivers(seriesId: Id<"series">): Promise<void> {
    this.importing.set(true);
    this.importResult.set(null);

    try {
      const series = await this.convex.query(this.convex.api.series.getById, {
        id: seriesId,
      });
      if (!series || !series.simgridLink) {
        throw new Error("Series not found or simgridLink not configured");
      }

      const championshipId = this.extractChampionshipId(series.simgridLink);
      if (!championshipId) {
        throw new Error("Could not extract championship ID from simgridLink");
      }

      const result = await this.convex.action(
        (this.convex.api as any).actions.importDriversFromSimGrid,
        {
          currentUserId: this.authService.requireUserId(),
          championshipId: seriesId,
          simgridChampionshipId: championshipId,
        },
      );

      if (result.success) {
        const createdCount = result.results.filter(
          (r: any) => r.action === "created",
        ).length;
        const updatedCount = result.results.filter(
          (r: any) => r.action === "updated",
        ).length;
        alert(
          `Successfully imported ${result.imported} drivers (${createdCount} created, ${updatedCount} updated)`,
        );
      } else {
        alert(`Failed to import drivers: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Failed to import drivers: ${error.message}`);
    } finally {
      this.importing.set(false);
    }
  }

  private extractChampionshipId(url: string): string | null {
    const patterns = [/championship\/(\d+)/, /id=(\d+)/, /\/(\d+)\/?$/];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  getScheduledImportStatus(seriesId: Id<"series">): ScheduledImportStatus | undefined {
    return this.scheduledImportStatuses().get(seriesId);
  }

  readonly formatSeriesDateRange = formatSeriesDateRange;

  readonly formatDaysOfWeek = formatDaysOfWeek;

  isDaySelected(day: number): boolean {
    return this.scheduleForm.scheduledImportDays.includes(day);
  }

  toggleDay(day: number): void {
    const index = this.scheduleForm.scheduledImportDays.indexOf(day);
    if (index === -1) {
      this.scheduleForm.scheduledImportDays.push(day);
    } else {
      this.scheduleForm.scheduledImportDays.splice(index, 1);
    }
  }

  openScheduleModal(seriesId: Id<"series">): void {
    const status = this.getScheduledImportStatus(seriesId);
    const series = this.series().find((s) => s._id === seriesId);
    
    this.scheduleForm = {
      seriesId,
      scheduledImportTime: status?.scheduledImportTime
        ? this.utcToLocalTime(status.scheduledImportTime)
        : "09:00",
      scheduledImportDays: status?.scheduledImportDays ?? [],
    };
    this.showScheduleModal = true;
  }

  closeScheduleModal(): void {
    this.showScheduleModal = false;
    this.scheduleForm = {
      seriesId: null,
      scheduledImportTime: "",
      scheduledImportDays: [],
    };
  }

  async saveScheduledImport(): Promise<void> {
    if (!this.scheduleForm.seriesId) return;
    
    this.scheduleSaving.set(true);
    
    try {
      const utcTime = this.localToUtcTime(this.scheduleForm.scheduledImportTime);
      
      await this.convex.mutation(
        (this.convex.api as any).scheduledImports.scheduleImport,
        {
          currentUserId: this.authService.requireUserId(),
          seriesId: this.scheduleForm.seriesId,
          scheduledImportTime: utcTime,
          scheduledImportDays: this.scheduleForm.scheduledImportDays,
        },
      );
      
      this.closeScheduleModal();
    } catch (error: any) {
      alert(`Failed to schedule import: ${error.message}`);
    } finally {
      this.scheduleSaving.set(false);
    }
  }

  async cancelScheduledImport(seriesId: Id<"series">): Promise<void> {
    if (!confirm("Are you sure you want to cancel the scheduled import?")) {
      return;
    }
    
    try {
      await this.convex.mutation(
        (this.convex.api as any).scheduledImports.cancelScheduledImport,
        { seriesId, currentUserId: this.authService.requireUserId() },
      );
    } catch (error: any) {
      alert(`Failed to cancel scheduled import: ${error.message}`);
    }
  }

  // Driver Class Management Methods
  async loadDriverClassesForManagement(seriesId: Id<"series">): Promise<void> {
    this.editingDriverClassSeriesId = seriesId;
    this.loadingDriverClasses = true;

    try {
      const classes = await this.convex.query(
        this.convex.api.driverClasses.getDriverClassesWithUsage,
        { seriesId },
      );

      this.driverClassesForManagement.set(classes);
      this.showDriverClassModal = true;
    } catch (error) {
      console.error("Failed to load driver classes:", error);
    } finally {
      this.loadingDriverClasses = false;
    }
  }

  getDriverClassesBySeries(seriesId: Id<"series">): any[] {
    // Return cached driver classes for display in series card
    return this.driverClassesBySeries().get(seriesId) || [];
  }

  private subscribeToDriverClassesForSeries(seriesId: Id<"series">): void {
    if (this.driverClassesSubscriptions.has(seriesId)) {
      return;
    }

    const query = this.convex.createReactiveQuery(
      this.convex.api.driverClasses.getDriverClassesWithUsage,
      { seriesId },
      (data) => {
        this.driverClassesBySeries.update((map) => {
          const newMap = new Map(map);
          newMap.set(seriesId, data);
          return newMap;
        });
      }
    );

    this.driverClassesSubscriptions.set(seriesId, () => {
      query.unsubscribe();
    });
    this.unsubscribes.push(() => {
      query.unsubscribe();
    });
  }

  editDriverClass(driverClass: any): void {
    this.editingDriverClassId = driverClass._id;
    this.editingDriverClassName = driverClass.displayName;
  }

  cancelEditDriverClass(): void {
    this.editingDriverClassId = null;
    this.editingDriverClassName = "";
  }

  async saveDriverClassDisplayName(): Promise<void> {
    if (!this.editingDriverClassId || !this.editingDriverClassName.trim())
      return;

    try {
      await this.convex.mutation(
        this.convex.api.driverClasses.updateDisplayName,
        {
          currentUserId: this.authService.requireUserId(),
          id: this.editingDriverClassId,
          displayName: this.editingDriverClassName.trim(),
        },
      );

      // Refresh the list
      if (this.editingDriverClassSeriesId) {
        await this.loadDriverClassesForManagement(
          this.editingDriverClassSeriesId,
        );
      }

      this.cancelEditDriverClass();
    } catch (error) {
      console.error("Failed to update driver class:", error);
    }
  }

  closeDriverClassModal(): void {
    this.showDriverClassModal = false;
    this.editingDriverClassSeriesId = null;
    this.driverClassesForManagement.set([]);
    this.cancelEditDriverClass();
  }
}
