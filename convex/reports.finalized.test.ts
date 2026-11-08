import { describe, expect, it } from "bun:test";
import { updateFinalizedDetailsVerified } from "./reports";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

function fixture(role = "league_manager") {
  const documents = new Map<string, Record<string, unknown>>([
    ["manager", { roleId: "role" }], ["role", { name: role }],
    ["report", {
      _id: "report", eventId: "event", raceId: "race", reportedDriverId: "driver", reportingUserId: "author",
      isFinalized: true, status: "finalized", finalDecision: "Original ruling", appliedPenalty: "penalty",
      atFaultDriverId: "driver", finalizedBy: "finalizer", finalizedAt: 100,
      lap: "1", turn: "2", description: "Original incident description", videoLink: "old-video", videoTimestamp: "00:01", updatedAt: 100,
    }],
    ["event", { seriesId: "series" }], ["series", { requireVideoEvidence: true, isReportingLocked: true }],
  ]);
  const audit: Record<string, unknown>[] = [];
  const ctx = {
    db: {
      get: async (id: string) => documents.get(id) ?? null,
      patch: async (id: string, updates: Record<string, unknown>) => Object.assign(documents.get(id)!, updates),
      insert: async (_table: string, data: Record<string, unknown>) => { audit.push(data); return "history"; },
    },
  } as unknown as MutationCtx;
  const args = {
    currentUserId: "manager" as Id<"users">, reportId: "report" as Id<"reports">,
    lap: "3", turn: "4", description: "Corrected finalized incident description", videoLink: "https://example.com/evidence", videoTimestamp: "00:25",
  };
  return { documents, audit, args, ctx, save: () => updateFinalizedDetailsVerified._handler(ctx, args) };
}

describe("finalized report detail corrections", () => {
  it("allows league managers to correct locked historical reports without changing the ruling", async () => {
    const state = fixture();
    expect(await state.save()).toBe("report");
    expect(state.documents.get("report")).toMatchObject({
      lap: "3", turn: "4", description: state.args.description, videoLink: state.args.videoLink, videoTimestamp: "00:25",
      isFinalized: true, status: "finalized", finalDecision: "Original ruling", appliedPenalty: "penalty",
      atFaultDriverId: "driver", eventId: "event", raceId: "race", reportedDriverId: "driver",
      reportingUserId: "author", finalizedBy: "finalizer", finalizedAt: 100,
    });
    expect(state.audit).toHaveLength(5);
    expect(state.audit).toContainEqual(expect.objectContaining({
      tableName: "reports", documentId: "report", fieldName: "description", fromValue: "Original incident description", toValue: state.args.description, changedByUserId: "manager",
    }));
  });

  for (const role of ["driver", "steward", "head_steward", "event_manager"]) {
    it(`denies ${role} before any writes`, async () => {
      const state = fixture(role);
      await expect(state.save()).rejects.toThrow("Unauthorized");
      expect(state.audit).toHaveLength(0);
      expect(state.documents.get("report")?.description).toBe("Original incident description");
    });
  }

  it("requires a finalized report", async () => {
    const state = fixture();
    state.documents.get("report")!.isFinalized = false;
    await expect(state.save()).rejects.toThrow("standard editor");
    expect(state.audit).toHaveLength(0);
  });

  it("rejects missing reports, events, and series", async () => {
    for (const [id, message] of [["report", "Report not found"], ["event", "Event not found"], ["series", "Series not found"]]) {
      const state = fixture();
      state.documents.delete(id);
      await expect(state.save()).rejects.toThrow(message);
      expect(state.audit).toHaveLength(0);
    }
  });

  it("rejects blank location, short descriptions, and missing required evidence", async () => {
    for (const update of [{ lap: " " }, { turn: " " }, { description: "short" }, { videoLink: " " }, { videoTimestamp: " " }]) {
      const state = fixture();
      Object.assign(state.args, update);
      await expect(state.save()).rejects.toThrow();
      expect(state.audit).toHaveLength(0);
    }
  });

  it("trims corrections and allows clearing optional evidence", async () => {
    const state = fixture();
    state.documents.get("series")!.requireVideoEvidence = false;
    Object.assign(state.args, { lap: " 3 ", turn: " 4 ", videoLink: " ", videoTimestamp: " " });
    await state.save();
    expect(state.documents.get("report")).toMatchObject({ lap: "3", turn: "4", videoLink: "", videoTimestamp: "" });
  });

  it("does not audit or update timestamps when nothing changes", async () => {
    const state = fixture();
    Object.assign(state.args, { lap: "1", turn: "2", description: "Original incident description", videoLink: "old-video", videoTimestamp: "00:01" });
    await state.save();
    expect(state.audit).toHaveLength(0);
    expect(state.documents.get("report")?.updatedAt).toBe(100);
  });
});
