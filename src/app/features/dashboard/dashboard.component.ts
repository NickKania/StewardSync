import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { AuthService } from "@core/services/auth.service";
import { CardComponent } from "@shared/components/card/card.component";
import { StewardDashboardComponent } from "./steward-dashboard/steward-dashboard.component";
import { HeadStewardDashboardComponent } from "./head-steward-dashboard/head-steward-dashboard.component";
import { EventManagerDashboardComponent } from "./event-manager-dashboard/event-manager-dashboard.component";

@Component({
  selector: "app-staff-dashboard",
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    StewardDashboardComponent,
    HeadStewardDashboardComponent,
    EventManagerDashboardComponent,
  ],
  template: `
    @if (!authService.userRole()) {
      <app-card>
        <p class="text-gray-500 dark:text-gray-400">Loading staff dashboard...</p>
      </app-card>
    } @else if (authService.userRole() === "steward") {
      <app-steward-dashboard />
    } @else if (authService.userRole() === "head_steward") {
      <app-head-steward-dashboard />
    } @else if (
      authService.userRole() === "event_manager" ||
      authService.userRole() === "league_manager"
    ) {
      <app-event-manager-dashboard />
    } @else {
      <app-card>
        <p class="text-gray-500 dark:text-gray-400">
          Staff dashboard is only available to staff roles.
        </p>
      </app-card>
    }
  `,
})
export class StaffDashboardComponent {
  readonly authService = inject(AuthService);
}
