import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { ButtonComponent } from "@shared/components/button/button.component";
import { DashboardReportListComponent } from "../dashboard-report-list/dashboard-report-list.component";
import { DashboardReportStatisticsComponent } from "../dashboard-report-statistics/dashboard-report-statistics.component";

@Component({
  selector: "app-steward-dashboard",
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ButtonComponent,
    DashboardReportStatisticsComponent,
    DashboardReportListComponent,
  ],
  template: `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Steward Dashboard
          </h1>
          <p class="text-gray-500 mt-1 dark:text-gray-400">
            Monitor incident volume and review the pending queue.
          </p>
        </div>
        <a [routerLink]="['/reviews', 'queue']">
          <app-button variant="secondary">Open Review Queue</app-button>
        </a>
      </div>

      <app-dashboard-report-statistics />

      <app-dashboard-report-list
        title="Reports Awaiting Review"
        subtitle="Pending reports that need steward review"
        emptyText="No pending reports right now"
        status="pending"
        actionMode="review"
        [limit]="15"
      />
    </div>
  `,
})
export class StewardDashboardComponent {}
