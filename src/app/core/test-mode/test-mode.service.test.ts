import "@angular/compiler";
import { DOCUMENT, PlatformLocation } from "@angular/common";
import { MockPlatformLocation, provideLocationMocks } from "@angular/common/testing";
import {
  Component, ErrorHandler, ɵIMAGE_CONFIG, InjectionToken, NgZone, RendererFactory2, createComponent, inject,
  type ApplicationRef, type OnDestroy, type OnInit,
  ɵINJECTOR_SCOPE, ɵNoopNgZone, ɵinternalCreateApplication,
} from "@angular/core";
import { ActivatedRoute, Router, RouterOutlet, provideRouter, type Routes } from "@angular/router";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { getFunctionName, type FunctionReference } from "convex/server";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { appRuntimeConfig } from "@core/config/runtime-config";
import type { RoleName } from "@core/models";
import { AuthService, getUserStorageKey } from "@core/services/auth.service";
import { ConvexService } from "@core/services/convex.service";
import { DISCORD_SESSION_KEY, getDiscordSessionKey, storeDiscordSession } from "@core/utils/discord-session";
import { routes } from "../../app.routes";
import { resolveAuthorizedDestination } from "./route-access";
import { provideLocalTestMode } from "./test-mode.entry.local";
import { isLoopbackConvexUrl, TestModeService } from "./test-mode.service";
import type { TestModeLoginResult, TestModeResetResult } from "./test-mode.types";

const userStorageKey = () => getUserStorageKey(appRuntimeConfig.convexUrl);
const discordSessionKey = () => getDiscordSessionKey(appRuntimeConfig.convexUrl);
const originalUrl = appRuntimeConfig.convexUrl;
const originalStorage = ["localStorage", "sessionStorage"].map((key) => ({
  key, descriptor: Object.getOwnPropertyDescriptor(globalThis, key),
}));
const applications: ApplicationRef[] = [];

function user(key: string, role: RoleName = "driver"): TestModeLoginResult["user"] {
  const roleId = `role-${role}` as Id<"roles">;
  return { _id: `user-${key}` as Id<"users">, name: key, roleId, createdAt: 1, role: {
    _id: roleId, name: role, displayName: role,
  } };
}

const manager = user("league_manager", "league_manager");
const driver = user("driver");
const secondDriver = user("driver_2");
const eventManager = user("event_manager", "event_manager");
const headSteward = user("head_steward", "head_steward");
const users = [manager, driver, secondDriver, eventManager, headSteward];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

interface Lifecycle {
  phase: "init" | "destroy";
  path: string;
  user: string | undefined;
}

const LIFECYCLE = new InjectionToken<Lifecycle[]>("route lifecycle");

@Component({
  selector: "app-route-probe",
  standalone: true,
  imports: [RouterOutlet],
  template: "<router-outlet />",
})
class RouteProbeComponent implements OnInit, OnDestroy {
  private readonly events = inject(LIFECYCLE);
  private readonly path = inject(ActivatedRoute).pathFromRoot
    .map(({ snapshot }) => snapshot.routeConfig?.path).filter(Boolean).join("/");
  private readonly user = inject(AuthService).user()?.name;

  ngOnInit(): void { this.events.push({ phase: "init", path: this.path, user: this.user }); }
  ngOnDestroy(): void { this.events.push({ phase: "destroy", path: this.path, user: this.user }); }
}

@Component({
  selector: "app-test-mode-router-host",
  standalone: true,
  imports: [RouterOutlet],
  template: `
    @if (auth.isAuthenticated()) {
      @for (key of [auth.sessionVersion()]; track key) { <router-outlet /> }
    } @else {
      <router-outlet />
    }
  `,
})
class TestModeRouterHostComponent {
  protected readonly auth = inject(AuthService);
}

function probeRoutes(config: Routes, canLeaveAdmin?: () => boolean | Promise<boolean>): Routes {
  return config.map((route) => {
    const { loadComponent, children, ...rest } = route;
    return {
      ...rest,
      ...(loadComponent ? { component: RouteProbeComponent } : {}),
      ...(children ? { children: probeRoutes(children, canLeaveAdmin) } : {}),
      ...(route.path === "users" && canLeaveAdmin ? { canDeactivate: [canLeaveAdmin] } : {}),
    };
  });
}

