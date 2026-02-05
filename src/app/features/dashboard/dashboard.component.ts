import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { AuthService } from "@core/services/auth.service";
import { CardComponent } from "@shared/components/card/card.component";
import { DriverDashboardComponent } from "./driver-dashboard/driver-dashboard.component";
import { StewardDashboardComponent } from "./steward-dashboard/steward-dashboard.component";
import { HeadStewardDashboardComponent } from "./head-steward-dashboard/head-steward-dashboard.component";
import { EventManagerDashboardComponent } from "./event-manager-dashboard/event-manager-dashboard.component";

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    DriverDashboardComponent,
    StewardDashboardComponent,
    HeadStewardDashboardComponent,
    EventManagerDashboardComponent,
  ],
  template: `
    @if (!authService.userRole()) {
      <app-card>
        <p class="text-gray-500 dark:text-gray-400">Loading dashboard...</p>
      </app-card>
    } @else if (authService.userRole() === "driver") {
      <app-driver-dashboard />
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
          No dashboard configuration exists for this role.
        </p>
      </app-card>
    }
  `,
})
export class DashboardComponent {
  readonly authService = inject(AuthService);
}
