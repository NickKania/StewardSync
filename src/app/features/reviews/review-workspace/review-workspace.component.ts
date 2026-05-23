import { CommonModule } from "@angular/common";
import { Component, computed, inject, OnDestroy, OnInit, signal } from "@angular/core";
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterOutlet,
} from "@angular/router";
import { AuthService } from "@core/services/auth.service";
import { ConvexService } from "@core/services/convex.service";
import { Tab, TabsComponent } from "@shared/components/tabs/tabs.component";
import { filter, Subscription } from "rxjs";

type ReviewTabId = "queue" | "my-reviews" | "search" | "finalization";

@Component({
  selector: "app-review-workspace",
  standalone: true,
  imports: [
    CommonModule,
    TabsComponent,
    RouterOutlet,
  ],
  template: `
    <div class="space-y-6">
      <app-tabs [tabs]="tabs()" [activeTab]="activeTab()" />

      <router-outlet />
    </div>
  `,
})
export class ReviewWorkspaceComponent implements OnInit, OnDestroy {
  private readonly convex = inject(ConvexService);
  private readonly authService = inject(AuthService);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly subscriptions = new Subscription();

  private readonly pendingReviewQuery = this.convex.createReactiveQuery(
    this.convex.api.reports.getPendingForReview,
    {},
  );
  private readonly finalizeQueueQuery = this.convex.createReactiveQuery(
    this.convex.api.reports.getReadyForFinalization,
    {},
  );

  private readonly pendingReviewCount = computed(
    () => this.pendingReviewQuery.data()?.length ?? 0,
  );
  private readonly finalizeQueueCount = computed(
    () => this.finalizeQueueQuery.data()?.length ?? 0,
  );

  readonly activeTab = signal<ReviewTabId>("queue");

  readonly tabs = computed<Tab[]>(() => {
    const items: Tab[] = [
      {
        id: "queue",
        label: "Review Queue",
        badge: this.pendingReviewCount(),
        routeCommands: ["/reviews", "queue"],
      },
      {
        id: "my-reviews",
        label: "My Reviews",
        routeCommands: ["/reviews", "my-reviews"],
      },
    ];

    if (this.canSearchReviews()) {
      items.push({
        id: "search",
        label: "Review Search",
        routeCommands: ["/reviews", "search"],
      });
    }

    if (this.canViewFinalization()) {
      items.push({
        id: "finalization",
        label: "Finalization Queue",
        badge: this.finalizeQueueCount(),
        routeCommands: ["/reviews", "finalization"],
      });
    }

    return items;
  });

  ngOnInit(): void {
    this.syncActiveTab();
    this.subscriptions.add(
      this.router.events
        .pipe(filter((event) => event instanceof NavigationEnd))
        .subscribe(() => this.syncActiveTab()),
    );
  }

  ngOnDestroy(): void {
    this.pendingReviewQuery.unsubscribe();
    this.finalizeQueueQuery.unsubscribe();
    this.subscriptions.unsubscribe();
  }

  private parseTab(value: unknown): ReviewTabId | null {
    if (
      value === "queue" ||
      value === "my-reviews" ||
      value === "search" ||
      value === "finalization"
    ) {
      return value;
    }
    return null;
  }

  private canSearchReviews(): boolean {
    return this.authService.hasRole("head_steward", "league_manager");
  }

  private canViewFinalization(): boolean {
    return this.authService.hasRole("head_steward", "league_manager");
  }

  private isTabVisible(tabId: ReviewTabId | null): tabId is ReviewTabId {
    if (tabId === "queue" || tabId === "my-reviews") return true;
    if (tabId === "search") return this.canSearchReviews();
    if (tabId === "finalization") return this.canViewFinalization();
    return false;
  }

  private syncActiveTab(): void {
    const childPath = this.activatedRoute.firstChild?.routeConfig?.path;
    const requestedTab = this.parseTab(childPath);
    const validTab = this.isTabVisible(requestedTab) ? requestedTab : null;
    const fallbackTab = this.tabs()[0]?.id as ReviewTabId | undefined;

    // If the requested tab is valid (user has access), use it
    if (validTab) {
      this.activeTab.set(validTab);
      return;
    }

    // If no valid tab but we have a fallback, use it without redirecting
    // This ensures URL-based navigation always takes precedence
    if (fallbackTab) {
      this.activeTab.set(fallbackTab);
    }
  }
}
