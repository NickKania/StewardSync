import { Injectable, inject } from "@angular/core";
import { Router } from "@angular/router";
import { appRuntimeConfig } from "@core/config/runtime-config";
import { AuthService } from "@core/services/auth.service";
import { ConvexService } from "@core/services/convex.service";
import { normalizePath, resolveAuthorizedDestination, validateRedirectPath } from "./route-access";
import type { TestModeBridge, TestModeReadiness } from "./test-mode.types";

export function isLoopbackConvexUrl(url: string): boolean {
  if (url !== url.trim()) return false;
  const port = /^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):(\d+)\/?$/i.exec(url)?.[1];
  return port !== undefined && Number(port) > 0 && Number(port) <= 65535;
}

function topLevelRoute(url: string): string {
  return normalizePath(url).split(/[/?#;]/)[1];
}

@Injectable()
export class TestModeService implements TestModeBridge {
  private readonly auth = inject(AuthService);
  private readonly convex = inject(ConvexService);
  private readonly router = inject(Router);
  private pending: Promise<void> = Promise.resolve();

  installBridge(): void {
    window.__STEWARDSYNC_TEST_MODE__ = {
      getReadiness: this.getReadiness.bind(this),
      listTestUsers: this.listTestUsers,
      ensureTestUsers: this.ensureTestUsers,
      loginAs: this.loginAs,
      stageScenario: this.stageScenario,
      stageCustom: this.stageCustom,
      getState: this.getState,
      reset: this.reset,
    };
  }

  async getReadiness(timeoutMs = 5000): Promise<TestModeReadiness> {
    if (!isLoopbackConvexUrl(appRuntimeConfig.convexUrl)) return "non_loopback_target";

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<TestModeReadiness>((resolve) => {
      timeoutId = setTimeout(() => resolve("unreachable"), timeoutMs);
    });

    try {
      const status = this.convex.query(this.convex.api.testMode.getStatus, {}).then(({ enabled }): TestModeReadiness =>
        enabled ? "ready" : "disabled",
      );
      return await Promise.race([deadline, status]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/test mode is disabled/i.test(message)) return "disabled";
      if (/(?:could not|cannot|can't) find public function/i.test(message)) return "functions_missing";
      return "unreachable";
    } finally {
      clearTimeout(timeoutId);
    }
  }

  readonly listTestUsers: TestModeBridge["listTestUsers"] = () =>
    this.onLoopback(() => this.convex.query(this.convex.api.testMode.listTestUsers, {}));

  readonly ensureTestUsers: TestModeBridge["ensureTestUsers"] = () =>
    this.onLoopback(() => this.convex.mutation(this.convex.api.testMode.ensureTestUsers, {}));

  readonly stageScenario: TestModeBridge["stageScenario"] = (args) =>
    this.onLoopback(() => this.convex.mutation(this.convex.api.testMode.stageScenario, args));

  readonly stageCustom: TestModeBridge["stageCustom"] = (args) =>
    this.onLoopback(() => this.convex.mutation(this.convex.api.testMode.stageCustom, args));

  readonly getState: TestModeBridge["getState"] = (args = {}) =>
    this.onLoopback(() => this.convex.query(this.convex.api.testMode.getState, args));

  readonly loginAs: TestModeBridge["loginAs"] = (roleOrKey, options) => {
    const queuedExternalEpoch = this.auth.getExternalAuthEpoch();
    return this.runSerialized(() => this.onLoopback(async () => {
      if (this.auth.getExternalAuthEpoch() !== queuedExternalEpoch) {
        throw new Error("Test mode sign-in was superseded by an authentication change");
      }
      const validatedRedirect =
        options?.navigate === false || options?.redirectTo === undefined
          ? undefined
          : validateRedirectPath(options.redirectTo);
      await this.auth.whenInitialized();
      if (this.auth.getExternalAuthEpoch() !== queuedExternalEpoch) {
        throw new Error("Test mode sign-in was superseded by an authentication change");
      }
      const startEpoch = this.auth.getAuthEpoch();
      const { user, sessionToken, expiresInSeconds, expiresAt } = await this.convex.mutation(
        this.convex.api.testMode.authenticateAs,
        { roleOrKey, ttlSeconds: options?.ttlSeconds },
      );
      if (
        this.auth.getExternalAuthEpoch() !== queuedExternalEpoch ||
        this.auth.getAuthEpoch() !== startEpoch
      ) {
        throw new Error("Test mode sign-in was superseded by an authentication change");
      }
      const previousUrl = this.router.url;
      const role = user.role.name;
      const isLandingPage = ["", "login", "dev-login", "auth", "test-mode"].includes(topLevelRoute(previousUrl));
      const landingPage = role === "driver" ? "/driver-dashboard" : "/staff-dashboard";
      const desiredUrl = options?.navigate === false
        ? previousUrl
        : validatedRedirect ?? (isLandingPage ? landingPage : previousUrl);
      const authorizedUrl = resolveAuthorizedDestination(this.router.config, desiredUrl, role);
      const snapshot = this.auth.captureSessionSnapshot();

      this.auth.setTestSession(user, sessionToken, expiresInSeconds, { bumpVersion: false });
      const candidateEpoch = this.auth.getAuthEpoch();
      try {
        if (normalizePath(authorizedUrl) !== normalizePath(previousUrl)) {
          if (!await this.router.navigateByUrl(authorizedUrl)) {
            throw new Error("Test mode sign-in navigation was cancelled");
          }
        }
      } catch (error) {
        if (this.auth.getAuthEpoch() === candidateEpoch) {
          this.auth.restoreSessionSnapshot(snapshot);
        }
        throw error;
      }

      if (
        this.auth.getExternalAuthEpoch() !== queuedExternalEpoch ||
        this.auth.getAuthEpoch() !== candidateEpoch
      ) {
        throw new Error("Test mode sign-in was superseded by an authentication change");
      }

      if (topLevelRoute(previousUrl) === topLevelRoute(this.router.url)) {
        this.auth.bumpSessionVersion();
      }
      return { user, expiresAt, expiresInSeconds };
    }));
  };

  readonly reset: TestModeBridge["reset"] = (args = {}) =>
    this.runSerialized(() => this.onLoopback(async () => {
      await this.auth.whenInitialized();
      const result = await this.convex.mutation(this.convex.api.testMode.reset, args);
      const userId = this.auth.getUserId();
      if (userId && result.deletedUserIds.includes(userId)) {
        this.auth.clearSession({ navigateToLogin: false });
        await this.router.navigateByUrl("/login");
      } else if (userId && result.revokedUserIds.includes(userId)) {
        this.auth.clearDiscordSession();
      }
      return result;
    }));

  private async onLoopback<T>(operation: () => Promise<T>): Promise<T> {
    if (!isLoopbackConvexUrl(appRuntimeConfig.convexUrl)) {
      throw new Error("non_loopback_target: Local Test Mode requires a loopback Convex URL");
    }
    return operation();
  }

  private runSerialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pending.then(operation);
    this.pending = result.then(() => undefined, () => undefined);
    return result;
  }
}
