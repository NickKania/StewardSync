import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '@app/layout/header/header.component';
import { SidebarComponent } from '@app/layout/sidebar/sidebar.component';
import { AuthService } from '@core/services/auth.service';
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
    <div class="min-h-screen bg-gray-50">
      @if (authService.isAuthenticated()) {
        <app-header />
        <div class="flex">
          <app-sidebar />
          <main class="flex-1 p-6 lg:ml-64">
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

  ngOnInit(): void {
    this.authService.initialize();
  }
}
