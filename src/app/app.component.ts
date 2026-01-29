import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '@app/layout/header/header.component';
import { SidebarComponent } from '@app/layout/sidebar/sidebar.component';
import { AuthService } from '@core/services/auth.service';
import { ThemeService } from '@core/services/theme.service';
import { SidebarStateService } from '@core/services/sidebar-state.service';
import { ToastComponent } from '@shared/components/toast/toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    HeaderComponent,
    SidebarComponent,
    ToastComponent
  ],
  template: `
    <div class="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      @if (authService.isAuthenticated()) {
        <app-header />
        <div class="flex mt-16">
          <app-sidebar />
          <main class="flex-1 p-6 transition-all duration-200 ease-in-out" [class.lg:ml-0]="sidebarStateService.isEffectivelyCollapsed()" [class.lg:ml-64]="!sidebarStateService.isEffectivelyCollapsed()">
            <router-outlet />
          </main>
        </div>
      } @else {
        <router-outlet />
      }
      <app-toast />
    </div>
  `
})
export class AppComponent implements OnInit {
  authService = inject(AuthService);
  themeService = inject(ThemeService);
  readonly sidebarStateService = inject(SidebarStateService);

  ngOnInit(): void {
    this.themeService.initialize();
    this.authService.initialize();
  }
}
