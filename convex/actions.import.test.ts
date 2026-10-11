import { afterEach, describe, expect, it } from "bun:test";
import { getFunctionName } from "convex/server";
import { importDriversFromSimGrid } from "./actions";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env["SIMGRID_API_KEY"];
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env["SIMGRID_API_KEY"];
  else process.env["SIMGRID_API_KEY"] = originalApiKey;
});

async function runImport(discordUnavailable = false) {
  process.env["SIMGRID_API_KEY"] = "test-key";
  globalThis.fetch = (async () => new Response([
    "username,real name,car number",
    "jane,Jane Smith,12",
    "john,John Smith,34",
  ].join("\n"))) as typeof fetch;
  const calls: Array<{ name: string; args: unknown }> = [];
  const nicknameSync = { updated: 1, unchanged: 1, skipped: 0, failed: 0, errors: [] };
  const ctx = {
    runMutation: async (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
      const name = getFunctionName(reference);
      calls.push({ name, args });
      return name === "drivers:markInactiveDrivers"
        ? { markedInactive: 1 }
        : { action: "updated", driverId: `driver-${calls.length}` };
    },
    runAction: async (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
      calls.push({ name: getFunctionName(reference), args });
      if (discordUnavailable) throw new Error("Discord unavailable");
      return nicknameSync;
    },
  };
  const action = importDriversFromSimGrid as unknown as {
    _handler: (context: typeof ctx, args: {
      championshipId: string; simgridChampionshipId: string;
    }) => Promise<Record<string, unknown>>;
  };
  const result = await action._handler(ctx, { championshipId: "series-1", simgridChampionshipId: "123" });
  return { result, calls, nicknameSync };
}

describe("Driver import Discord integration", () => {
  it("syncs once after all imports and inactive-driver updates", async () => {
    const { result, calls, nicknameSync } = await runImport();
    expect(calls.map((call) => call.name)).toEqual([
      "drivers:importOrUpdateDriver", "drivers:importOrUpdateDriver",
      "drivers:markInactiveDrivers", "driverNicknameDiscord:syncForSeries",
    ]);
    expect(calls[2].args).toEqual({ championshipId: "series-1", activeDriverIds: ["driver-1", "driver-2"] });
    expect(calls[3].args).toEqual({ championshipId: "series-1" });
    expect(result["success"]).toBe(true);
    expect(result["nicknameSync"]).toEqual(nicknameSync);
  });

  it("preserves a successful roster import when Discord sync cannot run", async () => {
    const { result } = await runImport(true);
    expect(result["success"]).toBe(true);
    expect(result["imported"]).toBe(2);
    expect(result["nicknameSync"]).toMatchObject({
      failed: 1, errors: ["Discord nickname sync could not run: Discord unavailable"],
    });
  });
});
