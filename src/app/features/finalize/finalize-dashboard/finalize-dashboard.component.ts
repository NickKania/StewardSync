import { Component, inject, OnInit, OnDestroy, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { ConvexService } from "@core/services/convex.service";
import { CardComponent } from "@shared/components/card/card.component";
import { ButtonComponent } from "@shared/components/button/button.component";
import { BadgeComponent } from "@shared/components/badge/badge.component";
import { LoadingComponent } from "@shared/components/loading/loading.component";
import { TruncateTextComponent } from "@shared/components/truncate-text/truncate-text.component";
import { DateFormatPipe, TimeAgoPipe } from "@shared/pipes/date-format.pipe";

@Component({
  selector: "app-finalize-dashboard",
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    LoadingComponent,
    TruncateTextComponent,
    DateFormatPipe,
    TimeAgoPipe,
  ],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Finalization Queue</h1>
        <p class="text-gray-500 mt-1 dark:text-gray-400">Reports ready for final decision</p>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <app-card>
          <div class="text-center">
            <p class="text-2xl sm:text-3xl font-bold text-blue-600">
              {{ reports().length }}
            </p>
            <p class="text-xs sm:text-sm text-gray-500 mt-1 dark:text-gray-400">Ready to Finalize</p>
          </div>
        </app-card>
        <app-card>
          <div class="text-center">
            <p class="text-2xl sm:text-3xl font-bold text-green-600">
              {{ stats()?.finalized || 0 }}
            </p>
            <p class="text-xs sm:text-sm text-gray-500 mt-1 dark:text-gray-400">Finalized</p>
          </div>
        </app-card>
        <app-card class="col-span-2 sm:col-span-1">
          <div class="text-center">
            <p class="text-2xl sm:text-3xl font-bold text-red-600">
              {{ stats()?.rejected || 0 }}
            </p>
            <p class="text-xs sm:text-sm text-gray-500 mt-1 dark:text-gray-400">Rejected</p>
          </div>
        </app-card>
      </div>

      <!-- Reports ready for finalization -->
      <app-card title="Reports Awaiting Decision" [noPadding]="true">
        @if (loading()) {
          <div class="py-12">
            <app-loading text="Loading reports..." />
          </div>
        } @else if (reports().length > 0) {
          <!-- Desktop table -->
          <div class="hidden md:block overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 dark:bg-gray-800">
                <tr class="text-left text-sm text-gray-500 dark:text-gray-400">
                  <th class="px-6 py-3 font-medium">At Fault Driver</th>
                  <th class="px-6 py-3 font-medium">Event</th>
                  <th class="px-6 py-3 font-medium">Incident</th>
                  <th class="px-6 py-3 font-medium">Reviews</th>
                  <th class="px-6 py-3 font-medium">Filed</th>
                  <th class="px-6 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                @for (report of reports(); track report._id) {
                  <tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td class="px-6 py-4">
                      <p class="font-medium text-gray-900 dark:text-gray-100">
                        {{
                          report.atFaultDriver?.driverName ||
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
                    <td class="px-6 py-4">
                      <p class="text-gray-900 dark:text-gray-100">{{ report.event?.trackName }}</p>
                      <p class="text-sm text-gray-500 dark:text-gray-400">
                        Race {{ report.race?.raceNumber }}
                      </p>
                    </td>
                    <td class="px-6 py-4">
                      <p class="text-gray-900 dark:text-gray-100">Turn {{ report.turn }}</p>
                      <app-truncate-text [text]="report.description" maxW="max-w-xs"
                        class="text-sm text-gray-500 dark:text-gray-400" />
                    </td>
                    <td class="px-6 py-4">
                      <app-badge variant="info">
                        {{ report.reviewCount || 0 }} review(s)
                      </app-badge>
                    </td>
                    <td class="px-6 py-4 text-gray-500 text-sm dark:text-gray-400">
                      {{ report.reportDate | timeAgo }}
                    </td>
                    <td class="px-6 py-4">
                      <a [routerLink]="['/finalize', report._id]">
                        <app-button variant="success" size="sm">
                          Finalize
                        </app-button>
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Mobile card view -->
          <div class="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
            @for (report of reports(); track report._id) {
              <div class="p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                <div class="flex items-start justify-between gap-3 mb-3">
                  <div class="min-w-0 flex-1">
                    <p class="font-medium text-gray-900 dark:text-gray-100">
                      {{ report.atFaultDriver?.driverName || report.reportedDriver?.driverName }}
                      #{{ report.atFaultDriver?.driverNumber || report.reportedDriver?.driverNumber }}
                    </p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{ report.event?.trackName }} - Race {{ report.race?.raceNumber }}
                    </p>
                  </div>
                  <app-badge variant="info" size="sm">
                    {{ report.reviewCount || 0 }} reviews
                  </app-badge>
                </div>
                <div class="space-y-1 text-sm mb-3">
                  <div class="flex justify-between">
                    <span class="text-gray-500 dark:text-gray-400">Turn</span>
                    <span class="text-gray-900 dark:text-gray-100">{{ report.turn }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500 dark:text-gray-400">Filed</span>
                    <span class="text-gray-900 dark:text-gray-100">{{ report.reportDate | timeAgo }}</span>
                  </div>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
                  {{ report.description }}
                </p>
                <a [routerLink]="['/finalize', report._id]">
                  <app-button variant="success" size="sm" class="w-full">
                    Finalize
                  </app-button>
                </a>
              </div>
            }
          </div>
        } @else {
          <div class="text-center py-12">
            <svg
              class="w-12 h-12 text-gray-300 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            <p class="text-gray-500 dark:text-gray-400">No reports ready for finalization</p>
            <p class="text-sm text-gray-400 mt-1 dark:text-gray-500">
              Reports need to be reviewed first
            </p>
          </div>
        }
      </app-card>
    </div>
  `,
})
export class FinalizeDashboardComponent implements OnInit, OnDestroy {
  private convex = inject(ConvexService);

  reports = signal<any[]>([]);
  stats = signal<any>(null);
  loading = signal(true);

  private unsubscribes: (() => void)[] = [];

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach((unsub) => unsub());
  }

  private loadData(): void {
    // Load reports ready for finalization
    const reportsQuery = this.convex.createReactiveQuery(
      this.convex.api.reports.getReadyForFinalization,
      {},
    );
    this.unsubscribes.push(reportsQuery.unsubscribe);

    const checkReports = setInterval(() => {
      const data = reportsQuery.data();
      if (data !== undefined) {
        this.reports.set(data);
        this.loading.set(false);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkReports));

    // Load stats
    const statsQuery = this.convex.createReactiveQuery(
      this.convex.api.reports.getStats,
      {},
    );
    this.unsubscribes.push(statsQuery.unsubscribe);

    const checkStats = setInterval(() => {
      const data = statsQuery.data();
      if (data !== undefined) {
        this.stats.set(data);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkStats));
  }
}
