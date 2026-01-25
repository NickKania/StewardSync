import { Component, inject, OnInit, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ConvexService } from "@core/services/convex.service";
import { AuthService } from "@core/services/auth.service";
import { CardComponent } from "@shared/components/card/card.component";
import { ButtonComponent } from "@shared/components/button/button.component";
import { BadgeComponent } from "@shared/components/badge/badge.component";
import { LoadingComponent } from "@shared/components/loading/loading.component";
import { DateFormatPipe } from "@shared/pipes/date-format.pipe";
import { HasRoleDirective } from "@shared/directives/has-role.directive";

@Component({
  selector: "app-penalty-overview-card",
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    LoadingComponent,
    DateFormatPipe,
    HasRoleDirective,
  ],
  template: `
    <app-card
      title="Penalties to Serve"
      subtitle="Most severe unserved penalties by driver"
    >
      @if (loading()) {
        <div class="space-y-4">
          @for (i of [1, 2, 3]; track i) {
            <div class="animate-pulse space-y-2">
              <div class="h-4 bg-gray-200 rounded w-1/3 dark:bg-gray-700"></div>
              <div class="h-12 bg-gray-200 rounded dark:bg-gray-700"></div>
            </div>
          }
        </div>
      } @else if (penaltyGroups().length === 0) {
        <p class="text-gray-500 text-center py-8 dark:text-gray-400">
          No unserved penalties to serve
        </p>
      } @else {
        <div class="space-y-6">
          @for (group of penaltyGroups(); track group.seriesId) {
            <div class="border border-gray-200 rounded-lg overflow-hidden dark:border-gray-700">
              <button
                (click)="toggleSeries(group.seriesId)"
                class="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                <div>
                  <h3 class="font-semibold text-gray-900 dark:text-gray-100">
                    {{ group.seriesName || "Unknown Series" }}
                  </h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ group.penalties.length }} driver(s) with unserved penalties
                  </p>
                </div>
                <svg
                  [class.rotate-180]="expandedSeries().has(group.seriesId)"
                  class="w-5 h-5 text-gray-500 transition-transform dark:text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 9l-7 7-7-7"
                  ></path>
                </svg>
              </button>

              @if (expandedSeries().has(group.seriesId)) {
                <div class="p-4">
                  <div class="overflow-x-auto">
                    <table class="w-full">
                      <thead>
                        <tr
                          class="text-left text-sm text-gray-500 border-b border-gray-200 dark:text-gray-400 dark:border-gray-700"
                        >
                          <th class="pb-3 font-medium">Driver</th>
                          <th class="pb-3 font-medium">Class</th>
                          <th class="pb-3 font-medium">Penalty</th>
                          <th class="pb-3 font-medium">Threshold</th>
                          <th class="pb-3 font-medium">Points</th>
                          <th class="pb-3 font-medium">Assigned</th>
                          <th class="pb-3 font-medium">Status</th>
                          <th class="pb-3 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody
                        class="divide-y divide-gray-100 dark:divide-gray-800"
                      >
                        @for (penalty of group.penalties; track penalty._id) {
                          <tr>
                            <td class="py-3">
                              <p class="font-medium text-gray-900 dark:text-gray-100">
                                {{ penalty.driver?.driverName || "Unknown" }}
                              </p>
                              <p class="text-sm text-gray-500 dark:text-gray-400">
                                #{{ penalty.driver?.driverNumber || "-" }}
                              </p>
                            </td>
                            <td class="py-3 text-gray-700 dark:text-gray-300">
                              {{ penalty.driver?.driverClass || "-" }}
                            </td>
                            <td class="py-3">
                              <p class="font-medium text-gray-900 dark:text-gray-100">
                                {{ penalty.seriesPenalty?.penaltyName || "-" }}
                              </p>
                              @if (
                                penalty.seriesPenalty?.penaltyDescription
                              ) {
                                <p class="text-sm text-gray-500 dark:text-gray-400">
                                  {{ penalty.seriesPenalty.penaltyDescription }}
                                </p>
                              }
                            </td>
                            <td class="py-3 text-gray-700 dark:text-gray-300">
                              {{ penalty.seriesPenaltyThreshold?.threshold || "-" }}
                              points
                            </td>
                            <td class="py-3 text-gray-700 dark:text-gray-300">
                              {{ penalty.pointsAtAssignment }} points
                            </td>
                            <td class="py-3 text-gray-500 dark:text-gray-400">
                              {{ penalty.assignedAt | dateFormat: "PPP" }}
                            </td>
                            <td class="py-3">
                              <app-badge variant="danger"> Active </app-badge>
                            </td>
                            <td class="py-3">
                              @if (
                                authService.hasRole(
                                  "event_manager",
                                  "head_steward"
                                )
                              ) {
                                <app-button
                                  (click)="markAsServed(penalty._id)"
                                  [loading]="markingAsServed() === penalty._id"
                                  variant="secondary"
                                  size="sm"
                                >
                                  Mark as Served
                                </app-button>
                              }
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }
    </app-card>
  `,
})
export class PenaltyOverviewCardComponent implements OnInit {
  private convex = inject(ConvexService);
  authService = inject(AuthService);

  loading = signal(true);
  penaltyGroups = signal<any[]>([]);
  expandedSeries = signal<Set<string>>(new Set());
  markingAsServed = signal<string | null>(null);

  ngOnInit(): void {
    this.loadPenalties();
  }

  private async loadPenalties(): Promise<void> {
    try {
      const data = await this.convex.query(
        this.convex.api.driverSeriesPenalties.getUnservedPenaltiesBySeries,
        {},
      );
      this.penaltyGroups.set(data || []);

      const seriesIds = new Set<string>();
      this.penaltyGroups().forEach((group) => {
        if (group.seriesId) {
          seriesIds.add(group.seriesId);
        }
      });
      this.expandedSeries.set(seriesIds);
    } catch (error) {
      console.error("Failed to load penalties:", error);
      this.penaltyGroups.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  toggleSeries(seriesId: string): void {
    const current = new Set(this.expandedSeries());
    if (current.has(seriesId)) {
      current.delete(seriesId);
    } else {
      current.add(seriesId);
    }
    this.expandedSeries.set(current);
  }

  async markAsServed(penaltyId: string): Promise<void> {
    const user = this.authService.user();
    if (!user) {
      console.error("User not authenticated");
      return;
    }

    try {
      this.markingAsServed.set(penaltyId);

      await this.convex.mutation(
        this.convex.api.driverSeriesPenalties.markAsServed,
        {
          id: penaltyId as any,
          servedBy: user._id as any,
        },
      );

      await this.loadPenalties();
    } catch (error) {
      console.error("Failed to mark penalty as served:", error);
    } finally {
      this.markingAsServed.set(null);
    }
  }
}
