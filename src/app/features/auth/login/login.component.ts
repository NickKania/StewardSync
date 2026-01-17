import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { ThemeService } from '@core/services/theme.service';
import { ButtonComponent } from '@shared/components/button/button.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ButtonComponent, RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-gray-900 p-4">
      <button
        class="fixed top-4 right-4 p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
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
      <div class="w-full max-w-md">
        <div class="bg-white rounded-2xl shadow-2xl p-8 dark:bg-gray-900">
          <!-- Logo and branding -->
          <div class="text-center mb-8">
            <div class="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
              </svg>
            </div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">StewardSync</h1>
            <p class="text-gray-500 mt-2 dark:text-gray-400">Racing Incident Review System</p>
          </div>

          <!-- Login options -->
          <div class="space-y-4">
            <button
              class="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
              [disabled]="isLoading"
              (click)="loginDemo()"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              Continue with Discord
            </button>
          </div>

          <!-- Footer -->
          <p class="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
            By signing in, you agree to our terms of service and privacy policy.
          </p>

          <!-- Dev Mode Link -->
          <div class="mt-4 text-center">
            <a routerLink="/dev-login"
               class="text-xs text-gray-400 hover:text-primary-600 transition-colors dark:text-gray-500 dark:hover:text-primary-300">
              Developer Mode
            </a>
          </div>
        </div>

        <!-- Info cards -->
        <div class="mt-8 grid grid-cols-2 gap-4">
          <div class="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-white">
            <h3 class="font-semibold mb-1">File Reports</h3>
            <p class="text-sm text-white/70">Submit incident reports for review</p>
          </div>
          <div class="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-white">
            <h3 class="font-semibold mb-1">Track Progress</h3>
            <p class="text-sm text-white/70">Follow your reports in real-time</p>
          </div>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  public readonly themeService = inject(ThemeService);

  isLoading = false;

  async loginWithGoogle(): Promise<void> {
    this.isLoading = true;
    try {
      await this.authService.loginWithGoogle();
    } catch (error) {
      this.toastService.error('Failed to sign in with Google');
      console.error(error);
    } finally {
      this.isLoading = false;
    }
  }

  async loginDemo(): Promise<void> {
    this.isLoading = true;
    try {
      await this.authService.mockLogin();
      this.toastService.success('Signed in as demo user');
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to sign in';
      this.toastService.error(errorMessage);
      console.error('Login error:', error);
    } finally {
      this.isLoading = false;
    }
  }
}
