import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { ButtonComponent } from "@shared/components/button/button.component";
import { DashboardReportListComponent } from "../dashboard-report-list/dashboard-report-list.component";
import { DashboardSeriesPenaltyListComponent } from "../dashboard-series-penalty-list/dashboard-series-penalty-list.component";
import { DashboardRaceReviewRequestListComponent } from "../dashboard-race-review-request-list/dashboard-race-review-request-list.component";
import { DashboardRaceReviewRequirementsComponent } from "../dashboard-race-review-requirements/dashboard-race-review-requirements.component";
import { EventStatusCardComponent } from "../event-status-card/event-status-card.component";

@Component({
  selector: "app-head-steward-dashboard",
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ButtonComponent,
    DashboardReportListComponent,
    DashboardSeriesPenaltyListComponent,
    DashboardRaceReviewRequestListComponent,
    DashboardRaceReviewRequirementsComponent,
    EventStatusCardComponent,
  ],
  template: `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Head Steward Dashboard
          </h1>
          <p class="text-gray-500 mt-1 dark:text-gray-400">
            Manage active reviews, finalization queue, and series penalties.
          </p>
        </div>
        <a [routerLink]="['/reviews', 'search']">
          <app-button variant="secondary">Search Reviews</app-button>
        </a>
      </div>

      <div class="space-y-4">
        <app-event-status-card />
      </div>

      <app-dashboard-report-list
        title="Reports List (Normal Reviews)"
        subtitle="Pending reports ready for steward review"
        emptyText="No reports are waiting for review"
        status="pending"
        actionMode="review"
        [limit]="15"
      />

      <app-dashboard-report-list
        title="Reports List (Ready for Finalization)"
        subtitle="Reviewed reports awaiting final decision"
        emptyText="No reports are ready for finalization"
        status="reviewed"
        actionMode="finalize"
        [limit]="15"
      />

      <app-dashboard-race-review-request-list />

      <app-dashboard-race-review-requirements />

      <app-dashboard-series-penalty-list />
    </div>
  `,
})
export class HeadStewardDashboardComponent {}
