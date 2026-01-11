import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { ButtonComponent } from '@shared/components/button/button.component';
import { ConvexService } from '@core/services/convex.service';

interface DevUser {
  _id: string;
  email: string;
  name: string;
  discordId: string;
  role?: {
    name: string;
    displayName: string;
  };
}

@Component({
  selector: 'app-dev-login',
  standalone: true,
  imports: [CommonModule, ButtonComponent, RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-gray-900 p-4">
      <div class="w-full max-w-2xl">
        <div class="bg-white rounded-2xl shadow-2xl p-8">
          <!-- Header -->
          <div class="text-center mb-8">
            <div class="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
            </div>
            <h1 class="text-2xl font-bold text-gray-900">Dev Mode Login</h1>
            <p class="text-gray-500 mt-2">Select a demo user to test different roles</p>
          </div>

          <!-- Warning Banner -->
          <div class="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div class="flex items-start">
              <svg class="w-5 h-5 text-orange-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
              </svg>
              <div>
                <h3 class="text-sm font-medium text-orange-800">Development Only</h3>
                <p class="text-sm text-orange-700 mt-1">This login method is for testing purposes only and should not be used in production.</p>
              </div>
            </div>
          </div>

          <!-- Loading State -->
          <div *ngIf="isLoadingUsers" class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p class="text-gray-500 mt-2">Loading demo users...</p>
          </div>

          <!-- User List -->
          <div *ngIf="!isLoadingUsers && devUsers().length > 0" class="space-y-3">
            <div *ngFor="let user of devUsers()"
                 class="border border-gray-200 rounded-lg p-4 hover:border-primary-300 hover:bg-primary-50 transition-all cursor-pointer"
                 [class.opacity-50]="isLoggingIn"
                 (click)="!isLoggingIn && loginAsUser(user)">
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <h3 class="font-semibold text-gray-900">{{ user.name }}</h3>
                  <p class="text-sm text-gray-500">{{ user.email }}</p>
                  <div class="mt-2">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                          [ngClass]="{
                            'bg-purple-100 text-purple-800': user.role?.name === 'head_steward',
                            'bg-blue-100 text-blue-800': user.role?.name === 'steward',
                            'bg-green-100 text-green-800': user.role?.name === 'driver',
                            'bg-red-100 text-red-800': user.role?.name === 'event_manager'
                          }">
                      {{ user.role?.displayName || 'No Role' }}
                    </span>
                  </div>
                </div>
                <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </div>
            </div>
          </div>

          <!-- No Users Found -->
          <div *ngIf="!isLoadingUsers && devUsers().length === 0" class="text-center py-8">
            <svg class="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
            </svg>
            <p class="text-gray-500 mb-4">No demo users found</p>
            <p class="text-sm text-gray-400">Run <code class="bg-gray-100 px-2 py-1 rounded">npx convex run seed:seedDemoUsers</code> to create demo users</p>
          </div>

          <!-- Back to Login -->
          <div class="mt-6 pt-6 border-t border-gray-200">
            <a routerLink="/login"
               class="text-sm text-primary-600 hover:text-primary-700 flex items-center justify-center">
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
              </svg>
              Back to normal login
            </a>
          </div>
        </div>

        <!-- Role Descriptions -->
        <div class="mt-8 grid grid-cols-3 gap-4">
          <div class="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-white">
            <h3 class="font-semibold mb-1">Event Manager</h3>
            <p class="text-sm text-white/70">Full admin access to all features</p>
          </div>
          <div class="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-white">
            <h3 class="font-semibold mb-1">Head Steward</h3>
            <p class="text-sm text-white/70">Can review and finalize reports</p>
          </div>
          <div class="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-white">
            <h3 class="font-semibold mb-1">Steward</h3>
            <p class="text-sm text-white/70">Can review reports</p>
          </div>
        </div>
      </div>
    </div>
  `
})
export class DevLoginComponent implements OnInit {
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private convex = inject(ConvexService);

  devUsers = signal<DevUser[]>([]);
  isLoadingUsers = true;
  isLoggingIn = false;

  async ngOnInit() {
    await this.loadDevUsers();
  }

  async loadDevUsers() {
    this.isLoadingUsers = true;
    try {
      const users = await this.convex.query(
        this.convex.api.auth.getDevUsers,
        {}
      );
      this.devUsers.set(users as DevUser[]);
    } catch (error) {
      console.error('Failed to load dev users:', error);
      this.toastService.error('Failed to load demo users');
    } finally {
      this.isLoadingUsers = false;
    }
  }

  async loginAsUser(user: DevUser) {
    this.isLoggingIn = true;
    try {
      await this.authService.loginWithDiscordId(user.discordId);
      this.toastService.success(`Signed in as ${user.name}`);
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to sign in';
      this.toastService.error(errorMessage);
      console.error('Login error:', error);
    } finally {
      this.isLoggingIn = false;
    }
  }
}
