import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { DashboardSeriesPenaltyListComponent } from "../dashboard-series-penalty-list/dashboard-series-penalty-list.component";
import { DashboardRaceReviewRequirementsComponent } from "../dashboard-race-review-requirements/dashboard-race-review-requirements.component";
import { DashboardRaceReviewRequestListComponent } from "../dashboard-race-review-request-list/dashboard-race-review-request-list.component";

@Component({
  selector: "app-event-manager-dashboard",
  standalone: true,
  imports: [
    CommonModule,
    DashboardSeriesPenaltyListComponent,
    DashboardRaceReviewRequirementsComponent,
    DashboardRaceReviewRequestListComponent,
  ],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Event Manager Dashboard
        </h1>
        <p class="text-gray-500 mt-1 dark:text-gray-400">
          Track series penalty assignment and serving status across events.
        </p>
      </div>

      <app-dashboard-race-review-request-list />

      <app-dashboard-race-review-requirements />

      <app-dashboard-series-penalty-list />
    </div>
  `,
})
export class EventManagerDashboardComponent {}
