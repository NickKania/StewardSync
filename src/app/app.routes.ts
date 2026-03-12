import { Routes } from "@angular/router";
import { authGuard } from "@core/guards/auth.guard";
import { roleGuard } from "@core/guards/role.guard";
import { appRuntimeConfig } from "@core/config/runtime-config";
import { RouteRedirectComponent } from "@core/components/route-redirect/route-redirect.component";

export const routes: Routes = [
  {
    path: "",
    pathMatch: "full",
    redirectTo: "driver-dashboard",
  },
  {
    path: "driver-dashboard",
    canActivate: [authGuard],
    loadComponent: () =>
      import("@features/dashboard/driver-dashboard/driver-dashboard.component").then(
        (m) => m.DriverDashboardComponent,
      ),
  },
  {
    path: "staff-dashboard",
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ["steward", "head_steward", "event_manager", "league_manager"],
    },
    loadComponent: () =>
      import("@features/dashboard/dashboard.component").then(
        (m) => m.StaffDashboardComponent,
      ),
  },
  {
    path: "login",
    loadComponent: () =>
      import("@features/auth/login/login.component").then(
        (m) => m.LoginComponent,
      ),
  },
  ...(appRuntimeConfig.enableDevLogin
    ? [
        {
          path: "dev-login",
          loadComponent: () =>
            import("@features/auth/dev-login/dev-login.component").then(
              (m) => m.DevLoginComponent,
            ),
        },
      ]
    : []),
  {
    path: "auth/callback",
    loadComponent: () =>
      import("@features/auth/callback/callback.component").then(
        (m) => m.CallbackComponent,
      ),
  },
  {
    path: "reports",
    canActivate: [authGuard],
    children: [
      {
        path: "",
        pathMatch: "full",
        component: RouteRedirectComponent,
        data: {
          redirectCommands: ["/reports", "my"],
          legacyTabMap: {
            my_reports: ["/reports", "my"],
            finalized_reports: ["/reports", "finalized"],
            all_reports: ["/reports", "all"],
          },
        },
      },
      {
        path: "my",
        loadComponent: () =>
          import("@features/reports/report-list/report-list.component").then(
            (m) => m.ReportListComponent,
          ),
        data: { tabId: "my_reports" },
      },
      {
        path: "finalized",
        loadComponent: () =>
          import("@features/reports/report-list/report-list.component").then(
            (m) => m.ReportListComponent,
          ),
        data: { tabId: "finalized_reports" },
      },
      {
        path: "all",
        loadComponent: () =>
          import("@features/reports/report-list/report-list.component").then(
            (m) => m.ReportListComponent,
          ),
        data: { tabId: "all_reports" },
      },
      {
        path: "new",
        loadComponent: () =>
          import("@features/reports/report-form/report-form.component").then(
            (m) => m.ReportFormComponent,
          ),
      },
      {
        path: ":id/edit",
        loadComponent: () =>
          import("@features/reports/report-form/report-form.component").then(
            (m) => m.ReportFormComponent,
          ),
      },
      {
        path: ":id",
        loadComponent: () =>
          import("@features/reports/report-detail/report-detail.component").then(
            (m) => m.ReportDetailComponent,
          ),
      },
    ],
  },
  {
    path: "reviews",
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ["steward", "head_steward", "league_manager"],
    },
    children: [
      {
        path: "",
        pathMatch: "full",
        component: RouteRedirectComponent,
        data: {
          redirectCommands: ["/reviews", "queue"],
          legacyTabMap: {
            queue: ["/reviews", "queue"],
            "my-reviews": ["/reviews", "my-reviews"],
            search: ["/reviews", "search"],
            finalization: ["/reviews", "finalization"],
          },
        },
      },
      {
        path: "steward-incident",
        loadComponent: () =>
          import("@features/reviews/steward-incident-form/steward-incident-form.component").then(
            (m) => m.StewardIncidentFormComponent,
          ),
      },
      {
        path: "",
        loadComponent: () =>
          import("@features/reviews/review-workspace/review-workspace.component").then(
            (m) => m.ReviewWorkspaceComponent,
          ),
        children: [
          {
            path: "queue",
            loadComponent: () =>
              import("@features/reviews/review-dashboard/review-dashboard.component").then(
                (m) => m.ReviewDashboardComponent,
              ),
          },
          {
            path: "my-reviews",
            loadComponent: () =>
              import("@features/reviews/my-reviews/my-reviews.component").then(
                (m) => m.MyReviewsComponent,
              ),
          },
          {
            path: "search",
            canActivate: [roleGuard],
            data: {
              roles: ["head_steward", "league_manager"],
              fallbackCommands: ["/reviews", "queue"],
            },
            loadComponent: () =>
              import("@features/reviews/review-search/review-search.component").then(
                (m) => m.ReviewSearchComponent,
              ),
          },
          {
            path: "finalization",
            canActivate: [roleGuard],
            data: {
              roles: ["head_steward", "league_manager"],
              fallbackCommands: ["/reviews", "queue"],
            },
            loadComponent: () =>
              import("@features/finalize/finalize-dashboard/finalize-dashboard.component").then(
                (m) => m.FinalizeDashboardComponent,
              ),
          },
        ],
      },
      {
        path: ":reportId",
        loadComponent: () =>
          import("@features/reviews/review-form/review-form.component").then(
            (m) => m.ReviewFormComponent,
          ),
      },
    ],
  },
  {
    path: "finalize",
    canActivate: [authGuard, roleGuard],
    data: { roles: ["head_steward", "league_manager"] },
    children: [
      {
        path: "",
        pathMatch: "full",
        component: RouteRedirectComponent,
        data: {
          redirectCommands: ["/reviews", "finalization"],
        },
      },
      {
        path: ":reportId",
        loadComponent: () =>
          import("@features/finalize/finalize-form/finalize-form.component").then(
            (m) => m.FinalizeFormComponent,
          ),
      },
    ],
  },
  {
    path: "drivers",
    canActivate: [authGuard, roleGuard],
    data: { roles: ["steward", "head_steward", "event_manager", "league_manager"] },
    children: [
      {
        path: "",
        loadComponent: () =>
          import("@features/drivers/driver-list/driver-list.component").then(
            (m) => m.DriverListComponent,
          ),
      },
      {
        path: "user/:userId",
        loadComponent: () =>
          import(
            "@features/drivers/driver-user-detail/driver-user-detail.component"
          ).then((m) => m.DriverUserDetailComponent),
      },
      {
        path: ":id",
        loadComponent: () =>
          import(
            "@features/drivers/driver-user-detail/driver-user-detail.component"
          ).then((m) => m.DriverUserDetailComponent),
      },
    ],
  },
  {
    path: "events",
    canActivate: [authGuard],
    data: { roles: ["event_manager", "league_manager"] },
    children: [
      {
        path: "",
        loadComponent: () =>
          import("@features/events/event-list/event-list.component").then(
            (m) => m.EventListComponent,
          ),
      },
      {
        path: ":id",
        loadComponent: () =>
          import("@features/events/event-detail/event-detail.component").then(
            (m) => m.EventDetailComponent,
          ),
      },
    ],
  },
  {
    path: "statistics",
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ["steward", "head_steward", "event_manager", "league_manager"],
    },
    children: [
      {
        path: "",
        pathMatch: "full",
        component: RouteRedirectComponent,
        data: {
          redirectCommands: ["/statistics", "event-rundown"],
          legacyTabMap: {
            event_rundown: ["/statistics", "event-rundown"],
            series_overview: ["/statistics", "series-overview"],
            time_penalty_summary: ["/statistics", "time-penalty-summary"],
          },
        },
      },
      {
        path: "event-rundown",
        loadComponent: () =>
          import("@features/statistics/statistics-dashboard/statistics-dashboard.component").then(
            (m) => m.StatisticsDashboardComponent,
          ),
        data: { tabId: "event_rundown" },
      },
      {
        path: "series-overview",
        canActivate: [roleGuard],
        data: {
          roles: ["head_steward", "event_manager", "league_manager"],
          fallbackCommands: ["/statistics", "event-rundown"],
          tabId: "series_overview",
        },
        loadComponent: () =>
          import("@features/statistics/statistics-dashboard/statistics-dashboard.component").then(
            (m) => m.StatisticsDashboardComponent,
          ),
      },
      {
        path: "time-penalty-summary",
        loadComponent: () =>
          import("@features/statistics/statistics-dashboard/statistics-dashboard.component").then(
            (m) => m.StatisticsDashboardComponent,
          ),
        data: { tabId: "time_penalty_summary" },
      },
    ],
  },
  {
    path: "admin",
    canActivate: [authGuard, roleGuard],
    data: { roles: ["event_manager", "league_manager"] },
    children: [
      {
        path: "users",
        canActivate: [roleGuard],
        data: { roles: ["league_manager"] },
        loadComponent: () =>
          import("@features/admin/user-management/user-management.component").then(
            (m) => m.UserManagementComponent,
          ),
      },
      {
        path: "series",
        loadComponent: () =>
          import("@features/admin/series-management/series-management.component").then(
            (m) => m.SeriesManagementComponent,
          ),
      },
    ],
  },
  {
    path: "race-reviews",
    canActivate: [authGuard],
    children: [
      {
        path: "request/:driverSeriesPenaltyId",
        canActivate: [roleGuard],
        data: { roles: ["driver"] },
        loadComponent: () =>
          import(
            "@features/race-ban-reviews/review-request-form/review-request-form.component"
          ).then((m) => m.ReviewRequestFormComponent),
      },
      {
        path: ":id",
        canActivate: [roleGuard],
        data: { roles: ["head_steward", "event_manager", "league_manager"] },
        loadComponent: () =>
          import(
            "@features/race-ban-reviews/race-review-management/race-review-management.component"
          ).then((m) => m.RaceReviewManagementComponent),
      },
    ],
  },
  {
    path: "**",
    redirectTo: "driver-dashboard",
  },
];
