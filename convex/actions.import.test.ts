import { afterEach, describe, expect, it } from "bun:test";
import { getFunctionName } from "convex/server";
import { importDriversFromSimGrid, importDriversFromSimGridInternal } from "./actions";
import { requireImportPermission } from "./auth";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env["SIMGRID_API_KEY"];
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env["SIMGRID_API_KEY"];
  else process.env["SIMGRID_API_KEY"] = originalApiKey;
});

interface ImportOptions {
  discordUnavailable?: boolean;
  discordAccessToken?: string;
  discordId?: string;
  role?: string;
  invalidToken?: boolean;
  scheduled?: boolean;
}

function createImport(options: ImportOptions = {}) {
  process.env["SIMGRID_API_KEY"] = "test-key";
  const requests: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    requests.push(url);
    if (url.includes("discord.com")) {
      return options.invalidToken
        ? new Response(null, { status: 401 })
        : Response.json({ id: options.discordId ?? "discord-manager" });
    }
    return new Response([
      "username,real name,car number", "jane,Jane Smith,12", "john,John Smith,34",
    ].join("\n"));
  }) as typeof fetch;
  const calls: Array<{ name: string; args: unknown }> = [];
  const nicknameSync = { updated: 1, unchanged: 1, skipped: 0, failed: 0, errors: [] };
  const db = {
    get: async (id: string) => id === "manager"
      ? { discordId: "discord-manager", roleId: "role" }
      : { name: options.role ?? "league_manager" },
  };
  const ctx = {
    runQuery: async (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
      calls.push({ name: getFunctionName(reference), args });
      const query = requireImportPermission as unknown as {
        _handler: (context: { db: typeof db }, args: unknown) => Promise<null>;
      };
      return query._handler({ db }, args);
    },
    runMutation: async (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
      const name = getFunctionName(reference);
      calls.push({ name, args });
      return name === "drivers:markInactiveDrivers"
        ? { markedInactive: 1 }
        : { action: "updated", driverId: `driver-${calls.filter((call) => call.name === name).length}` };
    },
    runAction: async (reference: Parameters<typeof getFunctionName>[0], args: unknown): Promise<unknown> => {
      const name = getFunctionName(reference);
      calls.push({ name, args });
      if (name === "actions:importDriversFromSimGridInternal") {
        return invoke(importDriversFromSimGridInternal, args);
      }
      if (options.discordUnavailable) throw new Error("Discord unavailable");
      return nicknameSync;
    },
  };
  function invoke(registeredAction: unknown, args: unknown): Promise<Record<string, unknown>> {
    const action = registeredAction as {
      _handler: (context: typeof ctx, args: unknown) => Promise<Record<string, unknown>>;
    };
    return action._handler(ctx, args);
  }
  return {
    calls, requests, nicknameSync,
    run: () => invoke(options.scheduled ? importDriversFromSimGridInternal : importDriversFromSimGrid, {
      championshipId: "series-1", simgridChampionshipId: "123",
      ...(options.scheduled ? {} : {
        currentUserId: "manager", discordAccessToken: options.discordAccessToken ?? "oauth-token",
      }),
    }),
  };
}

describe("Driver import Discord integration", () => {
  it("rejects manual imports without a Discord credential before any side effect", async () => {
    const test = createImport({ discordAccessToken: "" });
    await expect(test.run()).rejects.toThrow("sign in with Discord");
    expect(test.requests).toEqual([]);
    expect(test.calls).toEqual([]);
  });

  it("rejects expired credentials before reading the roster or importing", async () => {
    const test = createImport({ invalidToken: true });
    await expect(test.run()).rejects.toThrow("Discord authentication failed");
    expect(test.requests).toEqual(["https://discord.com/api/v10/users/@me"]);
    expect(test.calls).toEqual([]);
  });

  it("rejects a spoofed league-manager ID even with a valid Discord token", async () => {
    const test = createImport({ discordId: "discord-driver" });
    await expect(test.run()).rejects.toThrow("identity does not match");
    expect(test.calls.map((call) => call.name)).toEqual(["auth:requireImportPermission"]);
    expect(test.requests).toHaveLength(1);
  });

  for (const role of ["driver", "steward", "head_steward"]) {
    it(`rejects a verified ${role} before importing or renaming`, async () => {
      const test = createImport({ role });
      await expect(test.run()).rejects.toThrow("Unauthorized");
      expect(test.calls.map((call) => call.name)).toEqual(["auth:requireImportPermission"]);
      expect(test.requests).toHaveLength(1);
    });
  }

  it("allows verified event managers to import", async () => {
    const test = createImport({ role: "event_manager" });
    const result = await test.run();
    expect(result["success"]).toBe(true);
  });

  it("verifies league managers, then syncs once after all roster updates", async () => {
    const test = createImport();
    const result = await test.run();
    expect(test.calls.map((call) => call.name)).toEqual([
      "auth:requireImportPermission", "actions:importDriversFromSimGridInternal",
      "drivers:importOrUpdateDriver", "drivers:importOrUpdateDriver",
      "drivers:markInactiveDrivers", "driverNicknameDiscord:syncForSeries",
    ]);
    expect(test.calls[1].args).toEqual({ championshipId: "series-1", simgridChampionshipId: "123", changedByUserId: "manager" });
    expect(test.calls[4].args).toEqual({ championshipId: "series-1", activeDriverIds: ["driver-1", "driver-2"] });
    expect(test.calls[5].args).toEqual({ championshipId: "series-1", changedByUserId: "manager" });
    expect(result["success"]).toBe(true);
    expect(result["nicknameSync"]).toEqual(test.nicknameSync);
  });

  it("allows internal scheduled imports without an interactive Discord credential", async () => {
    const test = createImport({ scheduled: true });
    expect((await test.run())["success"]).toBe(true);
    expect(test.requests).toHaveLength(1);
    expect(test.requests[0]).toContain("thesimgrid.com");
    expect(test.calls.at(-1)?.name).toBe("driverNicknameDiscord:syncForSeries");
  });

  it("preserves a successful roster import when Discord sync cannot run", async () => {
    const result = await createImport({ discordUnavailable: true }).run();
    expect(result["success"]).toBe(true);
    expect(result["imported"]).toBe(2);
    expect(result["nicknameSync"]).toMatchObject({
      failed: 1, errors: ["Discord nickname sync could not run: Discord unavailable"],
    });
  });
});
