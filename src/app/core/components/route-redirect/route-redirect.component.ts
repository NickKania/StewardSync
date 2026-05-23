import { Component, inject, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { RouteWithRedirectData } from "@core/models";

/**
 * Route Redirect Component
 *
 * A smart redirect component that handles route-based navigation transitions.
 *
 * Use cases:
 * 1. Default redirects: Routes to a default child route when accessing a parent path
 * 2. Legacy URL migration: Migrates old query-param-based URLs (e.g., ?tab=xyz) to new route-based URLs
 *
 * Example usage in routes:
 * ```ts
 * {
 *   path: "",
 *   pathMatch: "full",
 *   component: RouteRedirectComponent,
 *   data: {
 *     redirectCommands: ["/reports", "my"],
 *     legacyTabMap: {
 *       my_reports: ["/reports", "my"],
 *       finalized_reports: ["/reports", "finalized"],
 *       all_reports: ["/reports", "all"],
 *     },
 *   },
 * }
 * ```
 */
@Component({
  selector: "app-route-redirect",
  standalone: true,
  template: "",
})
export class RouteRedirectComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const data = this.route.snapshot.data as RouteWithRedirectData;
    const queryParams = { ...this.route.snapshot.queryParams };

    // Check for legacy tab parameter
    const legacyTab =
      typeof queryParams["tab"] === "string" ? queryParams["tab"] : undefined;

    // Remove the legacy tab param from query params
    delete queryParams["tab"];

    // Determine redirect target
    let targetCommands = data.redirectCommands;

    if (legacyTab && data.legacyTabMap) {
      // Look up legacy tab in the map
      const mappedCommands = data.legacyTabMap[legacyTab];
      if (mappedCommands) {
        targetCommands = mappedCommands;
      }
      // If legacy tab is not in map, fall through to default redirect
      // (silently ignores invalid legacy tabs - could optionally log this)
    }

    void this.router.navigate([...targetCommands], {
      queryParams,
      replaceUrl: true,
    });
  }
}
