import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { ButtonComponent } from '@shared/components/button/button.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-gray-900 p-4">
      <div class="w-full max-w-md">
        <div class="bg-white rounded-2xl shadow-2xl p-8">
          <!-- Logo and branding -->
          <div class="text-center mb-8">
            <div class="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
              </svg>
            </div>
            <h1 class="text-2xl font-bold text-gray-900">StewardSync</h1>
            <p class="text-gray-500 mt-2">Racing Incident Review System</p>
          </div>

          <!-- Login options -->
          <div class="space-y-4">
            <button
              class="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              [disabled]="isLoading"
              (click)="loginWithGoogle()"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div class="relative">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-gray-300"></div>
              </div>
              <div class="relative flex justify-center text-sm">
                <span class="px-2 bg-white text-gray-500">or</span>
              </div>
            </div>

            <app-button
              variant="primary"
              [fullWidth]="true"
              [loading]="isLoading"
              (onClick)="loginDemo()"
            >
              Continue as Demo User
            </app-button>
          </div>

          <!-- Footer -->
          <p class="mt-8 text-center text-sm text-gray-500">
            By signing in, you agree to our terms of service and privacy policy.
          </p>
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
  private router = inject(Router);

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
    } catch (error) {
      this.toastService.error('Failed to sign in');
      console.error(error);
    } finally {
      this.isLoading = false;
    }
  }
}
