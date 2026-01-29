import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { HasRoleDirective } from '@shared/directives/has-role.directive';
import { SidebarStateService } from '@core/services/sidebar-state.service';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  roles?: string[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, HasRoleDirective],
  template: `
    <!-- Mobile overlay -->
    @if (sidebarStateService.isMobileOpen()) {
      <div
        class="fixed inset-0 bg-black/50 z-30 lg:hidden dark:bg-black/70"
        (click)="sidebarStateService.closeMobile()"
      ></div>
    }

    <!-- Sidebar -->
    <aside
      class="fixed top-16 left-0 bottom-0 bg-white border-r border-gray-200 z-20 transition-all duration-200 ease-in-out dark:bg-gray-900 dark:border-gray-700 overflow-hidden"
      [class.w-0]="!sidebarStateService.isMobileOpen()"
      [class.w-64]="sidebarStateService.isMobileOpen()"
      [class.lg:w-0]="sidebarStateService.isEffectivelyCollapsed()"
      [class.lg:w-64]="!sidebarStateService.isEffectivelyCollapsed()"
      [class.-translate-x-full]="!sidebarStateService.isMobileOpen()"
      [class.translate-x-0]="sidebarStateService.isMobileOpen()"
      [class.lg:-translate-x-full]="sidebarStateService.isEffectivelyCollapsed()"
      [class.lg:translate-x-0]="!sidebarStateService.isEffectivelyCollapsed()"
    >
      <nav class="p-4 space-y-1">
        @for (item of navItems; track item.path) {
          @if (!item.roles || hasAnyRole(item.roles)) {
            <a
              [routerLink]="item.path"
              routerLinkActive="bg-primary-50 text-primary-700 border-primary-500 dark:bg-primary-900/30 dark:text-primary-200 dark:border-primary-400"
              [routerLinkActiveOptions]="{ exact: item.path === '/' }"
              class="flex items-center gap-3 px-3 py-2 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors border-l-2 border-transparent dark:text-gray-200 dark:hover:bg-gray-800"
              [class.justify-center]="sidebarStateService.isEffectivelyCollapsed()"
              (click)="sidebarStateService.closeMobile()"
            >
              <span [innerHTML]="item.icon" class="flex-shrink-0"></span>
              @if (!sidebarStateService.isEffectivelyCollapsed()) {
                <span class="font-medium">{{ item.label }}</span>
              }
            </a>
          }
        }
      </nav>

      <!-- Bottom section -->
      @if (!sidebarStateService.isEffectivelyCollapsed()) {
        <div class="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700">
          <div class="text-xs text-gray-500 dark:text-gray-400">
            <p>StewardSync v0.1.0</p>
            <p class="mt-1">Racing Incident Review System</p>
          </div>
        </div>
      }
    </aside>
  `
})
export class SidebarComponent {
  private authService = inject(AuthService);
  readonly sidebarStateService = inject(SidebarStateService);

  navItems: NavItem[] = [
    {
      label: 'Dashboard',
      path: '/',
      icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>'
    },
    {
      label: 'Reports',
      path: '/reports',
      icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>'
    },
    {
      label: 'Statistics',
      path: '/statistics',
      icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>',
      roles: ['steward', 'head_steward', 'event_manager', 'league_manager']
    },
    {
      label: 'Review Queue',
      path: '/reviews',
      icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>',
      roles: ['steward', 'head_steward', 'event_manager', 'league_manager']
    },
    {
      label: 'Finalization',
      path: '/finalize',
      icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
      roles: ['head_steward', 'event_manager', 'league_manager']
    },
    {
      label: 'Drivers',
      path: '/drivers',
      icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>',
      roles: ['head_steward', 'event_manager', 'league_manager']
    },
    {
      label: 'Events',
      path: '/events',
      icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>'
    },
    {
      label: 'Series Management',
      path: '/admin/series',
      icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>',
      roles: ['event_manager', 'league_manager']
    },
    {
      label: 'User Management',
      path: '/admin/users',
      icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>',
      roles: ['league_manager']
    }
  ];

  hasAnyRole(roles: string[]): boolean {
    return this.authService.hasRole(...(roles as any[]));
  }
}