// Angular owns the router, directives, views and lifecycle. The renderer discards DOM writes.
const noop = () => undefined;
const renderer = {
  selectRootElement: (host: Element) => host,
  createElement: () => ({}), createComment: () => ({}), createText: () => ({}),
  appendChild: noop, insertBefore: noop, removeChild: noop, setValue: noop,
  setAttribute: noop, destroy: noop, parentNode: () => null, nextSibling: () => null,
};

async function setup(options?: {
  canLeaveAdmin?: () => boolean | Promise<boolean>;
  bootstrapBridge?: boolean;
  beforeUserLookup?: () => Promise<void>;
}) {
  const events: Lifecycle[] = [];
  const query = mock(async (ref: FunctionReference<"query">, args: { userId?: string }) => {
    if (getFunctionName(ref) === "auth:getCurrentUser") {
      if (options?.beforeUserLookup) await options.beforeUserLookup();
      return users.find(({ _id }) => _id === args.userId) ?? null;
    }
    return { enabled: true };
  });
  let resetResult: TestModeResetResult = {
    deletedByTable: {}, deletedUserIds: [], revokedUserIds: [], skippedUsers: [],
  };
  const mutation = mock(async (ref: FunctionReference<"mutation">, args: { roleOrKey?: string }) => {
    if (getFunctionName(ref) === "testMode:reset") return resetResult;
    const identity = users.find(({ name }) => name === args.roleOrKey);
    if (!identity) throw new Error("Unknown test identity");
    return {
      user: identity,
      sessionToken: `token-${identity.name}`,
      expiresInSeconds: 900,
      expiresAt: Date.now() + 900_000,
    };
  });
  const app = await ɵinternalCreateApplication({
    appProviders: [
      { provide: ɵINJECTOR_SCOPE, useValue: "root" },
      ErrorHandler,
      { provide: ɵIMAGE_CONFIG, useValue: { disableImageSizeWarning: true, disableImageLazyLoadWarning: true } },
      { provide: NgZone, useClass: ɵNoopNgZone },
      { provide: DOCUMENT, useValue: {} },
      { provide: PlatformLocation, useClass: MockPlatformLocation },
      ...provideLocationMocks(),
      provideRouter(probeRoutes(routes, options?.canLeaveAdmin)),
      { provide: RendererFactory2, useValue: { createRenderer: () => renderer } },
      { provide: ConvexService, useValue: { api, query, mutation } },
      { provide: LIFECYCLE, useValue: events },
      ...(options?.bootstrapBridge ? provideLocalTestMode() : [TestModeService]),
    ],
  });
  applications.push(app);
  const auth = app.injector.get(AuthService);
  const router = app.injector.get(Router);
  const service = app.injector.get(TestModeService);
  const host = createComponent(TestModeRouterHostComponent, {
    environmentInjector: app.injector, hostElement: {} as Element,
  });
  app.attachView(host.hostView);
  app.tick();

  async function startAs(identity: TestModeLoginResult["user"], url: string) {
    await auth.whenInitialized();
    auth.setTestSession(identity, `token-${identity.name}`, 900);
    app.tick();
    expect(await router.navigateByUrl(url)).toBe(true);
    app.tick();
  }

  return { app, auth, router, service, events, query, mutation, startAs,
    setResetResult: (result: Partial<TestModeResetResult>) => { resetResult = { ...resetResult, ...result }; },
  };
}

function expectIdentity(auth: AuthService, identity: TestModeLoginResult["user"]): void {
  expect(auth.user()).toEqual(identity);
  expect(localStorage.getItem(userStorageKey())).toBe(identity._id);
  expect(auth.requireDiscordAccessToken()).toBe(`token-${identity.name}`);
}

