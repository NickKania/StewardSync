import { Injectable, signal, computed, inject } from "@angular/core";
import { Router } from "@angular/router";
import { ConvexService } from "./convex.service";
import { User, RoleName } from "@core/models";
import { Id } from "@convex/_generated/dataModel";
import { environment } from "../../../environments/environment";
import { appRuntimeConfig } from '@core/config/runtime-config';
import {
  getDiscordSessionKey,
  migrateLegacyDiscordSession,
  normalizeDeploymentScope,
  readDiscordAccessToken,
  storeDiscordSession,
} from '@core/utils/discord-session';

const STORAGE_KEY = "steward_sync_user";
const DISCORD_STATE_KEY = "steward_sync_discord_state";
const DISCORD_VERIFIER_KEY = "steward_sync_discord_verifier";
const DISCORD_AUTH_SUCCESS = "discord-auth-success";
const DISCORD_AUTH_ERROR = "discord-auth-error";
const DISCORD_AUTH_RESULT_KEY = "steward_sync_discord_auth_result";
const AUTH_DEBUG = !environment.production;

export function getUserStorageKey(convexUrl: string | undefined = appRuntimeConfig.convexUrl): string {
  const scope = normalizeDeploymentScope(convexUrl);
  return scope ? `${STORAGE_KEY}:${scope}` : STORAGE_KEY;
}

interface SessionSnapshot {
  user: User | null;
  userId: Id<"users"> | null;
  userStorageKey: string;
  discordSessionKey: string;
  storedUserId: string | null;
  discordSession: string | null;
}

interface DiscordTokenResponse {
  access_token: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
}

interface DiscordProfile {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
}

@Injectable({
  providedIn: "root",
})
export class AuthService {
  private convex = inject(ConvexService);
  private router = inject(Router);

  private initialization?: Promise<void>;

  private _user = signal<User | null>(null);
  private _isLoading = signal(true);
  private _userId = signal<Id<"users"> | null>(null);
  private readonly _sessionVersion = signal(0);
  private _authEpoch = 0;
  private _externalAuthEpoch = 0;

  readonly user = this._user.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly sessionVersion = this._sessionVersion.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly userRole = computed(
    () => this._user()?.role?.name as RoleName | undefined,
  );

  private logAuth(step: string, details?: Record<string, unknown>): void {
    if (!AUTH_DEBUG) return;
    console.log("[DiscordAuth]", step, details ?? {});
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string,
  ): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  initialize(): Promise<void> {
    return this.whenInitialized();
  }

  whenInitialized(): Promise<void> {
    if (!this.initialization) {
      this.initialization = this.restoreSession()
        .catch(() => {
          this.initialization = undefined;
        })
        .finally(() => {
          this._isLoading.set(false);
        });
    }
    return this.initialization;
  }

  private userStorageKey(): string {
    return getUserStorageKey(appRuntimeConfig.convexUrl);
  }

  private discordSessionKey(): string {
    return getDiscordSessionKey(appRuntimeConfig.convexUrl);
  }

  private async restoreSession(): Promise<void> {
    const scopedKey = this.userStorageKey();
    const sessionKey = this.discordSessionKey();
    const selectedUserId = () => localStorage.getItem(scopedKey) ?? (
      scopedKey !== STORAGE_KEY && !localStorage.getItem(`${scopedKey}:signed-out`)
        ? localStorage.getItem(STORAGE_KEY)
        : null
    );
    const epoch = this._authEpoch;
    const storedUserId = selectedUserId();
    const fromLegacyKey = storedUserId !== null && !localStorage.getItem(scopedKey);
    if (!storedUserId) sessionStorage.removeItem(sessionKey);

    if (storedUserId) {
      try {
        const user = await this.convex.query(
          this.convex.api.auth.getCurrentUser,
          { userId: storedUserId as Id<"users"> },
        );

        if (epoch !== this._authEpoch || selectedUserId() !== storedUserId) return;

        if (user) {
          this._authEpoch += 1;
          this._user.set(user as User);
          this._userId.set(storedUserId as Id<"users">);
          if (fromLegacyKey) {
            localStorage.setItem(scopedKey, storedUserId);
            if (localStorage.getItem(STORAGE_KEY) === storedUserId) localStorage.removeItem(STORAGE_KEY);
          }
          // A different tab may have migrated the shared user ID before this tab restores its credential.
          migrateLegacyDiscordSession(sessionStorage, storedUserId, sessionKey);
        } else {
          this._authEpoch += 1;
          sessionStorage.removeItem(sessionKey);
          if (!fromLegacyKey) {
            localStorage.removeItem(scopedKey);
          }
        }
      } catch (error) {
        console.error("Failed to restore session:", error);
        throw error;
      }
    }
  }

