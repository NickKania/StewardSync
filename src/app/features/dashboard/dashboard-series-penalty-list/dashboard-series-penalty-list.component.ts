import {
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  signal,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { toPng } from "html-to-image";
import { Id } from "@convex/_generated/dataModel";
import { ConvexService } from "@core/services/convex.service";
import { AuthService } from "@core/services/auth.service";
import { CardComponent } from "@shared/components/card/card.component";
import { ButtonComponent } from "@shared/components/button/button.component";
import { BadgeComponent } from "@shared/components/badge/badge.component";
import {
  LegendComponent,
  LegendItem,
} from "@shared/components/legend/legend.component";
import { LoadingComponent } from "@shared/components/loading/loading.component";
import { DateFormatPipe } from "@shared/pipes/date-format.pipe";

type PenaltyStatus = "active" | "served_pending_review";
type BadgeVariant = "warning" | "info";

interface DashboardPenaltyRow {
  _id: Id<"driverSeriesPenalties">;
  seriesId: Id<"series">;
  seriesName: string;
  driverName: string;
  discordUsername: string | null;
  driverNumber: number | null;
  driverClass: string | null;
  penaltyName: string;
  penaltyDescription: string;
  threshold: number | null;
  pointsAtAssignment: number;
  assignedAt: number;
  expectedServeDate: number | null;
  isServed: boolean;
  requiresReview: boolean;
  reviewStatus:
    | "not_required"
    | "required_no_request"
    | "open"
    | "scheduled"
    | "completed";
  reviewRequestId: string | null;
  status: PenaltyStatus;
}

interface DashboardPenaltyGroup {
  seriesId: Id<"series">;
  seriesName: string;
  penalties: DashboardPenaltyRow[];
}

@Component({
  selector: "app-dashboard-series-penalty-list",
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    LegendComponent,
    LoadingComponent,
    DateFormatPipe,
  ],
  template: `
    <app-card [title]="title()" [subtitle]="subtitle()">
      <div class="space-y-4">
        <div class="flex justify-end">
          <app-button
            variant="secondary"
            size="sm"
            [loading]="exporting()"
            (onClick)="exportImage()"
          >
            Export
          </app-button>
        </div>

        @if (loading()) {
          <app-loading text="Loading series penalties..." />
        } @else if (penaltyGroups().length === 0) {
          <p class="text-center py-8 text-gray-500 dark:text-gray-400">
            No series penalties found.
          </p>
        } @else {
          <div #exportContainer class="space-y-8">
            @for (group of penaltyGroups(); track group.seriesId) {
              <div class="space-y-3">
                <h3
                  class="text-lg font-semibold text-gray-900 dark:text-gray-100"
                >
                  {{ group.seriesName }}
                </h3>

                <div class="overflow-x-auto">
                  <table class="w-full">
                    <thead class="bg-gray-50 dark:bg-gray-800">
                      <tr
                        class="text-left text-sm text-gray-500 dark:text-gray-400"
                      >
                        <th class="px-4 py-3 font-medium">Driver</th>
                        <th class="px-4 py-3 font-medium">Class</th>
                        <th class="px-4 py-3 font-medium">Penalty</th>
                        <th class="px-4 py-3 font-medium">Penalty Threshold</th>
                        <th class="px-4 py-3 font-medium">Penalty Points</th>
                        <th class="px-4 py-3 font-medium">
                          Penalty Accrued Date
                        </th>
                        <th class="px-4 py-3 font-medium">
                          Expected Serve Date
                        </th>
                        <th class="px-4 py-3 font-medium">Status</th>
                        <th class="px-4 py-3 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody
                      class="divide-y divide-gray-100 dark:divide-gray-800"
                    >
                      @for (penalty of group.penalties; track penalty._id) {
                        <tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td class="px-4 py-3">
                            <p
                              class="font-medium text-gray-900 dark:text-gray-100"
                            >
                              {{ penalty.driverName }}
                            </p>
                            @if (penalty.discordUsername) {
                              <p
                                class="text-sm text-gray-500 dark:text-gray-400"
                              >
                                &#64;{{ penalty.discordUsername }}
                              </p>
                            }
                            <p class="text-sm text-gray-500 dark:text-gray-400">
                              #{{ penalty.driverNumber ?? "-" }}
                            </p>
                          </td>
                          <td
                            class="px-4 py-3 text-gray-700 dark:text-gray-300"
                          >
                            {{ penalty.driverClass ?? "-" }}
                          </td>
                          <td class="px-4 py-3">
                            <p
                              class="font-medium text-gray-900 dark:text-gray-100"
                            >
                              {{ penalty.penaltyName }}
                            </p>
                          </td>
                          <td
                            class="px-4 py-3 text-gray-700 dark:text-gray-300"
                          >
                            @if (penalty.threshold !== null) {
                              {{ penalty.threshold }} pts
                            } @else {
                              -
                            }
                          </td>
                          <td
                            class="px-4 py-3 text-gray-700 dark:text-gray-300"
                          >
                            {{ penalty.pointsAtAssignment }}
                          </td>
                          <td
                            class="px-4 py-3 text-gray-500 dark:text-gray-400"
                          >
                            {{ penalty.assignedAt | dateFormat: "PP" }}
                          </td>
                          <td
                            class="px-4 py-3 text-gray-500 dark:text-gray-400"
                          >
                            @if (penalty.expectedServeDate !== null) {
                              {{ penalty.expectedServeDate | dateFormat: "PP" }}
                            } @else {
                              No upcoming event
                            }
                          </td>
                          <td class="px-4 py-3">
                            <app-badge
                              [variant]="getStatusVariant(penalty.status)"
                            >
                              {{ getStatusLabel(penalty.status) }}
                            </app-badge>
                          </td>
                          <td class="px-4 py-3">
                            @if (penalty.reviewRequestId) {
                              <a
                                [routerLink]="[
                                  '/race-reviews',
                                  penalty.reviewRequestId,
                                ]"
                                class="inline-block text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 mr-2"
                              >
                                Open Review
                              </a>
                            } @else if (penalty.requiresReview) {
                              <p
                                class="text-xs text-red-700 dark:text-red-300 mb-2"
                              >
                                No review request submitted yet.
                              </p>
                            }
                            @if (canMarkAsServed() && !penalty.isServed) {
                              <app-button
                                variant="secondary"
                                size="sm"
                                [loading]="markingPenaltyId() === penalty._id"
                                (onClick)="markAsServed(penalty._id)"
                              >
                                Mark Served
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

            @if (legendItems().length > 0) {
              <app-legend [items]="legendItems()" title="Penalty Legend" />
            }
          </div>
        }
      </div>
    </app-card>
  `,
})
export class DashboardSeriesPenaltyListComponent {
  @ViewChild("exportContainer")
  private exportContainer?: ElementRef<HTMLElement>;

