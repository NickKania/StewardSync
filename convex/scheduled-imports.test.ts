import { afterEach, describe, expect, it } from "bun:test";
import { getFunctionName } from "convex/server";
import { cancelScheduledDriverImport, scheduleDriverImport, importDriversFromSimGridInternal } from "./actions";
import { requireImportPermission } from "./auth";
import { getOrCreate } from "./driverClasses";
import { importOrUpdateDriver, markInactiveDrivers } from "./drivers";
import {
  cancelScheduledImport, runScheduledImport, scheduleImport, updateScheduleWithNewDates,
} from "./scheduledImports";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

function createScheduleAction(role = "league_manager", discordAccessToken = "oauth-token") {
  const writes: Array<{ name: string; args: unknown }> = [];
  globalThis.fetch = (async () => Response.json({ id: "discord-manager" })) as typeof fetch;
  const db = {
    get: async (id: string) => id === "manager"
      ? { discordId: "discord-manager", roleId: "role" }
      : { name: role },
  };
  const ctx = {
    runQuery: async (_reference: unknown, args: unknown) => {
      const query = requireImportPermission as unknown as {
        _handler: (context: { db: typeof db }, args: unknown) => Promise<null>;
      };
      return query._handler({ db }, args);
    },
    runMutation: async (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
      writes.push({ name: getFunctionName(reference), args });
      return { success: true, nextRun: 123 };
    },
  };
  return {
    writes,
    run: (registeredAction: unknown, scheduleArgs: Record<string, unknown>) => {
      const action = registeredAction as {
        _handler: (context: typeof ctx, args: unknown) => Promise<unknown>;
      };
      return action._handler(ctx, { currentUserId: "manager", discordAccessToken, ...scheduleArgs });
    },
  };
}

describe("Driver import scheduling authorization", () => {
  const scheduleArgs = { seriesId: "series-1", scheduledImportTime: "09:00", scheduledImportDays: [1] };

  for (const [name, action, args] of [
    ["create", scheduleDriverImport, scheduleArgs],
    ["cancel", cancelScheduledDriverImport, { seriesId: "series-1" }],
  ] as const) {
    it(`rejects unauthenticated schedule ${name} requests`, async () => {
      const test = createScheduleAction("league_manager", "");
      await expect(test.run(action, args)).rejects.toThrow("sign in with Discord");
      expect(test.writes).toEqual([]);
    });

    it(`rejects schedule ${name} requests from non-league managers`, async () => {
      const test = createScheduleAction("event_manager");
      await expect(test.run(action, args)).rejects.toThrow("Unauthorized");
      expect(test.writes).toEqual([]);
    });
  }

  it("allows verified league managers to schedule without forwarding the OAuth credential", async () => {
    const test = createScheduleAction();
    await test.run(scheduleDriverImport, scheduleArgs);
    expect(test.writes).toEqual([{
      name: "scheduledImports:scheduleImport",
      args: { currentUserId: "manager", ...scheduleArgs },
    }]);
  });

  it("allows verified league managers to cancel schedules", async () => {
    const test = createScheduleAction();
    await test.run(cancelScheduledDriverImport, { seriesId: "series-1" });
    expect(test.writes).toEqual([{
      name: "scheduledImports:cancelScheduledImport",
      args: { currentUserId: "manager", seriesId: "series-1" },
    }]);
  });

  it("keeps roster writes, schedule writes, and automated imports inaccessible to clients", () => {
    for (const registeredFunction of [
      importOrUpdateDriver, markInactiveDrivers, getOrCreate,
      scheduleImport, cancelScheduledImport, updateScheduleWithNewDates,
      runScheduledImport, importDriversFromSimGridInternal,
    ]) {
      expect((registeredFunction as unknown as { isInternal: boolean }).isInternal).toBe(true);
    }
  });

  it("routes a scheduled job through the internal import entry point", async () => {
    const actions: Array<{ name: string; args: unknown }> = [];
    const ctx = {
      runQuery: async () => ({
        isScheduledImportActive: true, simgridLink: "https://www.thesimgrid.com/championship/123",
      }),
      runAction: async (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
        actions.push({ name: getFunctionName(reference), args });
        return { success: true };
      },
    };
    const job = runScheduledImport as unknown as {
      _handler: (context: typeof ctx, args: unknown) => Promise<void>;
    };
    await job._handler(ctx, { seriesId: "series-1", expectedRunTime: Date.now() });
    expect(actions).toEqual([{
      name: "actions:importDriversFromSimGridInternal",
      args: { championshipId: "series-1", simgridChampionshipId: "123" },
    }]);
  });
});