  async loginWithDiscord(): Promise<void> {
    const clientId = environment.discordClientId || appRuntimeConfig.discordClientId;
    this.logAuth("loginWithDiscord:start", {
      hasClientId: Boolean(clientId),
      origin: window.location.origin,
    });

    if (!clientId) {
      throw new Error("Discord client ID not configured");
    }

    const redirectUri = `${window.location.origin}/auth/callback`;
    const state = this.generateRandomString(32);
    const codeVerifier = this.generateRandomString(64);
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    sessionStorage.setItem(DISCORD_STATE_KEY, state);
    sessionStorage.setItem(DISCORD_VERIFIER_KEY, codeVerifier);
    this.logAuth("pkce:generated", {
      redirectUri,
      statePrefix: state.slice(0, 8),
      verifierLength: codeVerifier.length,
    });

    const authUrl = new URL("https://discord.com/api/oauth2/authorize");
    authUrl.search = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: "identify email",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    }).toString();

    const popup = window.open(
      authUrl.toString(),
      "discord_oauth",
      "width=500,height=700,menubar=no,location=no,resizable=no,scrollbars=yes,status=no",
    );

    if (!popup) {
      throw new Error("Failed to open Discord login window");
    }
    this.logAuth("popup:opened");

    const { code, state: returnedState } = await new Promise<{
      code: string;
      state: string;
    }>((resolve, reject) => {
      const timeout = setInterval(() => {
        if (popup.closed) {
          cleanup();
          reject(new Error("Discord login window closed"));
        }
      }, 500);

      const popupPoll = setInterval(() => {
        try {
          if (popup.closed) {
            cleanup();
            reject(new Error("Discord login window closed"));
            return;
          }

          const popupUrl = popup.location.href;
          if (!popupUrl.startsWith(redirectUri)) return;

          const callbackUrl = new URL(popupUrl);
          const code = callbackUrl.searchParams.get("code");
          const state = callbackUrl.searchParams.get("state");
          const error = callbackUrl.searchParams.get("error");
          const errorDescription = callbackUrl.searchParams.get(
            "error_description",
          );

          cleanup();
          popup.close();

          if (error) {
            this.logAuth("popup:poll:error", { error, errorDescription });
            reject(new Error(errorDescription || error));
            return;
          }

          if (!code) {
            reject(new Error("No authorization code received"));
            return;
          }

          this.logAuth("popup:poll:success", {
            statePrefix: (state ?? "").slice(0, 8),
          });
          resolve({ code, state: state ?? "" });
        } catch {
          // Cross-origin while on Discord domain; ignore until redirected back.
        }
      }, 250);

      const cleanup = () => {
        window.removeEventListener("message", handleMessage);
        window.removeEventListener("storage", handleStorage);
        clearInterval(timeout);
        clearInterval(popupPoll);
      };

      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        const data = event.data || {};

        if (data.type === DISCORD_AUTH_SUCCESS && data.code) {
          this.logAuth("popup:message:success", {
            statePrefix: String(data.state ?? "").slice(0, 8),
          });
          cleanup();
          resolve({ code: data.code, state: data.state });
        }

        if (data.type === DISCORD_AUTH_ERROR) {
          this.logAuth("popup:message:error", { error: data.error });
          cleanup();
          reject(new Error(data.error || "Discord authentication failed"));
        }
      };

      const handleStorage = (event: StorageEvent) => {
        if (event.key !== DISCORD_AUTH_RESULT_KEY || !event.newValue) return;

        try {
          const data = JSON.parse(event.newValue);
          localStorage.removeItem(DISCORD_AUTH_RESULT_KEY);

          if (data.type === DISCORD_AUTH_SUCCESS && data.code) {
            this.logAuth("popup:storage:success", {
              statePrefix: String(data.state ?? "").slice(0, 8),
            });
            cleanup();
            resolve({ code: data.code, state: data.state });
            return;
          }

          if (data.type === DISCORD_AUTH_ERROR) {
            this.logAuth("popup:storage:error", { error: data.error });
            cleanup();
            reject(new Error(data.error || "Discord authentication failed"));
          }
        } catch {
          cleanup();
          reject(new Error("Invalid Discord authentication response"));
        }
      };

      window.addEventListener("message", handleMessage);
      window.addEventListener("storage", handleStorage);
    });

    const storedState = sessionStorage.getItem(DISCORD_STATE_KEY);
    const storedVerifier = sessionStorage.getItem(DISCORD_VERIFIER_KEY);
    sessionStorage.removeItem(DISCORD_STATE_KEY);
    sessionStorage.removeItem(DISCORD_VERIFIER_KEY);
    this.logAuth("callback:received", {
      hasStoredState: Boolean(storedState),
      hasStoredVerifier: Boolean(storedVerifier),
      returnedStatePrefix: returnedState.slice(0, 8),
      storedStatePrefix: (storedState ?? "").slice(0, 8),
    });

    if (!storedState || storedState !== returnedState) {
      throw new Error("Discord login state mismatch");
    }

    if (!storedVerifier) {
      throw new Error("Missing Discord code verifier");
    }

    const tokenData = await this.exchangeDiscordCodeForToken(
      code,
      storedVerifier,
      redirectUri,
      clientId,
    );
    this.logAuth("token:exchange:success", {
      hasAccessToken: Boolean(tokenData?.access_token),
      tokenType: tokenData?.token_type,
      scope: tokenData?.scope,
    });

    const profile = await this.fetchDiscordProfile(tokenData.access_token);
    this.logAuth("profile:fetch:success", {
      discordId: profile?.id,
      username: profile?.username,
    });
    const name = profile.global_name || profile.username;
    const avatarUrl = profile.avatar
      ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
      : undefined;

    this.logAuth("convex:getOrCreateUser:start");
    const userId = await this.withTimeout(
      this.convex.mutation(this.convex.api.auth.getOrCreateUser, {
        name,
        avatarUrl,
        discordId: profile.id,
        discordUsername: profile.username,
      }),
      15000,
      "Timed out waiting for Convex mutation. Check Convex backend connection.",
    );
    this.logAuth("convex:getOrCreateUser:success", { userId });

    const user = await this.convex.query(this.convex.api.auth.getCurrentUser, {
      userId,
    });

    if (user) {
      this._authEpoch += 1;
      this._externalAuthEpoch += 1;
      storeDiscordSession(
        sessionStorage,
        userId,
        tokenData.access_token,
        tokenData.expires_in,
        Date.now(),
        this.discordSessionKey(),
      );
      this._user.set(user as User);
      this._userId.set(userId);
      localStorage.setItem(this.userStorageKey(), userId);
      this.bumpSessionVersion();
      this.router.navigate(["/"]);
      this.logAuth("loginWithDiscord:complete", { userId });
    }
  }

  async mockLogin(): Promise<void> {
    sessionStorage.removeItem(this.discordSessionKey());
    // Create a demo user for development
    const userId = await this.convex.mutation(
      this.convex.api.auth.getOrCreateUser,
      {
        name: "Demo User",
        avatarUrl: undefined,
        discordId: "demo-user-123",
      },
    );

    if (!userId) {
      throw new Error("Failed to create or get user");
    }

    const user = await this.convex.query(this.convex.api.auth.getCurrentUser, {
      userId,
    });

    if (!user) {
      throw new Error("Failed to get user after creation");
    }

    this._authEpoch += 1;
    this._externalAuthEpoch += 1;
    this._user.set(user as User);
    this._userId.set(userId);
    localStorage.setItem(this.userStorageKey(), userId);
    this.bumpSessionVersion();
    this.router.navigate(["/"]);
  }

  async loginWithDiscordId(discordId: string): Promise<void> {
    sessionStorage.removeItem(this.discordSessionKey());
    // Get user by Discord ID
    const user = await this.convex.query(
      this.convex.api.auth.getUserByDiscordId,
      { discordId },
    );

    if (!user) {
      throw new Error("User not found. Please run seedDemoUsers first.");
    }

    this._authEpoch += 1;
    this._externalAuthEpoch += 1;
    this._user.set(user as User);
    this._userId.set(user._id);
    localStorage.setItem(this.userStorageKey(), user._id);
    this.bumpSessionVersion();
    this.router.navigate(["/"]);
  }

  logout(): void {
    this.clearSession();
  }

  getAuthEpoch(): number {
    return this._authEpoch;
  }

  getExternalAuthEpoch(): number {
    return this._externalAuthEpoch;
  }

  captureSessionSnapshot(): SessionSnapshot {
    const userStorageKey = this.userStorageKey();
    const discordSessionKey = this.discordSessionKey();
    return {
      user: this._user(),
      userId: this._userId(),
      userStorageKey,
      discordSessionKey,
      storedUserId: localStorage.getItem(userStorageKey),
      discordSession: sessionStorage.getItem(discordSessionKey),
    };
  }

  restoreSessionSnapshot(snapshot: SessionSnapshot): void {
    this._authEpoch += 1;
    if (snapshot.storedUserId === null) {
      localStorage.removeItem(snapshot.userStorageKey);
    } else {
      localStorage.setItem(snapshot.userStorageKey, snapshot.storedUserId);
    }
    if (snapshot.discordSession === null) {
      sessionStorage.removeItem(snapshot.discordSessionKey);
    } else {
      sessionStorage.setItem(snapshot.discordSessionKey, snapshot.discordSession);
    }
    this._user.set(snapshot.user);
    this._userId.set(snapshot.userId);
  }

  setTestSession(
    user: User,
    sessionToken: string,
    expiresInSeconds: number,
    options?: { bumpVersion?: boolean },
  ): void {
    this._authEpoch += 1;
    storeDiscordSession(
      sessionStorage,
      user._id,
      sessionToken,
      expiresInSeconds,
      Date.now(),
      this.discordSessionKey(),
    );
    localStorage.setItem(this.userStorageKey(), user._id);
    this._user.set(user);
    this._userId.set(user._id);
    if (options?.bumpVersion !== false) this.bumpSessionVersion();
  }

  bumpSessionVersion(): void {
    this._sessionVersion.update((version) => version + 1);
  }

  clearDiscordSession(): void {
    sessionStorage.removeItem(this.discordSessionKey());
  }

  clearSession(options?: { navigateToLogin?: boolean }): void {
    this._authEpoch += 1;
    this._externalAuthEpoch += 1;
    this.clearDiscordSession();
    this._user.set(null);
    this._userId.set(null);
    // A legacy identity may belong to another deployment sharing this origin.
    localStorage.setItem(`${this.userStorageKey()}:signed-out`, "true");
    localStorage.removeItem(this.userStorageKey());
    this.bumpSessionVersion();
    if (options?.navigateToLogin !== false) void this.router.navigate(["/login"]);
  }

  requireDiscordAccessToken(): string {
    const accessToken = readDiscordAccessToken(
      sessionStorage,
      this.getUserId(),
      Date.now(),
      this.discordSessionKey(),
    );
    if (!accessToken) throw new Error("Sign in with Discord again to make corrections");
    return accessToken;
  }

  getUserId(): Id<"users"> | null {
    return this._userId();
  }

  requireUserId(): Id<"users"> {
    const userId = this._userId();
    if (!userId) {
      throw new Error("Session expired. Please log in again.");
    }
    return userId;
  }

  hasRole(...roles: RoleName[]): boolean {
    const currentRole = this.userRole();
    return currentRole ? roles.includes(currentRole) : false;
  }

  hasMinimumRole(minimumRole: RoleName): boolean {
    const roleHierarchy: RoleName[] = [
      "driver",
      "steward",
      "head_steward",
      "event_manager",
      "league_manager",
    ];
    const currentRole = this.userRole();

    if (!currentRole) return false;

    const currentIndex = roleHierarchy.indexOf(currentRole);
    const requiredIndex = roleHierarchy.indexOf(minimumRole);

    return currentIndex >= requiredIndex;
  }

  private generateRandomString(length: number): string {
    const charset =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    const values = new Uint8Array(length);
    crypto.getRandomValues(values);
    return Array.from(values)
      .map((value) => charset[value % charset.length])
      .join("");
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return this.base64UrlEncode(new Uint8Array(digest));
  }

  private base64UrlEncode(data: Uint8Array): string {
    let binary = "";
    data.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  private async exchangeDiscordCodeForToken(
    code: string,
    codeVerifier: string,
    redirectUri: string,
    clientId: string,
  ): Promise<DiscordTokenResponse> {
    this.logAuth("token:exchange:start", { redirectUri });
    const response = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logAuth("token:exchange:error", {
        status: response.status,
        body: errorBody.slice(0, 300),
      });
      throw new Error(
        `Failed to exchange code for token (status ${response.status})`,
      );
    }

    return response.json();
  }

  private async fetchDiscordProfile(accessToken: string): Promise<DiscordProfile> {
    this.logAuth("profile:fetch:start");
    const response = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logAuth("profile:fetch:error", {
        status: response.status,
        body: errorBody.slice(0, 300),
      });
      throw new Error(`Failed to fetch Discord profile (status ${response.status})`);
    }

    return response.json();
  }
}
