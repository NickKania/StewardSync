import {
  Component,
  effect,
  inject,
  computed,
  OnDestroy,
  OnInit,
  signal,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  Router,
  RouterLink,
  RouterLinkActive,
  NavigationStart,
} from "@angular/router";
import { AuthService } from "@core/services/auth.service";
import { RoleName } from "@core/models";
import { DRIVER_DIRECTORY_ROLES, FINALIZATION_ROLES, REVIEW_ROLES } from "@core/models/route-roles";
import { IconComponent, IconName } from "@shared/components/icon/icon.component";
import { SidebarStateService } from "@core/services/sidebar-state.service";
import { ConvexService } from "@core/services/convex.service";
import { Subscription } from "rxjs";
import { ChangelogFlyoutComponent } from "@shared/components/changelog-flyout/changelog-flyout.component";
import { BadgeComponent } from "@shared/components/badge/badge.component";

interface NavItem {
  label: string;
  path: string;
  icon: IconName;
  roles?: readonly RoleName[];
  exact?: boolean;
}

interface ChangelogRelease {
  version: string;
  date: string;
}

@Component({
  selector: "app-sidebar",
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    IconComponent,
    ChangelogFlyoutComponent,
    BadgeComponent,
  ],
  template: `
    <!-- Mobile overlay -->
    @if (sidebarStateService.isMobileOpen()) {
      <div
        class="fixed inset-0 bg-black/50 z-30 lg:hidden dark:bg-black/70 pointer-events-auto"
        (click)="sidebarStateService.closeMobile()"
      ></div>
    }

    <!-- Sidebar -->
    <aside
      class="fixed top-16 left-0 bottom-0 bg-white border-r border-gray-200 z-40 transition-all duration-200 ease-in-out dark:bg-gray-900 dark:border-gray-700 overflow-hidden pointer-events-none"
      [ngClass]="sidebarClasses()"
    >
      <nav class="p-4 space-y-1">
        @for (item of navItems; track item.path) {
          @if (!item.roles || hasAnyRole(item.roles)) {
            <a
              [routerLink]="item.path"
              routerLinkActive="bg-primary-50 text-primary-700 border-primary-500 dark:bg-primary-900/30 dark:text-primary-200 dark:border-primary-400"
              [routerLinkActiveOptions]="{ exact: item.exact ?? true }"
              class="flex w-full items-center gap-3 px-3 py-2 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors border-l-2 border-transparent dark:text-gray-200 dark:hover:bg-gray-800"
              [class.justify-center]="!isTextVisible()"
            >
              <app-icon [name]="item.icon" class="shrink-0" />
              <span
                class="flex-1 font-medium"
                [class.opacity-0]="!isTextVisible()"
                [class.opacity-100]="isTextVisible()"
                [class.w-0]="!isTextVisible()"
                [class.overflow-hidden]="!isTextVisible()"
                [class.whitespace-nowrap]="!isTextVisible()"
                >{{ item.label }}</span
              >
              @if (item.path === "/reviews" && isTextVisible()) {
                <div class="flex items-center gap-1">
                  <app-badge variant="danger" size="sm">
                    {{ pendingReviewCount() }}
                  </app-badge>
                  @if (canViewFinalization()) {
                    <app-badge variant="info" size="sm">
                      {{ finalizeQueueCount() }}
                    </app-badge>
                  }
                </div>
              }
            </a>
          }
        }
      </nav>

      <!-- Bottom section -->
      @if (isTextVisible()) {
        <div
          class="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700"
        >
          <div class="text-xs text-gray-500 dark:text-gray-400">
            <a
              href="#"
              class="underline decoration-dotted underline-offset-2 hover:text-primary-600 dark:hover:text-primary-300 transition-colors"
              (click)="openChangelog(); $event.preventDefault()"
            >
              StewardSync v{{ appVersion() }}
            </a>
            <p class="mt-1">Racing Incident Review System</p>
          </div>
        </div>
      }
    </aside>

    <app-changelog-flyout
      [isOpen]="isChangelogOpen()"
      (closeRequested)="closeChangelog()"
    />
  `,
})
export class SidebarComponent implements OnDestroy, OnInit {
  private authService = inject(AuthService);
  private convex = inject(ConvexService);
  private router = inject(Router);
  readonly sidebarStateService = inject(SidebarStateService);

  private routerSubscription: Subscription;

  readonly isTextVisible = computed(
    () =>
      this.sidebarStateService.isMobileOpen() ||
      !this.sidebarStateService.isEffectivelyCollapsed(),
  );

  readonly sidebarClasses = computed(() => {
    const isMobileOpen = this.sidebarStateService.isMobileOpen();
    const isCollapsed = this.sidebarStateService.isEffectivelyCollapsed();

    return {
      "w-0": !isMobileOpen,
      "w-64": isMobileOpen,
      "lg:w-0": isCollapsed,
      "lg:w-64": !isCollapsed,
      "-translate-x-full": !isMobileOpen,
      "translate-x-0": isMobileOpen,
      "lg:-translate-x-full": isCollapsed,
      "lg:translate-x-0": !isCollapsed,
      "pointer-events-auto": isMobileOpen,
      "lg:pointer-events-auto": !isCollapsed,
      "border-r-0": !isMobileOpen,
      "lg:border-r-0": isCollapsed,
    };
  });

