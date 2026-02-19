import { CommonModule } from "@angular/common";
import { Component, computed, inject, OnDestroy, OnInit, signal } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { AuthService } from "@core/services/auth.service";
import { ConvexService } from "@core/services/convex.service";
import { FinalizeDashboardComponent } from "@features/finalize/finalize-dashboard/finalize-dashboard.component";
import { ReviewDashboardComponent } from "@features/reviews/review-dashboard/review-dashboard.component";
import { ReviewSearchComponent } from "@features/reviews/review-search/review-search.component";
import { Tab, TabsComponent } from "@shared/components/tabs/tabs.component";

type ReviewTabId = "queue" | "search" | "finalization";

@Component({
  selector: "app-review-workspace",
  standalone: true,
  imports: [
    CommonModule,
    TabsComponent,
    ReviewDashboardComponent,
    ReviewSearchComponent,
    FinalizeDashboardComponent,
  ],
  template: `
    <div class="space-y-6">
      <app-tabs
        [tabs]="tabs()"
        [activeTab]="activeTab()"
        (activeTabChange)="selectTab($event)"
      />

      @if (activeTab() === "queue") {
        <app-review-dashboard />
      } @else if (activeTab() === "search") {
        <app-review-search />
      } @else if (activeTab() === "finalization") {
        <app-finalize-dashboard />
      }
    </div>
  `,
})
export class ReviewWorkspaceComponent implements OnInit, OnDestroy {
  private readonly convex = inject(ConvexService);
  private readonly authService = inject(AuthService);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);

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
      },
    ];

    if (this.canSearchReviews()) {
      items.push({
        id: "search",
        label: "Review Search",
      });
    }

    if (this.canViewFinalization()) {
      items.push({
        id: "finalization",
        label: "Finalization Queue",
        badge: this.finalizeQueueCount(),
      });
    }

    return items;
  });

  ngOnInit(): void {
    const requestedTab =
      this.parseTab(this.activatedRoute.snapshot.queryParamMap.get("tab")) ??
      this.parseTab(this.activatedRoute.snapshot.data["defaultTab"]);
    const validTab = this.isTabVisible(requestedTab) ? requestedTab : null;
    this.activeTab.set(validTab ?? (this.tabs()[0]?.id as ReviewTabId));
  }

  ngOnDestroy(): void {
    this.pendingReviewQuery.unsubscribe();
    this.finalizeQueueQuery.unsubscribe();
  }

  selectTab(tabId: string): void {
    const parsedTab = this.parseTab(tabId);
    if (!this.isTabVisible(parsedTab)) {
      return;
    }

    this.activeTab.set(parsedTab);

    if (parsedTab === "queue") {
      void this.router.navigate(["/reviews"]);
      return;
    }

    void this.router.navigate(["/reviews"], {
      queryParams: { tab: parsedTab },
    });
  }

  private parseTab(value: unknown): ReviewTabId | null {
    if (value === "queue" || value === "search" || value === "finalization") {
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
    if (tabId === "queue") return true;
    if (tabId === "search") return this.canSearchReviews();
    if (tabId === "finalization") return this.canViewFinalization();
    return false;
  }
}
