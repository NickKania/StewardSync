import { Component, computed, effect, inject, input, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { Id } from "@convex/_generated/dataModel";
import { ConvexService } from "@core/services/convex.service";
import { AuthService } from "@core/services/auth.service";
import { CardComponent } from "@shared/components/card/card.component";
import { BadgeComponent } from "@shared/components/badge/badge.component";
import { LoadingComponent } from "@shared/components/loading/loading.component";
import { DateFormatPipe } from "@shared/pipes/date-format.pipe";

type DashboardReportStatus = "pending" | "reviewed" | "finalized" | "rejected";
type DashboardReportActionMode = "report" | "review" | "finalize";
type BadgeVariant = "warning" | "info" | "success" | "danger";

interface DashboardReportRow {
  _id: Id<"reports">;
  reportId: number | null;
  reportDate: number;
  status: DashboardReportStatus;
  reportingUserId?: Id<"users"> | null;
  seriesId: Id<"series">;
  seriesName: string;
  eventName: string;
}

@Component({
  selector: "app-dashboard-report-list",
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CardComponent,
    BadgeComponent,
    LoadingComponent,
    DateFormatPipe,
  ],
  template: `
    <app-card [title]="title()" [subtitle]="subtitle()" [noPadding]="true">
      @if (loading()) {
        <div class="py-12">
          <app-loading text="Loading reports..." />
        </div>
      } @else if (reports().length > 0) {
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr class="text-left text-sm text-gray-500 dark:text-gray-400">
                <th class="px-6 py-3 font-medium">Ticket #</th>
                <th class="px-6 py-3 font-medium">Series / Event</th>
                <th class="px-6 py-3 font-medium">Report Date</th>
                <th class="px-6 py-3 font-medium">Status</th>
                <th class="px-6 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
              @for (report of reports(); track report._id) {
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td
                    class="px-6 py-4 font-medium text-gray-900 dark:text-gray-100"
                  >
                    {{ report.reportId ?? "-" }}
                  </td>
                  <td class="px-6 py-4">
                    <p class="font-medium text-gray-900 dark:text-gray-100">
                      {{ report.seriesName }}
                    </p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{ report.eventName }}
                    </p>
                  </td>
                  <td class="px-6 py-4 text-gray-500 dark:text-gray-400">
                    {{ report.reportDate | dateFormat: "PP" }}
                  </td>
                  <td class="px-6 py-4">
                    <app-badge [variant]="getStatusVariant(report.status)">
                      {{ statusLabel(report.status) }}
                    </app-badge>
                  </td>
                  <td class="px-6 py-4">
                    <a
                      [routerLink]="getReportLink(report)"
                      class="text-primary-600 hover:text-primary-700 font-medium text-sm dark:text-primary-400 dark:hover:text-primary-300"
                    >
                      {{ actionLabel(report) }}
                    </a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <p class="text-center py-12 text-gray-500 dark:text-gray-400">
          {{ emptyText() }}
        </p>
      }
    </app-card>
  `,
})
export class DashboardReportListComponent {
  private readonly convex = inject(ConvexService);
  private readonly authService = inject(AuthService);
  private requestId = 0;

  readonly title = input("Reports");
  readonly subtitle = input("Incident reports for this dashboard");
  readonly emptyText = input("No reports found for the current filter");
  readonly seriesId = input<Id<"series"> | null>(null);
  readonly status = input<DashboardReportStatus | "all">("all");
  readonly limit = input(12);
  readonly actionMode = input<DashboardReportActionMode>("report");

  readonly reports = signal<DashboardReportRow[]>([]);
  readonly loading = signal(true);
  readonly actionLabel = (report: DashboardReportRow): string => {
    if (this.actionMode() === "review" && this.isReportingUser(report)) {
      return "Edit";
    }

    switch (this.actionMode()) {
      case "review":
        return "Review";
      case "finalize":
        return "Finalize";
      default:
        return "View";
    }
  };

  private readonly loadEffect = effect(
    () => {
      const currentSeriesId = this.seriesId();
      const currentStatus = this.status();
      const currentLimit = this.limit();
      void this.loadReports(currentSeriesId, currentStatus, currentLimit);
    },
    { allowSignalWrites: true },
  );

  private async loadReports(
    seriesId: Id<"series"> | null,
    status: DashboardReportStatus | "all",
    limit: number,
  ): Promise<void> {
    const currentRequest = ++this.requestId;
    this.loading.set(true);

    try {
      const data = await this.convex.query(
        this.convex.api.reports.listDashboard,
        {
          seriesId: seriesId ?? undefined,
          status: status === "all" ? undefined : status,
          limit,
        },
      );

      if (currentRequest !== this.requestId) {
        return;
      }

      this.reports.set((data ?? []) as DashboardReportRow[]);
    } catch (error) {
      console.error("Failed to load dashboard reports:", error);
      if (currentRequest === this.requestId) {
        this.reports.set([]);
      }
    } finally {
      if (currentRequest === this.requestId) {
        this.loading.set(false);
      }
    }
  }

  getReportLink(report: DashboardReportRow): string[] {
    switch (this.actionMode()) {
      case "review":
        return ["/reviews", report._id];
      case "finalize":
        return ["/finalize", report._id];
      default:
        return ["/reports", report._id];
    }
  }

  private isReportingUser(report: DashboardReportRow): boolean {
    const currentUserId = this.authService.getUserId();
    if (!currentUserId || !report.reportingUserId) {
      return false;
    }
    return String(report.reportingUserId) === String(currentUserId);
  }

  statusLabel(status: DashboardReportStatus): string {
    switch (status) {
      case "pending":
        return "Pending Review";
      case "reviewed":
        return "Under Review";
      case "finalized":
        return "Finalized";
      case "rejected":
        return "Rejected";
      default:
        return status;
    }
  }

  getStatusVariant(status: DashboardReportStatus): BadgeVariant {
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
}
