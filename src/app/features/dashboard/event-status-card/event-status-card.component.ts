import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ConvexService } from "@core/services/convex.service";
import { CardComponent } from "@shared/components/card/card.component";
import { DateFormatPipe } from "@shared/pipes/date-format.pipe";

interface EventStatusStats {
  pending: number;
  reviewed: number;
  finalized: number;
}

interface LatestEventStatusRow {
  series: {
    id: string;
    name: string;
  };
  event: {
    eventNumber: number;
    trackName: string;
    eventDate: number;
  } | null;
  stats: EventStatusStats;
}

@Component({
  selector: "app-event-status-card",
  standalone: true,
  imports: [CommonModule, CardComponent, DateFormatPipe],
  template: `
    <app-card
      title="Latest Event Status (Active Series)"
      subtitle="Opened vs Review vs Finalized report breakdown"
    >
      @if (loading()) {
        <div class="animate-pulse space-y-4">
          <div class="h-4 w-40 rounded bg-gray-200 dark:bg-gray-700"></div>
          <div class="h-3 w-56 rounded bg-gray-200 dark:bg-gray-700"></div>
          <div class="h-4 w-full rounded-full bg-gray-200 dark:bg-gray-700"></div>
          <div class="grid grid-cols-3 gap-3">
            <div class="h-10 rounded bg-gray-200 dark:bg-gray-700"></div>
            <div class="h-10 rounded bg-gray-200 dark:bg-gray-700"></div>
            <div class="h-10 rounded bg-gray-200 dark:bg-gray-700"></div>
          </div>
        </div>
      } @else if (rows().length === 0) {
        <div class="space-y-2">
          <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
            No active series found.
          </p>
        </div>
      } @else {
        <div class="space-y-6">
          @for (row of rows(); track row.series.id) {
            <div class="rounded-xl border border-gray-200 bg-white/40 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/60">
              <div class="flex flex-col gap-1">
                <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {{ row.series.name }}
                </p>
                @if (row.event) {
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    Event {{ row.event.eventNumber }} · {{ row.event.trackName }}
                    · {{ row.event.eventDate | dateFormat: "PP" }}
                  </p>
                } @else {
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    No event recorded yet.
                  </p>
                }
              </div>

              @if (row.event) {
                <div class="mt-4 space-y-2">
                  <div
                    class="h-4 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                  >
                    <div class="flex h-full w-full">
                      <div
                        class="h-full bg-warning"
                        [style.width.%]="percent(row.stats.pending, row)"
                      ></div>
                      <div
                        class="h-full bg-info"
                        [style.width.%]="percent(row.stats.reviewed, row)"
                      ></div>
                      <div
                        class="h-full bg-success"
                        [style.width.%]="percent(row.stats.finalized, row)"
                      ></div>
                    </div>
                  </div>
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    {{ totalForRow(row) }} total reports tracked
                  </p>
                </div>

                <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div class="rounded-lg border border-warning-border bg-warning-bg px-3 py-2">
                    <p class="text-xs uppercase tracking-wide text-warning-text">
                      Opened
                    </p>
                    <p class="text-lg font-semibold text-warning-text">
                      {{ row.stats.pending }}
                      <span class="text-xs font-medium text-warning">
                        {{ percent(row.stats.pending, row) | number: "1.0-0" }}%
                      </span>
                    </p>
                  </div>
                  <div class="rounded-lg border border-info-border bg-info-bg px-3 py-2">
                    <p class="text-xs uppercase tracking-wide text-info-text">
                      Under Review
                    </p>
                    <p class="text-lg font-semibold text-info-text">
                      {{ row.stats.reviewed }}
                      <span class="text-xs font-medium text-info">
                        {{ percent(row.stats.reviewed, row) | number: "1.0-0" }}%
                      </span>
                    </p>
                  </div>
                  <div class="rounded-lg border border-success-border bg-success-bg px-3 py-2">
                    <p class="text-xs uppercase tracking-wide text-success-text">
                      Finalized
                    </p>
                    <p class="text-lg font-semibold text-success-text">
                      {{ row.stats.finalized }}
                      <span class="text-xs font-medium text-success">
                        {{ percent(row.stats.finalized, row) | number: "1.0-0" }}%
                      </span>
                    </p>
                  </div>
                </div>

                @if (totalForRow(row) === 0) {
                  <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    No reports were filed for this event.
                  </p>
                }
              }
            </div>
          }
        </div>
      }
    </app-card>
  `,
})
export class EventStatusCardComponent implements OnInit {
  private readonly convex = inject(ConvexService);
  private requestId = 0;

  readonly loading = signal(true);
  readonly rows = signal<LatestEventStatusRow[]>([]);

  ngOnInit(): void {
    void this.loadStatus();
  }

  totalForRow(row: LatestEventStatusRow): number {
    return row.stats.pending + row.stats.reviewed + row.stats.finalized;
  }

  percent(value: number, row: LatestEventStatusRow): number {
    const total = this.totalForRow(row);
    if (total === 0) {
      return 0;
    }
    return (value / total) * 100;
  }

  private async loadStatus(): Promise<void> {
    const currentRequest = ++this.requestId;
    this.loading.set(true);

    try {
      const response = await this.convex.query(
        this.convex.api.reports.getPreviousWeekEventStatus,
        {},
      );

      if (currentRequest !== this.requestId) {
        return;
      }

      this.rows.set((response ?? []) as LatestEventStatusRow[]);
    } catch (error) {
      console.error("Failed to load previous week event status:", error);
      if (currentRequest === this.requestId) {
        this.rows.set([]);
      }
    } finally {
      if (currentRequest === this.requestId) {
        this.loading.set(false);
      }
    }
  }
}
