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
import { TimeAgoPipe } from "@shared/pipes/date-format.pipe";

@Component({
  selector: "app-my-reviews",
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    LoadingComponent,
    TimeAgoPipe,
  ],
  template: `
    <div class="space-y-6">
      <div
        class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
      >
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
            My Reviews
          </h1>
          <p class="text-gray-500 mt-1 dark:text-gray-400">
            Your submitted steward reviews
          </p>
        </div>
        <a routerLink="/reviews">
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
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              ></path>
            </svg>
            Back to Queue
          </app-button>
        </a>
      </div>

      @if (loading()) {
        <app-loading text="Loading your reviews..." />
      } @else if (reviews().length > 0) {
        <app-card [noPadding]="true">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 dark:bg-gray-800">
                <tr class="text-left text-sm text-gray-500 dark:text-gray-400">
                  <th class="px-6 py-3 font-medium">Ticket ID</th>
                  <th class="px-6 py-3 font-medium">Report Status</th>
                  <th class="px-6 py-3 font-medium">Self Reported</th>
                  <th class="px-6 py-3 font-medium">Recommended Penalty</th>
                  <th class="px-6 py-3 font-medium">Reviewed</th>
                  <th class="px-6 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                @for (review of reviews(); track review._id) {
                  <tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td
                      class="px-6 py-4 font-mono text-xs text-gray-500 dark:text-gray-400"
                    >
                      {{ review.report?.reportId || "-" }}
                    </td>
                    <td class="px-6 py-4">
                      <app-badge
                        [variant]="getStatusVariant(review.report?.status)"
                      >
                        {{ formatStatus(review.report?.status) }}
                      </app-badge>
                    </td>
                    <td class="px-6 py-4">
                      @if (review.isSelfReport) {
                        <app-badge variant="success" size="sm">Yes</app-badge>
                      } @else {
                        <span
                          class="text-gray-400 text-sm dark:text-gray-500"
                          >No</span
                        >
                      }
                    </td>
                    <td class="px-6 py-4">
                      <span
                        class="text-gray-900 dark:text-gray-100 text-sm"
                        >{{ review.recommendedPenaltyObj?.name || review.recommendedPenalty || "-" }}</span
                      >
                    </td>
                    <td
                      class="px-6 py-4 text-gray-500 text-sm dark:text-gray-400"
                    >
                      {{ review.reviewDate | timeAgo }}
                    </td>
                    <td class="px-6 py-4">
                      <div class="flex gap-3">
                        @if (review.report && !review.report.isFinalized) {
                          <a
                            [routerLink]="['/reviews', review.reportId]"
                            class="text-primary-600 hover:text-primary-700 font-medium text-sm"
                          >
                            Edit
                          </a>
                        }
                        @if (review.report) {
                          <a
                            [routerLink]="['/reports', review.reportId]"
                            class="text-primary-600 hover:text-primary-700 font-medium text-sm"
                          >
                            View
                          </a>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </app-card>
      } @else {
        <app-card>
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              ></path>
            </svg>
            <p class="text-gray-500 dark:text-gray-400">
              You haven't submitted any reviews yet
            </p>
            <p class="text-sm text-gray-400 mt-1 dark:text-gray-500">
              Reviews you submit will appear here
            </p>
            <a routerLink="/reviews" class="mt-4 inline-block">
              <app-button variant="primary">Go to Review Queue</app-button>
            </a>
          </div>
        </app-card>
      }
    </div>
  `,
})
export class MyReviewsComponent implements OnInit, OnDestroy {
  private convex = inject(ConvexService);
  private authService = inject(AuthService);

  reviews = signal<any[]>([]);
  loading = signal(true);

  private unsubscribes: (() => void)[] = [];

  ngOnInit(): void {
    this.loadReviews();
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach((unsub) => unsub());
  }

  private loadReviews(): void {
    const userId = this.authService.getUserId();
    if (!userId) {
      this.loading.set(false);
      return;
    }

    const reviewsQuery = this.convex.createReactiveQuery(
      this.convex.api.reviews.getByUser,
      { userId },
    );
    this.unsubscribes.push(reviewsQuery.unsubscribe);

    const checkReviews = setInterval(() => {
      const data = reviewsQuery.data() as any;
      if (data !== undefined) {
        this.reviews.set(data);
        this.loading.set(false);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkReviews));
  }

  getStatusVariant(
    status: string | undefined,
  ): "warning" | "info" | "success" | "danger" | "default" {
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
        return "default";
    }
  }

  formatStatus(status: string | undefined): string {
    if (!status) return "Unknown";
    return status.charAt(0).toUpperCase() + status.slice(1);
  }
}
