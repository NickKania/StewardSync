import { Component, effect, inject, input, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Id } from "@convex/_generated/dataModel";
import { ConvexService } from "@core/services/convex.service";
import { CardComponent } from "@shared/components/card/card.component";

interface DashboardReportStats {
  total: number;
  pending: number;
  reviewed: number;
  finalized: number;
  rejected: number;
}

@Component({
  selector: "app-dashboard-report-statistics",
  standalone: true,
  imports: [CommonModule, CardComponent],
  template: `
    @if (loading()) {
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        @for (item of [1, 2, 3, 4]; track item) {
          <app-card>
            <div class="animate-pulse text-center">
              <div
                class="h-8 bg-gray-200 rounded w-16 mx-auto dark:bg-gray-700"
              ></div>
              <div
                class="h-4 bg-gray-200 rounded w-24 mx-auto mt-2 dark:bg-gray-700"
              ></div>
            </div>
          </app-card>
        }
      </div>
    } @else {
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <app-card>
          <div class="text-center">
            <p class="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {{ stats().total }}
            </p>
            <p class="text-sm text-gray-500 mt-1 dark:text-gray-400">
              Total Reports
            </p>
          </div>
        </app-card>
        <app-card>
          <div class="text-center">
            <p class="text-3xl font-bold text-amber-600 dark:text-amber-400">
              {{ stats().pending }}
            </p>
            <p class="text-sm text-gray-500 mt-1 dark:text-gray-400">
              Pending Review
            </p>
          </div>
        </app-card>
        <app-card>
          <div class="text-center">
            <p class="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {{ stats().reviewed }}
            </p>
            <p class="text-sm text-gray-500 mt-1 dark:text-gray-400">
              Under Review
            </p>
          </div>
        </app-card>
        <app-card>
          <div class="text-center">
            <p class="text-3xl font-bold text-green-600 dark:text-green-400">
              {{ stats().finalized }}
            </p>
            <p class="text-sm text-gray-500 mt-1 dark:text-gray-400">
              Finalized
            </p>
          </div>
        </app-card>
      </div>
    }
  `,
})
export class DashboardReportStatisticsComponent {
  private readonly convex = inject(ConvexService);
  private requestId = 0;

  readonly seriesId = input<Id<"series"> | null>(null);
  readonly loading = signal(true);
  readonly stats = signal<DashboardReportStats>({
    total: 0,
    pending: 0,
    reviewed: 0,
    finalized: 0,
    rejected: 0,
  });

  private readonly loadEffect = effect(
    () => {
      const currentSeriesId = this.seriesId();
      void this.loadStats(currentSeriesId);
    },
    { allowSignalWrites: true },
  );

  private async loadStats(seriesId: Id<"series"> | null): Promise<void> {
    const currentRequest = ++this.requestId;
    this.loading.set(true);

    try {
      const stats = await this.convex.query(
        this.convex.api.reports.getDashboardStats,
        {
          seriesId: seriesId ?? undefined,
        },
      );

      if (currentRequest !== this.requestId) {
        return;
      }

      this.stats.set((stats ?? this.stats()) as DashboardReportStats);
    } catch (error) {
      console.error("Failed to load report statistics:", error);
      if (currentRequest === this.requestId) {
        this.stats.set({
          total: 0,
          pending: 0,
          reviewed: 0,
          finalized: 0,
          rejected: 0,
        });
      }
    } finally {
      if (currentRequest === this.requestId) {
        this.loading.set(false);
      }
    }
  }
}
