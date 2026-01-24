import { Component, inject, OnInit, OnDestroy, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { ConvexService } from "@core/services/convex.service";
import { AuthService } from "@core/services/auth.service";
import { CardComponent } from "@shared/components/card/card.component";
import { ButtonComponent } from "@shared/components/button/button.component";
import { BadgeComponent } from "@shared/components/badge/badge.component";
import { LoadingComponent } from "@shared/components/loading/loading.component";
import { DateFormatPipe } from "@shared/pipes/date-format.pipe";
import { Id } from "@convex/_generated/dataModel";

@Component({
  selector: "app-driver-dashboard",
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    LoadingComponent,
    DateFormatPipe,
  ],
  template: `
    <div class="space-y-6">
      @if (loading()) {
        <app-loading text="Loading your dashboard..." />
      } @else if (seriesGroups().length === 0) {
        <app-card>
          <div class="text-center py-12">
            <svg
              class="w-16 h-16 text-gray-300 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              ></path>
            </svg>
            <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Driver Profiles Not Found
            </h2>
            <p class="text-gray-500 dark:text-gray-400 mb-4">
              We couldn't find any driver profiles linked to your Discord account.
              Please contact an administrator to link your account.
            </p>
            <a
              href="mailto:admin@stewardsync.com"
              class="text-primary-600 hover:text-primary-700 font-medium dark:text-primary-400 dark:hover:text-primary-300"
            >
              Contact an Admin
            </a>
          </div>
        </app-card>
      } @else {
        <div
          class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Welcome back, {{ authService.user()!.name.split(" ")[0] }}
            </h1>
            <p class="text-gray-500 dark:text-gray-400 mt-1">
              Here's what's happening across your series
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

        <div class="space-y-10">
          @for (seriesGroup of seriesGroups(); track seriesGroup.seriesKey) {
            <div class="space-y-6">
              <div>
                <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {{ seriesGroup.seriesName }}
                </h2>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Series overview and penalties
                </p>
              </div>

              <app-card
                title="Series Penalties"
                subtitle="Accumulated penalties from license points"
              >
                @if (seriesGroup.loadingSeriesPenalties) {
                  <app-loading text="Loading penalties..." />
                } @else if (seriesGroup.seriesPenalties.length === 0) {
                  <p class="text-gray-500 dark:text-gray-400 text-center py-8">
                    No series penalties
                  </p>
                } @else {
                  <div class="overflow-x-auto">
                    <table class="w-full">
                      <thead>
                        <tr
                          class="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700"
                        >
                          <th class="pb-3 font-medium">Penalty</th>
                          <th class="pb-3 font-medium">Threshold</th>
                          <th class="pb-3 font-medium">Points at Assignment</th>
                          <th class="pb-3 font-medium">Assigned Date</th>
                          <th class="pb-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody
                        class="divide-y divide-gray-100 dark:divide-gray-800"
                      >
                        @for (
                          penalty of seriesGroup.seriesPenalties;
                          track penalty._id
                        ) {
                          <tr>
                            <td
                              class="py-3 font-medium text-gray-900 dark:text-gray-100"
                            >
                              {{ penalty.penaltyName }}
                            </td>
                            <td class="py-3 text-gray-700 dark:text-gray-300">
                              {{ penalty.threshold }} points
                            </td>
                            <td class="py-3 text-gray-700 dark:text-gray-300">
                              {{ penalty.pointsAtAssignment }} points
                            </td>
                            <td class="py-3 text-gray-500 dark:text-gray-400">
                              {{ penalty.assignedAt | dateFormat: "PPP" }}
                            </td>
                            <td class="py-3">
                              <app-badge
                                [variant]="
                                  penalty.isServed ? 'success' : 'danger'
                                "
                              >
                                {{ penalty.isServed ? "Served" : "Active" }}
                              </app-badge>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              </app-card>

              <app-card
                title="Individual Penalties"
                subtitle="Penalties from specific incidents"
              >
                @if (seriesGroup.loadingIndividualPenalties) {
                  <app-loading text="Loading penalties..." />
                } @else if (seriesGroup.individualPenalties.length === 0) {
                  <p class="text-gray-500 dark:text-gray-400 text-center py-8">
                    No individual penalties
                  </p>
                } @else {
                  <div class="overflow-x-auto">
                    <table class="w-full">
                      <thead>
                        <tr
                          class="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700"
                        >
                          <th class="pb-3 font-medium">Event</th>
                          <th class="pb-3 font-medium">Race</th>
                          <th class="pb-3 font-medium">Lap</th>
                          <th class="pb-3 font-medium">Turn</th>
                          <th class="pb-3 font-medium">Penalty</th>
                          <th class="pb-3 font-medium">Severity</th>
                          <th class="pb-3 font-medium">Time Penalty</th>
                          <th class="pb-3 font-medium">Decision</th>
                          <th class="pb-3 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody
                        class="divide-y divide-gray-100 dark:divide-gray-800"
                      >
                        @for (
                          penalty of seriesGroup.individualPenalties;
                          track penalty.reportId
                        ) {
                          <tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
                            <td
                              class="py-3 font-medium text-gray-900 dark:text-gray-100"
                            >
                              {{ penalty.event?.trackName }}
                            </td>
                            <td class="py-3 text-gray-700 dark:text-gray-300">
                              {{ penalty.race?.raceNumber }}
                            </td>
                            <td class="py-3 text-gray-700 dark:text-gray-300">
                              {{ penalty.lap }}
                            </td>
                            <td class="py-3 text-gray-700 dark:text-gray-300">
                              {{ penalty.turn }}
                            </td>
                            <td
                              class="py-3 font-medium text-gray-900 dark:text-gray-100"
                            >
                              {{ penalty.appliedPenalty?.name }}
                            </td>
                            <td class="py-3">
                              <app-badge variant="warning"
                                >{{
                                  penalty.appliedPenalty?.licensePoints
                                }}
                                pts</app-badge
                              >
                            </td>
                            <td class="py-3 text-gray-700 dark:text-gray-300">
                              {{ penalty.appliedPenalty?.timePenalty }}s
                            </td>
                            <td
                              class="py-3 text-sm text-gray-600 dark:text-gray-400 truncate max-w-xs"
                            >
                              {{ penalty.finalDecision }}
                            </td>
                            <td class="py-3 text-gray-500 dark:text-gray-400">
                              {{ penalty.finalizedAt | dateFormat: "PPP" }}
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              </app-card>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class DriverDashboardComponent implements OnInit, OnDestroy {
  private convex = inject(ConvexService);
  authService = inject(AuthService);

  loading = signal(true);
  seriesGroups = signal<any[]>([]);
  private unsubscribes: (() => void)[] = [];

  ngOnInit(): void {
    this.loadDriverAndData();
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach((unsub) => unsub());
  }

  private async loadDriverAndData(): Promise<void> {
    this.loading.set(true);
    const userId = this.authService.getUserId();
    if (!userId) {
      this.seriesGroups.set([]);
      this.loading.set(false);
      return;
    }

    const drivers = await this.convex.query(this.convex.api.drivers.list, {});
    const linkedDrivers = (drivers as any[]).filter(
      (driver) => driver.userId === userId,
    );

    if (linkedDrivers.length === 0) {
      this.seriesGroups.set([]);
      this.loading.set(false);
      return;
    }

    const seriesIds = Array.from(
      new Set(
        linkedDrivers
          .map((driver) => driver.championshipId)
          .filter((seriesId) => seriesId),
      ),
    );

    const seriesNameMap = new Map<string, string>();
    await Promise.all(
      seriesIds.map(async (seriesId) => {
        const series = await this.convex.query(
          this.convex.api.series.getById,
          { id: seriesId },
        );

        if (series) {
          seriesNameMap.set(seriesId as string, series.name);
        }
      }),
    );

    const groupsMap = new Map<string, any>();
    linkedDrivers.forEach((driver) => {
      const seriesId = driver.championshipId ?? null;
      const key = seriesId ? seriesId.toString() : 'unknown';
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          seriesKey: key,
          seriesId,
          seriesName: seriesId
            ? seriesNameMap.get(seriesId as string) || 'Unknown Series'
            : 'Unknown Series',
          driverIds: [],
          loadingSeriesPenalties: true,
          loadingIndividualPenalties: true,
          seriesPenalties: [],
          individualPenalties: [],
        });
      }

      groupsMap.get(key).driverIds.push(driver._id);
    });

    const groups = Array.from(groupsMap.values()).sort((a, b) =>
      a.seriesName.localeCompare(b.seriesName),
    );
    this.seriesGroups.set(groups);
    this.loading.set(false);

    await Promise.all(
      groups.map(async (group) => {
        await Promise.all([
          this.loadSeriesPenalties(group),
          this.loadIndividualPenalties(group),
        ]);
      }),
    );
  }

  private updateSeriesGroup(seriesKey: string, updates: Partial<any>): void {
    this.seriesGroups.update((groups) =>
      groups.map((group) =>
        group.seriesKey === seriesKey ? { ...group, ...updates } : group,
      ),
    );
  }

  private async loadSeriesPenalties(group: any): Promise<void> {
    try {
      const penaltiesByDriver = await Promise.all(
        group.driverIds.map((driverId: Id<"drivers">) =>
          this.convex.query(
            this.convex.api.driverSeriesPenalties.getDriverPenaltyDetails,
            { driverId, seriesId: group.seriesId || undefined },
          ),
        ),
      );
      const penalties = penaltiesByDriver
        .flat()
        .sort((a, b) => b.assignedAt - a.assignedAt);

      this.updateSeriesGroup(group.seriesKey, {
        seriesPenalties: penalties,
        loadingSeriesPenalties: false,
      });
    } catch (error) {
      console.error('Failed to load series penalties:', error);
      this.updateSeriesGroup(group.seriesKey, {
        seriesPenalties: [],
        loadingSeriesPenalties: false,
      });
    }
  }

  private async loadIndividualPenalties(group: any): Promise<void> {
    try {
      const penaltiesByDriver = await Promise.all(
        group.driverIds.map((driverId: Id<"drivers">) =>
          this.convex.query(this.convex.api.reports.getDriverIndividualPenalties, {
            driverId,
          }),
        ),
      );

      const penalties = penaltiesByDriver.flat().filter((penalty) => {
        if (!group.seriesId) {
          return !penalty.event?.seriesId;
        }
        return penalty.event?.seriesId === group.seriesId;
      });

      this.updateSeriesGroup(group.seriesKey, {
        individualPenalties: penalties,
        loadingIndividualPenalties: false,
      });
    } catch (error) {
      console.error('Failed to load individual penalties:', error);
      this.updateSeriesGroup(group.seriesKey, {
        individualPenalties: [],
        loadingIndividualPenalties: false,
      });
    }
  }
}