beforeEach(() => {
  Object.assign(appRuntimeConfig, { convexUrl: "http://127.0.0.1:3210" });
  for (const { key } of originalStorage) {
    const data = new Map<string, string>();
    Object.defineProperty(globalThis, key, { configurable: true, value: {
      getItem: (name: string) => data.get(name) ?? null,
      setItem: (name: string, value: string) => { data.set(name, value); },
      removeItem: (name: string) => { data.delete(name); },
    } });
  }
});

afterEach(() => {
  for (const app of applications.splice(0).reverse()) app.destroy();
  Object.assign(appRuntimeConfig, { convexUrl: originalUrl });
  for (const { key, descriptor } of originalStorage) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

describe("local test mode backend access", () => {
  test("installs the automation bridge during local application initialization", async () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    const browserWindow: Pick<Window, "__STEWARDSYNC_TEST_MODE__"> = {};
    Object.defineProperty(globalThis, "window", { configurable: true, value: browserWindow });
    try {
      const { auth } = await setup({ bootstrapBridge: true });
      const bridge = browserWindow.__STEWARDSYNC_TEST_MODE__;
      expect(bridge).toBeDefined();
      expect(await bridge?.getReadiness()).toBe("ready");
      await bridge?.loginAs("driver");
      expectIdentity(auth, driver);
    } finally {
      if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
      else Reflect.deleteProperty(globalThis, "window");
    }
  });

  test("only accepts exact, port-qualified HTTP loopback endpoints", () => {
    for (const valid of ["http://127.0.0.1:3210", "http://localhost:3210/", "http://[::1]:3210"]) {
      expect(isLoopbackConvexUrl(valid)).toBe(true);
    }
    for (const invalid of [
      "https://localhost:3210", "http://127.0.0.2:3210", "http://localhost.evil:3210",
      "http://127.0.0.1", "http://localhost:65536", "http://localhost:3210/api",
      "http://localhost:3210?target=remote", "http://localhost:3210@remote.example", "http://localhost:3210\n",
    ]) {
      expect(isLoopbackConvexUrl(invalid)).toBe(false);
    }
  });

  test("rejects every remote operation before contacting Convex", async () => {
    const { service, query, mutation } = await setup();
    Object.assign(appRuntimeConfig, { convexUrl: "https://example.convex.cloud" });
    expect(await service.getReadiness()).toBe("non_loopback_target");
    for (const operation of [
      service.listTestUsers, service.ensureTestUsers, () => service.loginAs("driver"),
      () => service.stageScenario({ scenario: "baseline" }), () => service.stageCustom({}),
      service.getState, service.reset,
    ]) {
      await expect(operation()).rejects.toThrow("non_loopback_target");
    }
    expect(query).not.toHaveBeenCalled();
    expect(mutation).not.toHaveBeenCalled();
  });

  test("classifies readiness and resolves on a disconnected client's deadline", async () => {
    const { service, query } = await setup();
    expect(await service.getReadiness()).toBe("ready");
    query.mockRejectedValueOnce(new Error("Could not find public function for 'testMode:getStatus'"));
    expect(await service.getReadiness()).toBe("functions_missing");
    query.mockRejectedValueOnce(new Error("Test mode is disabled"));
    expect(await service.getReadiness()).toBe("disabled");
    query.mockResolvedValueOnce({ enabled: false });
    expect(await service.getReadiness()).toBe("disabled");
    query.mockImplementationOnce(() => new Promise(() => undefined));
    expect(await service.getReadiness(10)).toBe("unreachable");
  });
});

describe("local test mode session lifecycle", () => {
  test("waits for persisted auth initialization before authenticating", async () => {
    const { service, query, mutation, auth } = await setup();
    localStorage.setItem(userStorageKey(), manager._id);
    const restored = deferred<typeof manager>();
    const reading = deferred<void>();
    query.mockImplementationOnce(() => {
      reading.resolve(undefined);
      return restored.promise;
    });
    const switched = service.loginAs("driver");
    await reading.promise;
    expect(mutation).not.toHaveBeenCalled();
    restored.resolve(manager);
    expect((await switched).user).toEqual(driver);
    expectIdentity(auth, driver);
  });

  test("restores identity and uses the same tab credential after reload until it expires", async () => {
    const first = await setup();
    await first.service.loginAs("driver");
    applications.pop()?.destroy();

    const reload = await setup();
    await reload.auth.whenInitialized();
    expectIdentity(reload.auth, driver);
    const expiredCredential = JSON.stringify({
      userId: driver._id, accessToken: "token-driver", expiresAt: Date.now() - 1,
    });
    sessionStorage.setItem(discordSessionKey(), expiredCredential);
    expect(() => reload.auth.requireDiscordAccessToken()).toThrow();
    expect(reload.auth.user()).toEqual(driver);
    expect(localStorage.getItem(userStorageKey())).toBe(driver._id);
  });

  test("namespaces stored sessions by deployment so switching between ordinary and test-mode apps preserves both identities", async () => {
    const ordinaryUrl = "http://127.0.0.1:3210";
    const testModeUrl = "http://127.0.0.1:3215";

    // 1. Sign into the ordinary app on deployment A
    Object.assign(appRuntimeConfig, { convexUrl: ordinaryUrl });
    const ordinaryApp = await setup();
    ordinaryApp.query.mockImplementation(async (ref: FunctionReference<"query">, args: { discordId?: string; userId?: string }) => {
      if (getFunctionName(ref) === "auth:getUserByDiscordId" && args.discordId === "ordinary-discord") {
        return manager;
      }
      if (getFunctionName(ref) === "auth:getCurrentUser" && args.userId === manager._id) {
        return manager;
      }
      return null;
    });
    await ordinaryApp.auth.loginWithDiscordId("ordinary-discord");
    expect(ordinaryApp.auth.user()).toEqual(manager);
    expect(localStorage.getItem(getUserStorageKey(ordinaryUrl))).toBe(manager._id);
    applications.pop()?.destroy();

    // 2. Switch to Local Test Mode on deployment B (same browser storage) and sign in as a fixture driver
    Object.assign(appRuntimeConfig, { convexUrl: testModeUrl });
    const testApp = await setup();
    await testApp.auth.whenInitialized();
    expect(testApp.auth.user()).toBeNull();
    await testApp.service.loginAs("driver");
    expectIdentity(testApp.auth, driver);
    expect(localStorage.getItem(getUserStorageKey(ordinaryUrl))).toBe(manager._id);
    expect(localStorage.getItem(getUserStorageKey(testModeUrl))).toBe(driver._id);
    applications.pop()?.destroy();

    // 3. Return to the ordinary app on deployment A — its saved identity is preserved intact
    Object.assign(appRuntimeConfig, { convexUrl: ordinaryUrl });
    const ordinaryReload = await setup();
    await ordinaryReload.auth.whenInitialized();
    expect(ordinaryReload.auth.user()).toEqual(manager);
    applications.pop()?.destroy();

    // 4. Return to Local Test Mode on deployment B — the fixture identity and correction token are still intact
    Object.assign(appRuntimeConfig, { convexUrl: testModeUrl });
    const testReload = await setup();
    await testReload.auth.whenInitialized();
    expectIdentity(testReload.auth, driver);
  });

  test.each(["legacy", "scoped"])("migrates a tab's legacy Discord credential when restoring a %s user ID", async storage => {
    localStorage.setItem(storage === "legacy" ? "steward_sync_user" : userStorageKey(), manager._id);
    storeDiscordSession(sessionStorage, manager._id, "legacy-discord-token", 900);

    const { auth } = await setup();
    await auth.whenInitialized();

    expect(auth.user()).toEqual(manager);
    expect(auth.requireDiscordAccessToken()).toBe("legacy-discord-token");
    expect(localStorage.getItem(userStorageKey())).toBe(manager._id);
    expect(localStorage.getItem("steward_sync_user")).toBeNull();
    expect(sessionStorage.getItem(DISCORD_SESSION_KEY)).toBeNull();
  });

  test("logout in a second tab invalidates a pending legacy restore", async () => {
    localStorage.setItem("steward_sync_user", manager._id);
    const started = deferred<void>();
    const release = deferred<void>();
    const first = await setup({ beforeUserLookup: () => {
      started.resolve();
      return release.promise;
    } });
    const pending = first.auth.whenInitialized();
    await started.promise;
    const second = await setup();
    await second.auth.whenInitialized();
    second.auth.logout();
    release.resolve();
    await pending;
    expect(first.auth.user()).toBeNull();
    expect(localStorage.getItem(userStorageKey())).toBeNull();
  });

  test("logout prevents another legacy identity from being restored on reload", async () => {
    localStorage.setItem(userStorageKey(), driver._id);
    localStorage.setItem("steward_sync_user", manager._id);
    storeDiscordSession(sessionStorage, manager._id, "legacy-manager-token", 900);

    const { auth } = await setup();
    await auth.whenInitialized();
    expect(auth.user()).toEqual(driver);
    auth.logout();

    const reload = await setup();
    await reload.auth.whenInitialized();
    expect(reload.auth.user()).toBeNull();
    expect(() => reload.auth.requireDiscordAccessToken()).toThrow();
    expect(localStorage.getItem("steward_sync_user")).toBe(manager._id);
  });

  test("preserves a legacy Discord credential for a different user", async () => {
    localStorage.setItem(userStorageKey(), driver._id);
    storeDiscordSession(sessionStorage, manager._id, "legacy-discord-token", 900);

    const { auth } = await setup();
    await auth.whenInitialized();

    expect(auth.user()).toEqual(driver);
    expect(() => auth.requireDiscordAccessToken()).toThrow();
    expect(sessionStorage.getItem(DISCORD_SESSION_KEY)).toContain("legacy-discord-token");
  });

  test("keeps the scoped Discord credential when the same user has a legacy credential", async () => {
    localStorage.setItem(userStorageKey(), manager._id);
    storeDiscordSession(sessionStorage, manager._id, "legacy-discord-token", 900);
    storeDiscordSession(sessionStorage, manager._id, "scoped-discord-token", 900, Date.now(), discordSessionKey());

    const { auth } = await setup();
    await auth.whenInitialized();

    expect(auth.requireDiscordAccessToken()).toBe("scoped-discord-token");
    expect(sessionStorage.getItem(DISCORD_SESSION_KEY)).toBeNull();
  });

  test.each(["deleted", "revoked"] as const)("clears the appropriate credentials for a %s user", async (state) => {
    const { service, auth, router, startAs, setResetResult } = await setup();
    await startAs(driver, "/driver-dashboard");
    setResetResult(state === "deleted" ? { deletedUserIds: [driver._id] } : { revokedUserIds: [driver._id] });
    await service.reset({ includeUsers: true });

    expect(sessionStorage.getItem(discordSessionKey())).toBeNull();
    expect(auth.getUserId()).toBe(state === "deleted" ? null : driver._id);
    expect(localStorage.getItem(userStorageKey())).toBe(state === "deleted" ? null : driver._id);
    expect(router.url).toBe(state === "deleted" ? "/login" : "/driver-dashboard");
  });
});

describe("identity switches using the Angular router", () => {
  test.each([
    { redirectTo: "/admin/series" },
    { redirectTo: "/admin/users" },
    { navigate: false },
  ])("downgrades an admin session safely with %j", async (options) => {
    const { app, auth, router, service, startAs, events } = await setup();
    await startAs(manager, "/admin/users");
    const version = auth.sessionVersion();
    await service.loginAs("driver", options);
    app.tick();

    expect(router.url).toBe("/driver-dashboard");
    expect(auth.sessionVersion()).toBe(version);
    expectIdentity(auth, driver);
    expect(events.filter(({ phase }) => phase === "init")).toEqual([
      { phase: "init", path: "admin/users", user: "league_manager" },
      { phase: "init", path: "driver-dashboard", user: "driver" },
    ]);
  });

  test.each(["cancelled", "rejected"] as const)("rolls back a %s navigation", async (outcome) => {
    const { app, auth, router, service, startAs, events } = await setup({
      canLeaveAdmin: () => {
        if (outcome === "rejected") throw new Error("Navigation rejected");
        return false;
      },
    });
    await startAs(manager, "/admin/users");
    const priorSession = sessionStorage.getItem(discordSessionKey());
    const version = auth.sessionVersion();
    await expect(service.loginAs("driver", { redirectTo: "/admin/series" })).rejects.toThrow(outcome);
    app.tick();

    expect(router.url).toBe("/admin/users");
    expect(auth.sessionVersion()).toBe(version);
    expectIdentity(auth, manager);
    expect(sessionStorage.getItem(discordSessionKey())).toBe(priorSession);
    expect(events).toEqual([{ phase: "init", path: "admin/users", user: "league_manager" }]);
  });

  test("serializes overlapping switches through the earlier navigation rollback", async () => {
    const firstNavigation = deferred<boolean>();
    const navigating = deferred<void>();
    let blockFirst = true;
    const { app, auth, router, service, mutation, startAs } = await setup({
      canLeaveAdmin: () => {
        if (!blockFirst) return true;
        blockFirst = false;
        navigating.resolve(undefined);
        return firstNavigation.promise;
      },
    });
    await startAs(manager, "/admin/users");
    const firstResult = service.loginAs("driver").catch((error: unknown) => error);
    await navigating.promise;
    const second = service.loginAs("event_manager", { redirectTo: "/admin/series" });
    await Promise.resolve();
    expect(mutation).toHaveBeenCalledTimes(1);

    firstNavigation.resolve(false);
    expect(await firstResult).toEqual(new Error("Test mode sign-in navigation was cancelled"));
    await second;
    app.tick();
    expect(router.url).toBe("/admin/series");
    expectIdentity(auth, eventManager);
  });

  test("remounts the driver dashboard and tears down the old view on a same-route switch", async () => {
    const { app, auth, router, service, startAs, events } = await setup();
    await startAs(driver, "/driver-dashboard");
    const version = auth.sessionVersion();
    await service.loginAs("driver_2", { navigate: false });
    app.tick();

    expect(router.url).toBe("/driver-dashboard");
    expect(auth.sessionVersion()).toBe(version + 1);
    expectIdentity(auth, secondDriver);
    expect(events).toEqual([
      { phase: "init", path: "driver-dashboard", user: "driver" },
      { phase: "destroy", path: "driver-dashboard", user: "driver" },
      { phase: "init", path: "driver-dashboard", user: "driver_2" },
    ]);
  });

  test("remounts a reused parent when switching to an authorized sibling route", async () => {
    const { app, auth, router, service, startAs, events } = await setup();
    await startAs(manager, "/reviews/queue");
    const version = auth.sessionVersion();
    await service.loginAs("head_steward", { redirectTo: "/reviews/finalization" });
    app.tick();

    expect(router.url).toBe("/reviews/finalization");
    expect(auth.sessionVersion()).toBe(version + 1);
    expect(events.filter(({ path }) => path === "reviews")).toEqual([
      { phase: "init", path: "reviews", user: "league_manager" },
      { phase: "destroy", path: "reviews", user: "league_manager" },
      { phase: "init", path: "reviews", user: "head_steward" },
    ]);
  });

  test("reset waits for a pending switch before deciding which credentials to revoke", async () => {
    const navigation = deferred<boolean>();
    const navigating = deferred<void>();
    const { service, auth, router, startAs, mutation, setResetResult } = await setup({
      canLeaveAdmin: () => {
        navigating.resolve(undefined);
        return navigation.promise;
      },
    });
    await startAs(manager, "/admin/users");
    setResetResult({ revokedUserIds: [driver._id] });
    const switching = service.loginAs("driver");
    await navigating.promise;
    const resetting = service.reset({ includeUsers: true });
    await Promise.resolve();
    expect(mutation).toHaveBeenCalledTimes(1);

    navigation.resolve(true);
    await switching;
    await resetting;
    expect(router.url).toBe("/driver-dashboard");
    expect(auth.user()).toEqual(driver);
    expect(localStorage.getItem(userStorageKey())).toBe(driver._id);
    expect(sessionStorage.getItem(discordSessionKey())).toBeNull();
  });

  test("resolves leaf fallbacks and preserves parameters and query strings on allowed routes", () => {
    expect(resolveAuthorizedDestination(routes, "/reviews/finalization", "steward")).toBe("/reviews/queue");
    expect(resolveAuthorizedDestination(routes, "/reports/example/edit", "driver")).toBe("/driver-dashboard");
    const url = "/reports/example/edit?source=test%2F#details";
    expect(resolveAuthorizedDestination(routes, url, "league_manager")).toBe(url);
    expect(resolveAuthorizedDestination(routes, "/admin", "league_manager")).toBe("/driver-dashboard");
    expect(resolveAuthorizedDestination(routes, "/race-reviews", "league_manager")).toBe("/driver-dashboard");
  });

  test.each([
    "",
    "   ",
    "reports/new",
    "https://evil.com/reports/new",
    "//evil.com",
    "//reports/new",
    "/reports/new//extra",
    "/reports\\new",
    "/reports/new(aux:x)",
    "/reports/new\n",
    "/driver-dashboard?=ignored#top",
    "/driver-dashboard?a=1&=bad",
    "/driver-dashboard?a=1&",
    "/driver-dashboard?",
  ])("rejects malformed redirectTo %j before authenticating", async (redirectTo) => {
    const { service, mutation } = await setup();
    await expect(service.loginAs("driver", { redirectTo })).rejects.toThrow("redirectTo");
    expect(mutation).not.toHaveBeenCalled();
  });

  test("preserves valid query strings (including + and %2B), fragments, and trailing slashes on redirectTo", async () => {
    const { service, router, auth } = await setup();
    await service.loginAs("driver", { redirectTo: "/driver-dashboard?name=Jane+Doe&expr=1%2B1#top" });
    expect(router.url).toBe("/driver-dashboard?name=Jane%20Doe&expr=1%2B1#top");
    expect(router.routerState.snapshot.root.queryParams).toEqual({ name: "Jane Doe", expr: "1+1" });
    expect(router.routerState.snapshot.root.fragment).toBe("top");
    expectIdentity(auth, driver);

    await service.loginAs("driver_2", { redirectTo: "/driver-dashboard/" });
    expect(router.url).toBe("/driver-dashboard");
    expectIdentity(auth, secondDriver);
  });

  test("aborts a pending loginAs and cancels any queued loginAs when logout happens", async () => {
    const authResponse = deferred<{ user: typeof driver; sessionToken: string; expiresInSeconds: number; expiresAt: number }>();
    const authenticating = deferred<void>();
    const { service, auth, mutation, startAs } = await setup();
    await startAs(manager, "/admin/users");
    mutation.mockImplementationOnce(() => {
      authenticating.resolve(undefined);
      return authResponse.promise;
    });

    const first = service.loginAs("driver");
    await authenticating.promise;
    const second = service.loginAs("driver_2");
    auth.logout();
    authResponse.resolve({ user: driver, sessionToken: "token-driver", expiresInSeconds: 900, expiresAt: Date.now() + 900_000 });

    await expect(first).rejects.toThrow("superseded");
    await expect(second).rejects.toThrow("superseded");
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(auth.user()).toBeNull();
    expect(localStorage.getItem(userStorageKey())).toBeNull();
    expect(sessionStorage.getItem(discordSessionKey())).toBeNull();
  });

  test("does not restore an older session when logout occurs during a cancelled navigation", async () => {
    const navigation = deferred<boolean>();
    const navigating = deferred<void>();
    const { service, auth, startAs } = await setup({
      canLeaveAdmin: () => {
        navigating.resolve(undefined);
        return navigation.promise;
      },
    });
    await startAs(manager, "/admin/users");

    const pending = service.loginAs("driver");
    await navigating.promise;
    auth.logout();
    navigation.resolve(false);

    await expect(pending).rejects.toThrow("cancelled");
    expect(auth.user()).toBeNull();
    expect(localStorage.getItem(userStorageKey())).toBeNull();
    expect(sessionStorage.getItem(discordSessionKey())).toBeNull();
  });
});