  constructor() {
    this.routerSubscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.sidebarStateService.closeMobile();
      }
    });

    effect((onCleanup) => {
      const userId = this.authService.getUserId();
      const role = this.authService.userRole();
      this.pendingCount.set(0);
      this.finalizeCount.set(0);
      if (!userId || !role) return;

      const unsubscribes: (() => void)[] = [];
      onCleanup(() => unsubscribes.forEach((unsubscribe) => unsubscribe()));

      if (this.authService.hasRole(...REVIEW_ROLES)) {
        const query = this.convex.createReactiveQuery(
          this.convex.api.reports.getPendingForReview,
          {},
          (reports) => this.pendingCount.set(reports.length),
        );
        unsubscribes.push(query.unsubscribe);
      }

      if (this.canViewFinalization()) {
        const query = this.convex.createReactiveQuery(
          this.convex.api.reports.getReadyForFinalization,
          {},
          (reports) => this.finalizeCount.set(reports.length),
        );
        unsubscribes.push(query.unsubscribe);
      }
    }, { allowSignalWrites: true });
  }

  private readonly pendingCount = signal(0);
  private readonly finalizeCount = signal(0);
  readonly pendingReviewCount = this.pendingCount.asReadonly();
  readonly finalizeQueueCount = this.finalizeCount.asReadonly();
  readonly isChangelogOpen = signal(false);
  readonly appVersion = signal("1.0.0");

  navItems: NavItem[] = [
    {
      label: "Driver Dashboard",
      path: "/driver-dashboard",
      icon: "dashboard",
    },
    {
      label: "Staff Dashboard",
      path: "/staff-dashboard",
      roles: ["steward", "head_steward", "event_manager", "league_manager"],
      icon: "dashboard",
    },
    {
      label: "Reports",
      path: "/reports",
      exact: false,
      icon: "reports",
    },
    {
      label: "Statistics",
      path: "/statistics",
      exact: false,
      icon: "statistics",
      roles: ["steward", "head_steward", "event_manager", "league_manager"],
    },
    {
      label: "Review",
      path: "/reviews",
      exact: false,
      icon: "review",
      roles: REVIEW_ROLES,
    },
    {
      label: "Drivers",
      path: "/drivers",
      icon: "drivers",
      roles: DRIVER_DIRECTORY_ROLES,
    },
    {
      label: "Events",
      path: "/events",
      icon: "events",
    },
    {
      label: "Series Management",
      path: "/admin/series",
      icon: "series",
      roles: ["event_manager", "league_manager"],
    },
    {
      label: "User Management",
      path: "/admin/users",
      icon: "settings",
      roles: ["league_manager"],
    },
  ];

  ngOnDestroy(): void {
    this.routerSubscription.unsubscribe();
  }

  ngOnInit(): void {
    void this.loadLatestVersion();
  }

  hasAnyRole(roles: readonly RoleName[]): boolean {
    return this.authService.hasRole(...roles);
  }

  canViewFinalization(): boolean {
    return this.authService.hasRole(...FINALIZATION_ROLES);
  }

  openChangelog(): void {
    this.isChangelogOpen.set(true);
  }

  closeChangelog(): void {
    this.isChangelogOpen.set(false);
  }

  private async loadLatestVersion(): Promise<void> {
    try {
      const changelogUrl = new URL(
        "assets/changelog.json",
        document.baseURI,
      ).toString();
      const response = await fetch(changelogUrl);
      if (!response.ok) {
        return;
      }

      const payload: unknown = await response.json();
      const releases = this.parseReleases(payload);
      if (!releases || releases.length === 0) {
        return;
      }

      const latestRelease = [...releases].sort((a, b) =>
        b.date.localeCompare(a.date),
      )[0];
      if (latestRelease) {
        this.appVersion.set(latestRelease.version);
      }
    } catch (error) {
      console.error(
        "Failed to load sidebar app version from changelog:",
        error,
      );
    }
  }

  private parseReleases(value: unknown): ChangelogRelease[] | null {
    if (!value || typeof value !== "object" || !("releases" in value)) {
      return null;
    }

    const rawReleases = (value as { releases: unknown }).releases;
    if (!Array.isArray(rawReleases)) {
      return null;
    }

    const releases: ChangelogRelease[] = [];
    for (const release of rawReleases) {
      if (!release || typeof release !== "object") {
        return null;
      }

      const entry = release as {
        version?: unknown;
        date?: unknown;
      };

      if (typeof entry.version !== "string" || typeof entry.date !== "string") {
        return null;
      }

      releases.push({ version: entry.version, date: entry.date });
    }

    return releases;
  }
}
