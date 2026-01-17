import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ThemeService } from '@core/services/theme.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-40 dark:bg-gray-900 dark:border-gray-700">
      <div class="flex items-center justify-between h-full px-4 lg:px-6">
        <!-- Logo and brand -->
        <div class="flex items-center gap-4">
          <button
            class="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800"
            (click)="toggleMobileMenu()"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>
          </button>
          <a routerLink="/" class="flex items-center gap-2">
            <div class="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
              </svg>
            </div>
            <span class="text-xl font-bold text-gray-900 hidden sm:block dark:text-gray-100">StewardSync</span>
          </a>
        </div>

        <!-- User menu -->
        <div class="flex items-center gap-4">
          <button
            class="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800"
            (click)="themeService.toggleTheme()"
            [attr.aria-label]="themeService.isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            @if (themeService.isDark()) {
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M12 5a7 7 0 100 14 7 7 0 000-14z"></path>
              </svg>
            } @else {
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z"></path>
              </svg>
            }
          </button>
          @if (authService.user(); as user) {
            <div class="flex items-center gap-3">
              <div class="hidden md:block text-right">
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ user.name }}</p>
                <p class="text-xs text-gray-500 capitalize dark:text-gray-400">{{ user.role?.displayName }}</p>
              </div>
              <div class="relative">
                <button
                  class="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 transition-colors dark:hover:bg-gray-800"
                  (click)="toggleUserMenu()"
                >
                  @if (user.avatarUrl) {
                    <img
                      [src]="user.avatarUrl"
                      [alt]="user.name"
                      class="w-8 h-8 rounded-full"
                    />
                  } @else {
                    <div class="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center dark:bg-primary-900/40">
                      <span class="text-sm font-medium text-primary-700 dark:text-primary-200">
                        {{ user.name.charAt(0).toUpperCase() }}
                      </span>
                    </div>
                  }
                </button>

                @if (showUserMenu) {
                  <div class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 dark:bg-gray-800 dark:border-gray-700">
                    <div class="px-4 py-2 border-b border-gray-100 md:hidden dark:border-gray-700">
                      <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ user.name }}</p>
                      <p class="text-xs text-gray-500 capitalize dark:text-gray-400">{{ user.role?.displayName }}</p>
                    </div>
                    <button
                      class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                      (click)="logout()"
                    >
                      Sign out
                    </button>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </header>
  `
})
export class HeaderComponent {
  authService = inject(AuthService);
  themeService = inject(ThemeService);

  showUserMenu = false;
  showMobileMenu = false;

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  toggleMobileMenu(): void {
    this.showMobileMenu = !this.showMobileMenu;
    // Emit event for sidebar to listen to
    window.dispatchEvent(new CustomEvent('toggle-mobile-menu'));
  }

  logout(): void {
    this.showUserMenu = false;
    this.authService.logout();
  }
}
