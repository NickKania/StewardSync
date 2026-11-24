import { describe, expect, it } from "bun:test";
import { authorizeSimGridImport } from "./actions";
import { create as createDriver } from "./drivers";
import { create, createBySteward, finalize, markAsReviewed, reject } from "./reports";
import { create as createReview, remove, update, updateWithSecondSteward } from "./reviews";
import { cancelScheduledImport, scheduleImport, updateScheduleWithNewDates } from "./scheduledImports";

function fixture(role: string) {
  const writes: string[] = [];
  const ctx = {
    db: {
      get: async (id: string) => {
        switch (id) {
          case "actor": return { roleId: "role" };
          case "role": return { name: role };
          case "review": return { userId: "author", reportId: "report" };
          case "report": return { isFinalized: false };
          case "series": return { isScheduledImportActive: true };
          default: return null;
        }
      },
      patch: async (id: string) => { writes.push(id); },
      delete: async (id: string) => { writes.push(id); },
      insert: async (table: string) => {
        writes.push(table);
        return "new-driver";
      },
    },
  };
  return { ctx, writes };
}

function invoke(endpoint: unknown, ctx: ReturnType<typeof fixture>["ctx"], args: Record<string, unknown>) {
  const { _handler } = endpoint as {
    _handler: (context: typeof ctx, args: Record<string, unknown>) => Promise<unknown>;
  };
  return _handler(ctx, args);
}

describe("mutation and import authorization", () => {
  const actorArgs = {
    currentUserId: "actor",
    userId: "actor",
    reportingUserId: "actor",
    reportId: "report",
    reviewId: "review",
  };

  for (const [name, endpoint] of Object.entries({
    createBySteward, finalize, markAsReviewed, reject, createReview, remove,
    update, updateWithSecondSteward, createDriver, scheduleImport,
    cancelScheduledImport, updateScheduleWithNewDates, authorizeSimGridImport,
  })) {
    it(`rejects a driver calling ${name} before writing`, async () => {
      const { ctx, writes } = fixture("driver");
      await expect(invoke(endpoint, ctx, actorArgs)).rejects.toThrow("Unauthorized");
      expect(writes).toEqual([]);
    });
  }

  it("requires the reporting user to exist", async () => {
    const { ctx, writes } = fixture("driver");
    await expect(invoke(create, ctx, { reportingUserId: "missing" })).rejects.toThrow("User not found");
    expect(writes).toEqual([]);
  });

  for (const [name, endpoint] of Object.entries({ remove, update, updateWithSecondSteward })) {
    it(`rejects a non-author steward calling ${name}`, async () => {
      const { ctx, writes } = fixture("steward");
      await expect(invoke(endpoint, ctx, actorArgs)).rejects.toThrow("Unauthorized");
      expect(writes).toEqual([]);
    });
  }

  it("allows a head steward to reject a report and remove another steward's review", async () => {
    const { ctx, writes } = fixture("head_steward");
    await expect(invoke(reject, ctx, { ...actorArgs, finalDecision: "Duplicate report" }))
      .resolves.toEqual({ success: true, data: "report" });
    await invoke(remove, ctx, actorArgs);
    expect(writes).toEqual(["report", "review"]);
  });

  it("allows an event manager to authorize imports and create a driver", async () => {
    const { ctx, writes } = fixture("event_manager");
    await invoke(authorizeSimGridImport, ctx, actorArgs);
    await expect(invoke(createDriver, ctx, { ...actorArgs, driverName: "Test Driver" }))
      .resolves.toBe("new-driver");
    await expect(invoke(cancelScheduledImport, ctx, { ...actorArgs, seriesId: "series" }))
      .resolves.toEqual({ success: true });
    expect(writes).toEqual(["drivers", "series"]);
  });

  for (const [name, endpoint] of Object.entries({
    createBySteward, finalize, markAsReviewed, reject, createReview, remove,
    update, updateWithSecondSteward,
  })) {
    it(`rejects an event manager calling steward/finalization mutation ${name}`, async () => {
      const { ctx, writes } = fixture("event_manager");
      await expect(invoke(endpoint, ctx, actorArgs)).rejects.toThrow("Unauthorized");
      expect(writes).toEqual([]);
    });
  }
});
