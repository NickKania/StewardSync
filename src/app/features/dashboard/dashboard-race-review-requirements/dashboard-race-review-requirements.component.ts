import { Component, OnInit, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { ConvexService } from "@core/services/convex.service";
import { AuthService } from "@core/services/auth.service";
import { CardComponent } from "@shared/components/card/card.component";
import { BadgeComponent } from "@shared/components/badge/badge.component";
import { LoadingComponent } from "@shared/components/loading/loading.component";
import { DateFormatPipe } from "@shared/pipes/date-format.pipe";

interface ReviewRequirementRow {
  driverSeriesPenaltyId: string;
  reviewRequestId: string | null;
  seriesName: string;
  driverName: string;
  driverNumber: number;
  penaltyName: string;
  threshold: number;
  isServed: boolean;
  status: "missing_request" | "open" | "scheduled";
  selectedMeetingStartAt: number | null;
}

@Component({
  selector: "app-dashboard-race-review-requirements",
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
      title="Race Review Requirement Status"
      subtitle="Drivers with review-required penalties that are not fully completed"
      [noPadding]="true"
    >
      @if (loading()) {
        <div class="py-10">
          <app-loading text="Loading review requirements..." />
        </div>
      } @else if (requirements().length === 0) {
        <p class="text-center py-10 text-gray-500 dark:text-gray-400">
          All required race reviews are complete.
        </p>
      } @else {
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr class="text-left text-sm text-gray-500 dark:text-gray-400">
                <th class="px-6 py-3 font-medium">Series</th>
                <th class="px-6 py-3 font-medium">Driver</th>
                <th class="px-6 py-3 font-medium">Penalty</th>
                <th class="px-6 py-3 font-medium">Served</th>
                <th class="px-6 py-3 font-medium">Review Status</th>
                <th class="px-6 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
              @for (row of requirements(); track row.driverSeriesPenaltyId) {
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td class="px-6 py-4 text-gray-700 dark:text-gray-300">
                    {{ row.seriesName }}
                  </td>
                  <td class="px-6 py-4">
                    <p class="font-medium text-gray-900 dark:text-gray-100">
                      {{ row.driverName }}
                    </p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      #{{ row.driverNumber }}
                    </p>
                  </td>
                  <td class="px-6 py-4 text-gray-700 dark:text-gray-300">
                    {{ row.penaltyName }} ({{ row.threshold }} pts)
                  </td>
                  <td class="px-6 py-4">
                    <app-badge [variant]="row.isServed ? 'success' : 'danger'">
                      {{ row.isServed ? "Served" : "Not Served" }}
                    </app-badge>
                  </td>
                  <td class="px-6 py-4">
                    <app-badge
                      [variant]="
                        row.status === 'missing_request'
                          ? 'danger'
                          : row.status === 'scheduled'
                            ? 'info'
                            : 'warning'
                      "
                      [attr.title]="
                        row.status === 'scheduled' && row.selectedMeetingStartAt
                          ? (row.selectedMeetingStartAt | dateFormat: 'PPp')
                          : null
                      "
                    >
                      {{
                        row.status === "missing_request"
                          ? "Missing Request"
                          : row.status === "scheduled"
                            ? "Scheduled"
                            : "Review In Progress"
                      }}
                    </app-badge>
                  </td>
                  <td class="px-6 py-4">
                    @if (row.reviewRequestId) {
                      <a
                        [routerLink]="['/race-reviews', row.reviewRequestId]"
                        class="text-primary-600 hover:text-primary-700 font-medium text-sm dark:text-primary-400 dark:hover:text-primary-300"
                      >
                        Open
                      </a>
                    } @else {
                      <span class="text-sm text-danger">
                        Driver action needed
                      </span>
                    }
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
export class DashboardRaceReviewRequirementsComponent implements OnInit {
  private readonly convex = inject(ConvexService);
  private readonly authService = inject(AuthService);

  readonly loading = signal(true);
  readonly requirements = signal<ReviewRequirementRow[]>([]);

  ngOnInit(): void {
    void this.loadRequirements();
  }

  async loadRequirements(): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) {
      this.requirements.set([]);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    try {
      const data = await this.convex.query(
        this.convex.api.raceBanReviews.listOutstandingRequirements,
        { userId },
      );
      this.requirements.set((data ?? []) as ReviewRequirementRow[]);
    } catch (error) {
      console.error("Failed to load race review requirements:", error);
      this.requirements.set([]);
    } finally {
      this.loading.set(false);
    }
  }
}
