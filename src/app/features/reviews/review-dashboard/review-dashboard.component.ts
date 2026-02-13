import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  computed,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { ConvexService } from "@core/services/convex.service";
import { AuthService } from "@core/services/auth.service";
import { CardComponent } from "@shared/components/card/card.component";
import { ButtonComponent } from "@shared/components/button/button.component";
import { BadgeComponent } from "@shared/components/badge/badge.component";
import { LoadingComponent } from "@shared/components/loading/loading.component";
import { TruncateTextComponent } from "@shared/components/truncate-text/truncate-text.component";
import { DateFormatPipe, TimeAgoPipe } from "@shared/pipes/date-format.pipe";

@Component({
  selector: "app-review-dashboard",
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
      <div
        class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
      >
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Review Queue
          </h1>
          <p class="text-gray-500 mt-1 dark:text-gray-400">
            Reports pending your review
          </p>
        </div>
        <div class="flex gap-2 flex-wrap">
          <a routerLink="/reviews/my-reviews">
            <app-button variant="secondary">
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
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                ></path>
              </svg>
              My Reviews
            </app-button>
          </a>
          @if (canSearchReviews()) {
            <a routerLink="/reviews/search">
              <app-button variant="secondary">
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
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  ></path>
                </svg>
                Search Reviews
              </app-button>
            </a>
          }
          <a routerLink="/reviews/steward-incident">
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
              Create Incident
            </app-button>
          </a>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <app-card>
          <div class="text-center">
            <p class="text-3xl font-bold text-amber-600">
              {{ pendingReports().length }}
            </p>
            <p class="text-sm text-gray-500 mt-1 dark:text-gray-400">
              Pending Review
            </p>
          </div>
        </app-card>
        <app-card>
          <div class="text-center">
            <p class="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {{ reviewStats()?.total || 0 }}
            </p>
            <p class="text-sm text-gray-500 mt-1 dark:text-gray-400">
              Your Total Reviews
            </p>
          </div>
        </app-card>
        <app-card>
          <div class="text-center">
            <p class="text-3xl font-bold text-green-600">
              {{ reviewStats()?.today || 0 }}
            </p>
            <p class="text-sm text-gray-500 mt-1 dark:text-gray-400">
              Reviewed Today
            </p>
          </div>
        </app-card>
        <app-card>
          <div class="text-center">
            <p class="text-3xl font-bold text-blue-600">
              {{ reviewedReports().length }}
            </p>
            <p class="text-sm text-gray-500 mt-1 dark:text-gray-400">
              Ready to Finalize
            </p>
          </div>
        </app-card>
      </div>

      <!-- Pending reports -->
      <app-card title="Pending Reviews" [noPadding]="true">
        @if (loading()) {
          <div class="py-12">
            <app-loading text="Loading reports..." />
          </div>
        } @else if (pendingReports().length > 0) {
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 dark:bg-gray-800">
                <tr class="text-left text-sm text-gray-500 dark:text-gray-400">
                  <th
                    class="px-6 py-3 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                    (click)="sortPending('ticketId')"
                  >
                    Ticket ID{{
                      getSortArrow(
                        "ticketId",
                        pendingSortColumn(),
                        pendingSortDirection()
                      )
                    }}
                  </th>
                  <th
                    class="px-6 py-3 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                    (click)="sortPending('atFaultDriver')"
                  >
                    At Fault Driver{{
                      getSortArrow(
                        "atFaultDriver",
                        pendingSortColumn(),
                        pendingSortDirection()
                      )
                    }}
                  </th>
                  <th
                    class="px-6 py-3 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                    (click)="sortPending('event')"
                  >
                    Event{{
                      getSortArrow(
                        "event",
                        pendingSortColumn(),
                        pendingSortDirection()
                      )
                    }}
                  </th>
                  <th
                    class="px-6 py-3 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                    (click)="sortPending('incident')"
                  >
                    Incident{{
                      getSortArrow(
                        "incident",
                        pendingSortColumn(),
                        pendingSortDirection()
                      )
                    }}
                  </th>
                  <th
                    class="px-6 py-3 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                    (click)="sortPending('filed')"
                  >
                    Filed{{
                      getSortArrow(
                        "filed",
                        pendingSortColumn(),
                        pendingSortDirection()
                      )
                    }}
                  </th>
                  <th
                    class="px-6 py-3 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                    (click)="sortPending('reviews')"
                  >
                    Reviews{{
                      getSortArrow(
                        "reviews",
                        pendingSortColumn(),
                        pendingSortDirection()
                      )
                    }}
                  </th>
                  <th class="px-6 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                @for (report of sortedPendingReports(); track report._id) {
                  <tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td
                      class="px-6 py-4 font-mono text-xs text-gray-500 dark:text-gray-400"
                    >
                      {{ report.reportId }}
                    </td>
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
                      <p class="text-gray-900 dark:text-gray-100">
                        {{ report.event?.trackName }}
                      </p>
                      <p class="text-sm text-gray-500 dark:text-gray-400">
                        Race {{ report.race?.raceNumber }}
                      </p>
                    </td>
                    <td class="px-6 py-4">
                      <p class="text-gray-900 dark:text-gray-100">
                        Turn {{ report.turn }}
                      </p>
                      <app-truncate-text
                        [text]="report.description"
                        maxW="max-w-xs"
                        class="text-sm text-gray-500 dark:text-gray-400"
                      />
                    </td>
                    <td
                      class="px-6 py-4 text-gray-500 text-sm dark:text-gray-400"
                    >
                      {{ report.reportDate | timeAgo }}
                    </td>
                    <td class="px-6 py-4">
                      <app-badge
                        [variant]="report.reviewCount > 0 ? 'info' : 'default'"
                      >
                        {{ report.reviewCount || 0 }} review(s)
                      </app-badge>
                    </td>
                    <td class="px-6 py-4">
                      <a
                        [routerLink]="['/reviews', report._id]"
                        class="text-primary-600 hover:text-primary-700 font-medium text-sm"
                      >
                        {{ reviewActionLabel(report) }}
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
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
            <p class="text-gray-500 dark:text-gray-400">
              No reports pending review
            </p>
            <p class="text-sm text-gray-400 mt-1 dark:text-gray-500">
              All caught up!
            </p>
          </div>
        }
      </app-card>

      <!-- Already reviewed (ready for finalization) -->
      @if (reviewedReports().length > 0) {
        <app-card
          title="Ready for Finalization"
          subtitle="These reports have been reviewed and await final decision"
          [noPadding]="true"
        >
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 dark:bg-gray-800">
                <tr class="text-left text-sm text-gray-500 dark:text-gray-400">
                  <th
                    class="px-6 py-3 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                    (click)="sortReviewed('ticketId')"
                  >
                    Ticket ID{{
                      getSortArrow(
                        "ticketId",
                        reviewedSortColumn(),
                        reviewedSortDirection()
                      )
                    }}
                  </th>
                  <th
                    class="px-6 py-3 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                    (click)="sortReviewed('atFaultDriver')"
                  >
                    At Fault Driver{{
                      getSortArrow(
                        "atFaultDriver",
                        reviewedSortColumn(),
                        reviewedSortDirection()
                      )
                    }}
                  </th>
                  <th
                    class="px-6 py-3 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                    (click)="sortReviewed('event')"
                  >
                    Event{{
                      getSortArrow(
                        "event",
                        reviewedSortColumn(),
                        reviewedSortDirection()
                      )
                    }}
                  </th>
                  <th
                    class="px-6 py-3 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                    (click)="sortReviewed('reviews')"
                  >
                    Reviews{{
                      getSortArrow(
                        "reviews",
                        reviewedSortColumn(),
                        reviewedSortDirection()
                      )
                    }}
                  </th>
                  <th
                    class="px-6 py-3 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                    (click)="sortReviewed('status')"
                  >
                    Status{{
                      getSortArrow(
                        "status",
                        reviewedSortColumn(),
                        reviewedSortDirection()
                      )
                    }}
                  </th>
                  <th class="px-6 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                @for (
                  report of sortedReviewedReports();
                  track report.reportId
                ) {
                  <tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td
                      class="px-6 py-4 font-mono text-xs text-gray-500 dark:text-gray-400"
                    >
                      {{ report.reportId }}
                    </td>
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
                      <p class="text-gray-900 dark:text-gray-100">
                        {{ report.event?.trackName }}
                      </p>
                      <p class="text-sm text-gray-500 dark:text-gray-400">
                        Race {{ report.race?.raceNumber }}, Turn
                        {{ report.turn }}
                      </p>
                    </td>
                    <td class="px-6 py-4">
                      <app-badge variant="info">
                        {{ report.reviewCount || 0 }} review(s)
                      </app-badge>
                    </td>
                    <td class="px-6 py-4">
                      <app-badge variant="info">Reviewed</app-badge>
                    </td>
                    <td class="px-6 py-4">
                      <div class="flex gap-3">
                        @if (hasUserReviewed(report)) {
                          <a
                            [routerLink]="['/reviews', report._id]"
                            class="text-primary-600 hover:text-primary-700 font-medium text-sm"
                          >
                            Edit Review
                          </a>
                        }
                        <a
                          [routerLink]="['/reports', report._id]"
                          class="text-primary-600 hover:text-primary-700 font-medium text-sm"
                        >
                          View
                        </a>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </app-card>
      }
    </div>
  `,
})
export class ReviewDashboardComponent implements OnInit, OnDestroy {
  private convex = inject(ConvexService);
  private authService = inject(AuthService);

  pendingReports = signal<any[]>([]);
  reviewedReports = signal<any[]>([]);
  reviewStats = signal<any>(null);
  loading = signal(true);

  pendingSortColumn = signal<string | null>(null);
  pendingSortDirection = signal<"asc" | "desc">("asc");
  reviewedSortColumn = signal<string | null>(null);
  reviewedSortDirection = signal<"asc" | "desc">("asc");

  sortedPendingReports = computed(() => {
    const reports = this.pendingReports();
    const column = this.pendingSortColumn();
    const direction = this.pendingSortDirection();
    if (!column) return reports;
    return this.sortReports([...reports], column, direction);
  });

  sortedReviewedReports = computed(() => {
    const reports = this.reviewedReports();
    const column = this.reviewedSortColumn();
    const direction = this.reviewedSortDirection();
    if (!column) return reports;
    return this.sortReports([...reports], column, direction);
  });

  private unsubscribes: (() => void)[] = [];

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach((unsub) => unsub());
  }

  private loadData(): void {
    // Load pending reports
    const pendingQuery = this.convex.createReactiveQuery(
      this.convex.api.reports.getPendingForReview,
      {},
    );
    this.unsubscribes.push(pendingQuery.unsubscribe);

    const checkPending = setInterval(() => {
      const data = pendingQuery.data();
      if (data !== undefined) {
        this.pendingReports.set(data);
        this.loading.set(false);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkPending));

    // Load reviewed reports (ready for finalization)
    const reviewedQuery = this.convex.createReactiveQuery(
      this.convex.api.reports.getReadyForFinalization,
      {},
    );
    this.unsubscribes.push(reviewedQuery.unsubscribe);

    const checkReviewed = setInterval(() => {
      const data = reviewedQuery.data();
      if (data !== undefined) {
        this.reviewedReports.set(data);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkReviewed));

    // Load review stats for current user
    const userId = this.authService.getUserId();
    if (userId) {
      const statsQuery = this.convex.createReactiveQuery(
        this.convex.api.reviews.getStats,
        { userId },
      );
      this.unsubscribes.push(statsQuery.unsubscribe);

      const checkStats = setInterval(() => {
        const data = statsQuery.data();
        if (data !== undefined) {
          this.reviewStats.set(data);
        }
      }, 100);
      this.unsubscribes.push(() => clearInterval(checkStats));
    }
  }

  canSearchReviews(): boolean {
    return this.authService.hasRole("head_steward", "league_manager");
  }

  reviewActionLabel(report: any): string {
    return this.hasUserReviewed(report) ? "Edit Review" : "Review";
  }

  hasUserReviewed(report: any): boolean {
    const currentUserId = this.authService.getUserId();
    if (!currentUserId || !report?.reviews) return false;
    return report.reviews.some(
      (review: any) => String(review.userId) === String(currentUserId),
    );
  }

  sortPending(column: string): void {
    if (this.pendingSortColumn() === column) {
      this.pendingSortDirection.set(
        this.pendingSortDirection() === "asc" ? "desc" : "asc",
      );
    } else {
      this.pendingSortColumn.set(column);
      this.pendingSortDirection.set("asc");
    }
  }

  sortReviewed(column: string): void {
    if (this.reviewedSortColumn() === column) {
      this.reviewedSortDirection.set(
        this.reviewedSortDirection() === "asc" ? "desc" : "asc",
      );
    } else {
      this.reviewedSortColumn.set(column);
      this.reviewedSortDirection.set("asc");
    }
  }

  private sortReports(
    reports: any[],
    column: string,
    direction: "asc" | "desc",
  ): any[] {
    return reports.sort((a, b) => {
      let comparison = 0;
      const aVal = this.getSortValue(a, column);
      const bVal = this.getSortValue(b, column);
      if (aVal < bVal) comparison = -1;
      if (aVal > bVal) comparison = 1;
      return direction === "asc" ? comparison : -comparison;
    });
  }

  private getSortValue(report: any, column: string): any {
    switch (column) {
      case "ticketId":
        return report.reportId;
      case "atFaultDriver":
        return (
          (
            report.atFaultDriver || report.reportedDriver
          )?.driverName?.toLowerCase() || ""
        );
      case "event":
        return `${report.event?.trackName || ""} ${report.race?.raceNumber || ""}`;
      case "incident":
        return report.turn;
      case "filed":
        return new Date(report.reportDate || 0);
      case "reviews":
        return report.reviewCount || 0;
      case "status":
        return "Reviewed";
      default:
        return "";
    }
  }

  getSortArrow(
    column: string,
    currentSortColumn: string | null,
    direction: "asc" | "desc",
  ): string {
    if (column !== currentSortColumn) return "";
    return direction === "asc" ? " ↑" : " ↓";
  }
}
