import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ConvexService } from './convex.service';
import { User, RoleName } from '@core/models';
import { Id } from '@convex/_generated/dataModel';

declare const google: any;

const STORAGE_KEY = 'steward_sync_user';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private convex = inject(ConvexService);
  private router = inject(Router);

  private _user = signal<User | null>(null);
  private _isLoading = signal(true);
  private _userId = signal<Id<'users'> | null>(null);

  readonly user = this._user.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly userRole = computed(() => this._user()?.role?.name as RoleName | undefined);

  async initialize(): Promise<void> {
    // Try to restore session from localStorage
    const storedUserId = localStorage.getItem(STORAGE_KEY);

    if (storedUserId) {
      try {
        const user = await this.convex.query(
          this.convex.api.auth.getCurrentUser,
          { userId: storedUserId as Id<'users'> }
        );

        if (user) {
          this._user.set(user as User);
          this._userId.set(storedUserId as Id<'users'>);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    this._isLoading.set(false);
  }

  async loginWithGoogle(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof google === 'undefined') {
        // For development/demo, use mock login
        this.mockLogin().then(resolve).catch(reject);
        return;
      }

      google.accounts.id.initialize({
        client_id: import.meta.env['NG_APP_GOOGLE_CLIENT_ID'] || '',
        callback: async (response: any) => {
          try {
            const decoded = this.decodeJwt(response.credential);

              const userId = await this.convex.mutation(
                this.convex.api.auth.getOrCreateUser,
                {
                  email: decoded.email,
                  name: decoded.name,
                  avatarUrl: decoded.picture,
                  discordId: decoded.sub
                }
              );

            const user = await this.convex.query(
              this.convex.api.auth.getCurrentUser,
              { userId }
            );

            if (user) {
              this._user.set(user as User);
              this._userId.set(userId);
              localStorage.setItem(STORAGE_KEY, userId);
              this.router.navigate(['/']);
            }

            resolve();
          } catch (error) {
            reject(error);
          }
        }
      });

      google.accounts.id.prompt();
    });
  }

  async mockLogin(): Promise<void> {
    // Create a demo user for development
    const userId = await this.convex.mutation(
      this.convex.api.auth.getOrCreateUser,
      {
        email: 'demo@stewardsync.com',
        name: 'Demo User',
        avatarUrl: undefined,
        discordId: 'demo-user-123'
      }
    );

    if (!userId) {
      throw new Error('Failed to create or get user');
    }

    const user = await this.convex.query(
      this.convex.api.auth.getCurrentUser,
      { userId }
    );

    if (!user) {
      throw new Error('Failed to get user after creation');
    }

    this._user.set(user as User);
    this._userId.set(userId);
    localStorage.setItem(STORAGE_KEY, userId);
    this.router.navigate(['/']);
  }

  logout(): void {
    this._user.set(null);
    this._userId.set(null);
    localStorage.removeItem(STORAGE_KEY);
    this.router.navigate(['/login']);
  }

  getUserId(): Id<'users'> | null {
    return this._userId();
  }

  hasRole(...roles: RoleName[]): boolean {
    const currentRole = this.userRole();
    return currentRole ? roles.includes(currentRole) : false;
  }

  hasMinimumRole(minimumRole: RoleName): boolean {
    const roleHierarchy: RoleName[] = ['driver', 'steward', 'head_steward', 'event_manager'];
    const currentRole = this.userRole();

    if (!currentRole) return false;

    const currentIndex = roleHierarchy.indexOf(currentRole);
    const requiredIndex = roleHierarchy.indexOf(minimumRole);

    return currentIndex >= requiredIndex;
  }

  private decodeJwt(token: string): any {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  }
}