  private readonly convex = inject(ConvexService);
  private readonly authService = inject(AuthService);
  private requestId = 0;

  readonly title = input("Series Penalty List");
  readonly subtitle = input(
    "Series penalties grouped by championship and tracked by assignment date",
  );
  readonly seriesId = input<Id<"series"> | null>(null);

  readonly loading = signal(true);
  readonly exporting = signal(false);
  readonly penaltyGroups = signal<DashboardPenaltyGroup[]>([]);
  readonly markingPenaltyId = signal<Id<"driverSeriesPenalties"> | null>(null);
  readonly canMarkAsServed = computed(() =>
    this.authService.hasRole("head_steward", "league_manager"),
  );
  readonly legendItems = computed<LegendItem[]>(() => {
    const byPenaltyName = new Map<string, string>();

    for (const group of this.penaltyGroups()) {
      for (const penalty of group.penalties) {
        if (!byPenaltyName.has(penalty.penaltyName)) {
          byPenaltyName.set(
            penalty.penaltyName,
            penalty.penaltyDescription || "No description provided.",
          );
        }
      }
    }

    return Array.from(byPenaltyName.entries()).map(([label, description]) => ({
      label,
      description,
    }));
  });

  private readonly loadEffect = effect(
    () => {
      const currentSeriesId = this.seriesId();
      void this.loadPenaltyGroups(currentSeriesId);
    },
    { allowSignalWrites: true },
  );

  private async loadPenaltyGroups(
    seriesId: Id<"series"> | null,
  ): Promise<void> {
    const currentRequest = ++this.requestId;
    this.loading.set(true);

    try {
      const data = await this.convex.query(
        this.convex.api.driverSeriesPenalties.getDashboardPenaltyGroups,
        {
          seriesId: seriesId ?? undefined,
        },
      );

      if (currentRequest !== this.requestId) {
        return;
      }

      this.penaltyGroups.set((data ?? []) as DashboardPenaltyGroup[]);
    } catch (error) {
      console.error("Failed to load dashboard penalties:", error);
      if (currentRequest === this.requestId) {
        this.penaltyGroups.set([]);
      }
    } finally {
      if (currentRequest === this.requestId) {
        this.loading.set(false);
      }
    }
  }

  async markAsServed(penaltyId: Id<"driverSeriesPenalties">): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) {
      return;
    }

    this.markingPenaltyId.set(penaltyId);
    try {
      await this.convex.mutation(
        this.convex.api.driverSeriesPenalties.markAsServed,
        {
          id: penaltyId,
          servedBy: userId,
        },
      );

      await this.loadPenaltyGroups(this.seriesId());
    } catch (error) {
      console.error("Failed to mark penalty as served:", error);
    } finally {
      this.markingPenaltyId.set(null);
    }
  }

  async exportImage(): Promise<void> {
    if (!this.exportContainer?.nativeElement) {
      return;
    }

    this.exporting.set(true);
    try {
      const dataUrl = await toPng(this.exportContainer.nativeElement, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });

      const activeSeriesName =
        this.penaltyGroups()[0]?.seriesName || "all-series";
      const filename = `series-penalties-${this.slugify(activeSeriesName)}.png`;

      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Failed to export penalties:", error);
    } finally {
      this.exporting.set(false);
    }
  }

  getStatusVariant(status: PenaltyStatus): BadgeVariant {
    return status === "served_pending_review" ? "warning" : "info";
  }

  getStatusLabel(status: PenaltyStatus): string {
    return status === "served_pending_review"
      ? "Served - Review Pending"
      : "Active";
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
}
