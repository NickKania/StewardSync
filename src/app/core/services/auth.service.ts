import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ConvexService } from './convex.service';
import { User, RoleName } from '@core/models';
import { Id } from '@convex/_generated/dataModel';
import { environment } from '../../../environments/environment';

declare const google: any;

const STORAGE_KEY = 'steward_sync_user';
const DISCORD_STATE_KEY = 'steward_sync_discord_state';
const DISCORD_VERIFIER_KEY = 'steward_sync_discord_verifier';
const DISCORD_AUTH_SUCCESS = 'discord-auth-success';
const DISCORD_AUTH_ERROR = 'discord-auth-error';

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
        client_id: environment.googleClientId || '',
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

  async loginWithDiscord(): Promise<void> {
    const clientId = environment.discordClientId;
    if (!clientId) {
      throw new Error('Discord client ID not configured');
    }

    const redirectUri = `${window.location.origin}/auth/callback`;
    const state = this.generateRandomString(32);
    const codeVerifier = this.generateRandomString(64);
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    sessionStorage.setItem(DISCORD_STATE_KEY, state);
    sessionStorage.setItem(DISCORD_VERIFIER_KEY, codeVerifier);

    const authUrl = new URL('https://discord.com/api/oauth2/authorize');
    authUrl.search = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: 'identify email',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    }).toString();

    const popup = window.open(
      authUrl.toString(),
      'discord_oauth',
      'width=500,height=700,menubar=no,location=no,resizable=no,scrollbars=yes,status=no'
    );

    if (!popup) {
      throw new Error('Failed to open Discord login window');
    }

    const { code, state: returnedState } = await new Promise<{ code: string; state: string }>(
      (resolve, reject) => {
        const timeout = setInterval(() => {
          if (popup.closed) {
            cleanup();
            reject(new Error('Discord login window closed'));
          }
        }, 500);

        const cleanup = () => {
          window.removeEventListener('message', handleMessage);
          clearInterval(timeout);
        };

        const handleMessage = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          const data = event.data || {};

          if (data.type === DISCORD_AUTH_SUCCESS && data.code) {
            cleanup();
            resolve({ code: data.code, state: data.state });
          }

          if (data.type === DISCORD_AUTH_ERROR) {
            cleanup();
            reject(new Error(data.error || 'Discord authentication failed'));
          }
        };

        window.addEventListener('message', handleMessage);
      }
    );

    const storedState = sessionStorage.getItem(DISCORD_STATE_KEY);
    const storedVerifier = sessionStorage.getItem(DISCORD_VERIFIER_KEY);
    sessionStorage.removeItem(DISCORD_STATE_KEY);
    sessionStorage.removeItem(DISCORD_VERIFIER_KEY);

    if (!storedState || storedState !== returnedState) {
      throw new Error('Discord login state mismatch');
    }

    if (!storedVerifier) {
      throw new Error('Missing Discord code verifier');
    }

    const tokenData = await this.exchangeDiscordCodeForToken(
      code,
      storedVerifier,
      redirectUri,
      clientId
    );

    const profile = await this.fetchDiscordProfile(tokenData.access_token);
    const name = profile.global_name || profile.username;
    const avatarUrl = profile.avatar
      ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
      : undefined;

    const userId = await this.convex.mutation(
      this.convex.api.auth.getOrCreateUser as any,
      {
        email: profile.email || undefined,
        name,
        avatarUrl,
        discordId: profile.id,
        discordUsername: profile.username,
        discordGlobalName: profile.global_name || undefined
      } as any
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

  async loginWithDiscordId(discordId: string): Promise<void> {
    // Get user by Discord ID
    const user = await this.convex.query(
      this.convex.api.auth.getUserByDiscordId,
      { discordId }
    );

    if (!user) {
      throw new Error('User not found. Please run seedDemoUsers first.');
    }

    this._user.set(user as User);
    this._userId.set(user._id);
    localStorage.setItem(STORAGE_KEY, user._id);
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

  private generateRandomString(length: number): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const values = new Uint8Array(length);
    crypto.getRandomValues(values);
    return Array.from(values)
      .map((value) => charset[value % charset.length])
      .join('');
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(digest));
  }

  private base64UrlEncode(data: Uint8Array): string {
    let binary = '';
    data.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private async exchangeDiscordCodeForToken(
    code: string,
    codeVerifier: string,
    redirectUri: string,
    clientId: string
  ): Promise<any> {
    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
      })
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }

    return response.json();
  }

  private async fetchDiscordProfile(accessToken: string): Promise<any> {
    const response = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch Discord profile');
    }

    return response.json();
  }
}
