import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  Input,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { ConvexService } from "@core/services/convex.service";
import { AuthService } from "@core/services/auth.service";
import { NavigationService } from "@core/services/navigation.service";
import { ToastService } from "@core/services/toast.service";
import { CardComponent } from "@shared/components/card/card.component";
import { ButtonComponent } from "@shared/components/button/button.component";
import { BadgeComponent } from "@shared/components/badge/badge.component";
import { LoadingComponent } from "@shared/components/loading/loading.component";
import { DateFormatPipe } from "@shared/pipes/date-format.pipe";
import { HasRoleDirective } from "@shared/directives/has-role.directive";
import { Id } from "@convex/_generated/dataModel";

@Component({
  selector: "app-event-detail",
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    LoadingComponent,
    DateFormatPipe,
    HasRoleDirective,
  ],
  template: `
    <div class="space-y-6">
      @if (loading()) {
        <app-loading text="Loading event..." />
      } @else if (event()) {
        <!-- Header -->
        <div
          class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
        >
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {{ event()?.trackName }}
            </h1>
            <p class="text-gray-500 mt-1 dark:text-gray-400">
              {{ event()?.series?.name }} - Round {{ event()?.eventNumber }}
            </p>
          </div>
          <div class="flex gap-3">
            <app-button variant="secondary" (onClick)="goBackToEvents()">
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
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                ></path>
              </svg>
              Back to Events
            </app-button>
            <a routerLink="/reports/new">
              <app-button variant="primary">File Report</app-button>
            </a>
          </div>
        </div>

        <div class="grid lg:grid-cols-3 gap-6">
          <!-- Event details -->
          <div class="lg:col-span-2 space-y-6">
            <app-card title="Event Information">
              <dl class="grid sm:grid-cols-2 gap-4">
                <div>
                  <dt class="text-sm text-gray-500 dark:text-gray-400">
                    Track
                  </dt>
                  <dd class="font-medium text-gray-900 dark:text-gray-100">
                    {{ event()?.trackName }}
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500 dark:text-gray-400">
                    Series
                  </dt>
                  <dd class="font-medium text-gray-900 dark:text-gray-100">
                    {{ event()?.series?.name }}
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500 dark:text-gray-400">
                    Round Number
                  </dt>
                  <dd class="font-medium text-gray-900 dark:text-gray-100">
                    {{ event()?.eventNumber }}
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500 dark:text-gray-400">Date</dt>
                  <dd class="font-medium text-gray-900 dark:text-gray-100">
                    {{ event()?.eventDate | dateFormat: "PPP" }}
                  </dd>
                </div>
              </dl>

              <div
                *appHasRole="['event_manager', 'league_manager']"
                class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
              >
                <div class="flex flex-col sm:flex-row sm:items-end gap-4">
                  <div class="flex-1">
                    <label
                      class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300"
                    >
                      Edit Event Date
                    </label>
                    <div
                      class="flex flex-col sm:flex-row sm:items-center gap-3"
                    >
                      <div class="sm:w-56">
                        <input
                          type="date"
                          class="input w-full"
                          [ngModel]="dateDraft()"
                          (ngModelChange)="dateDraft.set($event)"
                        />
                      </div>
                      <app-button
                        [disabled]="isSaveDateDisabled()"
                        [loading]="isSavingDate()"
                        (click)="saveEventDate()"
                      >
                        Save Date
                      </app-button>
                    </div>
                  </div>
                  <div>
                    <app-button
                      variant="secondary"
                      [loading]="isExporting()"
                      (click)="exportResults()"
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
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        ></path>
                      </svg>
                      Export Results
                    </app-button>
                  </div>
                </div>
              </div>
            </app-card>

            <!-- Sessions -->
            <app-card title="Sessions">
              <div
                *appHasRole="['event_manager', 'league_manager']"
                class="flex items-center justify-between mb-3"
              >
                <span class="text-sm text-gray-500 dark:text-gray-400"
                  >Manage sessions for this event</span
                >
                <app-button
                  variant="secondary"
                  size="sm"
                  (click)="showAddRaceModal = true"
                >
                  <svg
                    class="w-4 h-4 mr-1"
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
                  Add Session
                </app-button>
              </div>
              @if (event()?.races?.length > 0) {
                <div class="space-y-3">
                  @for (race of event()?.races; track race._id) {
                    <div
                      class="flex items-center justify-between p-3 bg-gray-50 rounded-lg dark:bg-gray-800"
                    >
                      <div class="flex items-center gap-3">
                        <div
                          class="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center"
                        >
                          <span class="font-bold text-primary-700">{{
                            race.raceNumber === 0
                              ? race.sessionName[0]
                              : (race.raceNumber ?? "S")
                          }}</span>
                        </div>
                        <span
                          class="font-medium text-gray-900 dark:text-gray-100"
                          >{{ getSessionName(race) }}</span
                        >
                      </div>
                      <div class="flex items-center gap-2">
                        <button
                          (click)="removeRace(race._id)"
                          class="text-gray-400 hover:text-danger p-1 dark:text-gray-500"
                          title="Delete session"
                        >
                          <svg
                            class="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            ></path>
                          </svg>
                        </button>
                        <a
                          [routerLink]="['/reports', 'my']"
                          [queryParams]="{
                            event: event()?._id,
                            race: race._id,
                          }"
                          class="text-sm text-primary-600 hover:text-primary-700 font-medium"
                        >
                          View Reports
                        </a>
                      </div>
                    </div>
                  }
                </div>
              } @else {
                <p class="text-gray-500 text-center py-4 dark:text-gray-400">
                  No sessions scheduled
                </p>
              }
            </app-card>
          </div>

          <!-- Sidebar -->
          <div class="space-y-6">
            <app-card title="Quick Stats">
              <div class="space-y-4">
                <div class="flex items-center justify-between">
                  <span class="text-gray-500 dark:text-gray-400"
                    >Total Sessions</span
                  >
                  <span class="font-bold text-gray-900 dark:text-gray-100">{{
                    event()?.races?.length || 0
                  }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-gray-500 dark:text-gray-400">Status</span>
                  <app-badge [variant]="getEventStatus(event()?.eventDate)">
                    {{ getEventStatusLabel(event()?.eventDate) }}
                  </app-badge>
                </div>
              </div>
            </app-card>
          </div>
        </div>
      } @else {
        <app-card>
          <div class="text-center py-12">
            <p class="text-gray-500 dark:text-gray-400">Event not found</p>
            <app-button
              class="mt-4 inline-flex"
              variant="primary"
              (onClick)="goBackToEvents()"
            >
              Back to Events
            </app-button>
          </div>
        </app-card>
      }

      <!-- Add Session Modal -->
      @if (showAddRaceModal) {
        <div
          *appHasRole="['event_manager', 'league_manager']"
          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <div class="bg-white rounded-lg p-6 w-full max-w-md dark:bg-gray-900">
            <h3 class="text-lg font-semibold mb-4">Add Session</h3>
            <div class="space-y-4">
              <div>
                <label
                  class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300"
                  >Session Name</label
                >
                <input
                  type="text"
                  class="input w-full"
                  [(ngModel)]="raceForm.sessionName"
                  placeholder="e.g., Qualifying, Race 1, Race 2"
                />
              </div>
              <div class="flex gap-2 justify-end">
                <app-button variant="secondary" (click)="closeAddRaceModal()"
                  >Cancel</app-button
                >
                <app-button
                  (click)="addRace()"
                  [disabled]="!raceForm.sessionName.trim()"
                >
                  Add Session
                </app-button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class EventDetailComponent implements OnInit, OnDestroy {
  @Input() id!: string;

  private convex = inject(ConvexService);
  private authService = inject(AuthService);
  private navigationService = inject(NavigationService);
  private toast = inject(ToastService);

  event = signal<any>(null);
  loading = signal(true);
  dateDraft = signal("");
  isSavingDate = signal(false);
  isExporting = signal(false);
  showAddRaceModal = false;
  raceForm = {
    sessionName: "",
  };

  private unsubscribes: (() => void)[] = [];

  ngOnInit(): void {
    this.loadEvent();
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach((unsub) => unsub());
  }

  private async loadEvent(): Promise<void> {
    if (!this.id) {
      this.loading.set(false);
      return;
    }

    try {
      const event = await this.convex.query(
        this.convex.api.events.getWithRaces,
        { eventId: this.id as any },
      );

      this.event.set(event);
      if (event?.eventDate) {
        this.dateDraft.set(this.toDateInputValue(event.eventDate));
      }
    } catch (error) {
      console.error("Failed to load event:", error);
    } finally {
      this.loading.set(false);
    }
  }

  isSaveDateDisabled(): boolean {
    const currentEvent = this.event();
    if (!currentEvent) return true;
    if (this.isSavingDate()) return true;

    const draftDate = this.dateDraft();
    if (!draftDate) return true;

    return draftDate === this.toDateInputValue(currentEvent.eventDate);
  }

  async saveEventDate(): Promise<void> {
    const currentEvent = this.event();
    if (!currentEvent) return;

    const currentUserId = this.authService.getUserId();
    if (!currentUserId) {
      this.toast.error("You must be logged in to edit event dates");
      return;
    }

    const parsedDate = this.fromDateInputValue(this.dateDraft());
    if (parsedDate === null) {
      this.toast.error("Please provide a valid event date");
      return;
    }

    this.isSavingDate.set(true);
    try {
      await this.convex.mutation(this.convex.api.events.update, {
        eventId: currentEvent._id,
        currentUserId,
        eventDate: parsedDate,
      });

      this.event.update((existing) =>
        existing ? { ...existing, eventDate: parsedDate } : existing,
      );
      this.dateDraft.set(this.toDateInputValue(parsedDate));
      this.toast.success("Event date updated successfully");
    } catch (error: any) {
      this.toast.error(error?.message || "Failed to update event date");
    } finally {
      this.isSavingDate.set(false);
    }
  }

  getEventStatus(
    eventDate: number | undefined,
  ): "success" | "warning" | "info" {
    if (!eventDate) return "info";

    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    if (eventDate < now - dayInMs) {
      return "success";
    } else if (eventDate < now + dayInMs) {
      return "warning";
    }
    return "info";
  }

  getEventStatusLabel(eventDate: number | undefined): string {
    if (!eventDate) return "Unknown";

    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    if (eventDate < now - dayInMs) {
      return "Completed";
    } else if (eventDate < now + dayInMs) {
      return "Current";
    }
    return "Upcoming";
  }

  closeAddRaceModal(): void {
    this.showAddRaceModal = false;
    this.raceForm.sessionName = "";
  }

  async addRace(): Promise<void> {
    const sessionName = this.raceForm.sessionName.trim();
    if (!sessionName) return;

    const raceMatch = /^race\s+(\d+)$/i.exec(sessionName);
    const parsedRaceNumber = raceMatch ? Number(raceMatch[1]) : undefined;

    try {
      await this.convex.mutation(this.convex.api.races.create, {
        eventId: this.event()?._id,
        sessionName,
        raceNumber:
          parsedRaceNumber && Number.isFinite(parsedRaceNumber)
            ? parsedRaceNumber
            : undefined,
      });

      this.closeAddRaceModal();

      await this.loadEvent();
    } catch (error: any) {
      alert(
        `Failed to add session: ${this.extractUserFacingError(error.message)}`,
      );
    }
  }

  async removeRace(raceId: Id<"races">): Promise<void> {
    if (
      !confirm(
        "Are you sure you want to delete this session? This will fail if there are existing reports.",
      )
    ) {
      return;
    }

    try {
      await this.convex.mutation(this.convex.api.races.remove, { raceId });
      await this.loadEvent();
    } catch (error: any) {
      alert(
        `Failed to delete session: ${this.extractUserFacingError(error.message)}`,
      );
    }
  }

  private extractUserFacingError(errorMessage: string): string {
    // Convex wraps errors with a prefix like:
    // "[CONVEX M(races:remove)] [Request ID: xxx] Server Error Uncaught UserFacingError: ..."
    // We want to extract just the part after "Uncaught UserFacingError: " or "Error: "
    if (!errorMessage) return "";

    // Try to extract UserFacingError message
    const userFacingMatch = errorMessage.match(
      /Uncaught UserFacingError:\s*(.+?)(?:\s+at\s+|$)/s,
    );
    if (userFacingMatch) {
      return userFacingMatch[1].trim();
    }

    // Try to extract regular Error message as fallback
    const errorMatch = errorMessage.match(/Error:\s*(.+?)(?:\s+at\s+|$)/s);
    if (errorMatch) {
      return errorMatch[1].trim();
    }

    // If no pattern matches, return original message
    return errorMessage;
  }

  private toDateInputValue(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private fromDateInputValue(value: string): number | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsedDate = new Date(year, month - 1, day);

    if (Number.isNaN(parsedDate.getTime())) return null;
    return parsedDate.getTime();
  }

  async exportResults(): Promise<void> {
    const currentEvent = this.event();
    if (!currentEvent) return;

    this.isExporting.set(true);
    try {
      const exportData = await this.convex.query(
        this.convex.api.reports.getEventExportData,
        { eventId: currentEvent._id },
      );

      if (!exportData || exportData.length === 0) {
        this.toast.error("No finalized or reviewed reports found to export");
        return;
      }

      const headers = [
        "Car Number",
        "Driver Name",
        "Driver Split",
        "Ticket Number",
        "Lap",
        "Turn",
        "Final Incident Description",
        "Adjusted",
        "Self Reported",
        "Time Penalty (s)",
        "License Points",
        "Stewards",
        "Finalized By",
        "Adjustment Reason",
      ];

      const rows = exportData.map((row: any) => [
        row.carNumber ?? "",
        row.driverName ?? "",
        row.driverClass ?? "",
        row.ticketNumber ?? "",
        row.lap ?? "",
        row.turn ?? "",
        row.incidentDescription ?? "",
        row.isAdjusted ? "true" : "false",
        row.isSelfReport ? "true" : "false",
        row.timePenaltySeconds ?? 0,
        row.licensePoints ?? 0,
        row.stewardNames ?? "",
        row.finalizedByName ?? "",
        row.adjustedReason ?? "",
      ]);

      const csvContent = this.generateCSV(headers, rows);

      const eventDate = new Date(currentEvent.eventDate);
      const dateStr = eventDate.toISOString().split("T")[0];
      const trackName = (currentEvent.trackName || "unknown")
        .replace(/[^a-zA-Z0-9]/g, "_")
        .toLowerCase();
      const filename = `stewardsync_results_${trackName}_${dateStr}.csv`;

      this.downloadCSV(csvContent, filename);
      this.toast.success("Export completed successfully");
    } catch (error: any) {
      console.error("Export failed:", error);
      this.toast.error(error?.message || "Failed to export results");
    } finally {
      this.isExporting.set(false);
    }
  }

  getSessionName(race: { sessionName?: string; raceNumber?: number }): string {
    if (race?.sessionName?.trim()) return race.sessionName.trim();
    if (typeof race?.raceNumber === "number") return `Race ${race.raceNumber}`;
    return "Session";
  }

  goBackToEvents(): void {
    this.navigationService.goBack(["/events"]);
  }

  private generateCSV(headers: string[], rows: any[][]): string {
    const escapeField = (field: any): string => {
      if (field === null || field === undefined) return "";
      const str = String(field);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerLine = headers.map(escapeField).join(",");
    const dataLines = rows.map((row) => row.map(escapeField).join(","));

    return [headerLine, ...dataLines].join("\n");
  }

  private downloadCSV(content: string, filename: string): void {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
