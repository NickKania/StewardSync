import { Component, OnInit, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { ConvexService } from "@core/services/convex.service";
import { AuthService } from "@core/services/auth.service";
import { CardComponent } from "@shared/components/card/card.component";
import { BadgeComponent } from "@shared/components/badge/badge.component";
import { LoadingComponent } from "@shared/components/loading/loading.component";
import { DateFormatPipe } from "@shared/pipes/date-format.pipe";

interface PendingRaceReviewRow {
  _id: string;
  status: "open" | "scheduled";
  createdAt: number;
  selectedMeetingStartAt: number | null;
  selectedMeetingEndAt: number | null;
  availabilityCount: number;
  driverName: string;
  driverNumber: number | null;
  penaltyName: string;
  threshold: number | null;
  seriesName: string;
}

@Component({
  selector: "app-dashboard-race-review-request-list",
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
    <app-card
      title="Pending Race Review Requests"
      subtitle="Drivers awaiting review scheduling or completion"
      [noPadding]="true"
    >
      @if (loading()) {
        <div class="py-10">
          <app-loading text="Loading race review requests..." />
        </div>
      } @else if (requests().length === 0) {
        <p class="text-center py-10 text-gray-500 dark:text-gray-400">
          No pending race review requests.
        </p>
      } @else {
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr class="text-left text-sm text-gray-500 dark:text-gray-400">
                <th class="px-6 py-3 font-medium">Driver</th>
                <th class="px-6 py-3 font-medium">Penalty</th>
                <th class="px-6 py-3 font-medium">Series</th>
                <th class="px-6 py-3 font-medium">Submitted</th>
                <th class="px-6 py-3 font-medium">Meeting</th>
                <th class="px-6 py-3 font-medium">Status</th>
                <th class="px-6 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
              @for (request of requests(); track request._id) {
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td class="px-6 py-4">
                    <p class="font-medium text-gray-900 dark:text-gray-100">
                      {{ request.driverName }}
                    </p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      #{{ request.driverNumber ?? "-" }}
                    </p>
                  </td>
                  <td class="px-6 py-4 text-gray-700 dark:text-gray-300">
                    {{ request.penaltyName }}
                    @if (request.threshold !== null) {
                      <span class="text-sm text-gray-500 dark:text-gray-400">
                        ({{ request.threshold }} pts)
                      </span>
                    }
                  </td>
                  <td class="px-6 py-4 text-gray-700 dark:text-gray-300">
                    {{ request.seriesName }}
                  </td>
                  <td class="px-6 py-4 text-gray-500 dark:text-gray-400">
                    {{ request.createdAt | dateFormat: "PPp" }}
                  </td>
                  <td class="px-6 py-4 text-gray-500 dark:text-gray-400">
                    @if (request.selectedMeetingStartAt) {
                      {{ request.selectedMeetingStartAt | dateFormat: "PPp" }}
                    } @else {
                      {{ request.availabilityCount }} options submitted
                    }
                  </td>
                  <td class="px-6 py-4">
                    <app-badge
                      [variant]="request.status === 'open' ? 'warning' : 'info'"
                      [attr.title]="
                        request.status === 'scheduled' &&
                        request.selectedMeetingStartAt
                          ? (request.selectedMeetingStartAt | dateFormat: 'PPp')
                          : null
                      "
                    >
                      {{ request.status === "open" ? "Needs Scheduling" : "Scheduled" }}
                    </app-badge>
                  </td>
                  <td class="px-6 py-4">
                    <a
                      [routerLink]="['/race-reviews', request._id]"
                      class="text-primary-600 hover:text-primary-700 font-medium text-sm dark:text-primary-400 dark:hover:text-primary-300"
                    >
                      Open
                    </a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </app-card>
  `,
})
export class DashboardRaceReviewRequestListComponent implements OnInit {
  private readonly convex = inject(ConvexService);
  private readonly authService = inject(AuthService);

  readonly loading = signal(true);
  readonly requests = signal<PendingRaceReviewRow[]>([]);

  ngOnInit(): void {
    void this.loadRequests();
  }

  async loadRequests(): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) {
      this.requests.set([]);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    try {
      const data = await this.convex.query(
        this.convex.api.raceBanReviews.listPendingRequests,
        { userId },
      );
      this.requests.set((data ?? []) as PendingRaceReviewRow[]);
    } catch (error) {
      console.error("Failed to load race review requests:", error);
      this.requests.set([]);
    } finally {
      this.loading.set(false);
    }
  }
}
