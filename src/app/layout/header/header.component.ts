import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-40">
      <div class="flex items-center justify-between h-full px-4 lg:px-6">
        <!-- Logo and brand -->
        <div class="flex items-center gap-4">
          <button
            class="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
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
            <span class="text-xl font-bold text-gray-900 hidden sm:block">StewardSync</span>
          </a>
        </div>

        <!-- User menu -->
        <div class="flex items-center gap-4">
          @if (authService.user(); as user) {
            <div class="flex items-center gap-3">
              <div class="hidden md:block text-right">
                <p class="text-sm font-medium text-gray-900">{{ user.name }}</p>
                <p class="text-xs text-gray-500 capitalize">{{ user.role?.displayName }}</p>
              </div>
              <div class="relative">
                <button
                  class="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 transition-colors"
                  (click)="toggleUserMenu()"
                >
                  @if (user.avatarUrl) {
                    <img
                      [src]="user.avatarUrl"
                      [alt]="user.name"
                      class="w-8 h-8 rounded-full"
                    />
                  } @else {
                    <div class="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                      <span class="text-sm font-medium text-primary-700">
                        {{ user.name.charAt(0).toUpperCase() }}
                      </span>
                    </div>
                  }
                </button>

                @if (showUserMenu) {
                  <div class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    <div class="px-4 py-2 border-b border-gray-100 md:hidden">
                      <p class="text-sm font-medium text-gray-900">{{ user.name }}</p>
                      <p class="text-xs text-gray-500 capitalize">{{ user.role?.displayName }}</p>
                    </div>
                    <button
                      class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
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
