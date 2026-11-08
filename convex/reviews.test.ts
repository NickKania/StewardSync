import { describe, expect, it } from "bun:test";
import { correctVerified } from "./reviews";
import { getById, list } from "./reports";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

function fixture(role = "league_manager", joint = false) {
  const review = {
    _id: "review", userId: "steward", reportId: "report", incidentDescription: "Original description",
    atFaultDriverId: "driver", isNoDriverAtFault: false, recommendedPenalty: "penalty",
    reviewNotes: "Private notes", reviewDate: 123, createdAt: 123, updatedAt: 123,
    ...(joint ? { linkedReviewId: "linked" } : {}),
  };
  const documents = new Map<string, Record<string, unknown>>([
    ["manager", { roleId: "role" }], ["role", { name: role }],
    ["review", review], ["report", { _id: "report", eventId: "event", isFinalized: true, finalDecision: "Final ruling", atFaultDriverId: "driver" }],
    ["event", { seriesId: "series" }],
    ["driver", { championshipId: "series" }], ["otherDriver", { championshipId: "series" }],
    ["wrongSeriesDriver", { championshipId: "otherSeries" }], ["penalty", { allowNoDriverAtFault: true }],
  ]);
  if (joint) documents.set("linked", { ...review, _id: "linked", userId: "secondSteward", linkedReviewId: "review" });
  const changes: Record<string, unknown>[] = [];
  const ctx = {
    db: {
      get: async (id: string) => documents.get(id) ?? null,
      normalizeId: (_table: string, id: string) => documents.has(id) ? id : null,
      query: (table: string) => ({
        withIndex: () => ({ collect: async () => [documents.get("review")] }),
        order: () => ({ collect: async () => table === "reports" ? [documents.get("report")] : [] }),
      }),
      patch: async (id: string, updates: Record<string, unknown>) => Object.assign(documents.get(id)!, updates),
      insert: async (_table: string, data: Record<string, unknown>) => { changes.push(data); return "audit"; },
    },
  } as unknown as MutationCtx;
  const args = {
    currentUserId: "manager" as Id<"users">, reviewId: "review" as Id<"reviews">,
    incidentDescription: "Corrected description", atFaultDriverId: "otherDriver" as Id<"drivers">,
    isNoDriverAtFault: false,
  };
  return { ctx, args, documents, changes, save: () => correctVerified._handler(ctx, args) };
}

describe("league manager review corrections", () => {
  for (const role of ["driver", "steward", "head_steward", "event_manager"]) {
    it(`rejects ${role} without changing the review`, async () => {
      const state = fixture(role);
      await expect(state.save()).rejects.toThrow("Unauthorized");
      expect(state.documents.get("review")?.incidentDescription).toBe("Original description");
      expect(state.changes).toHaveLength(0);
    });
  }

  it("corrects another steward's finalized review, preserving authorship and the final ruling", async () => {
    const state = fixture();
    expect(await state.save()).toEqual({ success: true, data: "review" });
    expect(state.documents.get("review")).toMatchObject({
      userId: "steward", reviewDate: 123, createdAt: 123, reviewNotes: "Private notes",
      incidentDescription: "Corrected description", atFaultDriverId: "otherDriver",
    });
    expect(state.documents.get("report")).toMatchObject({ finalDecision: "Final ruling", atFaultDriverId: "driver" });
    expect(state.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ fieldName: "incidentDescription", fromValue: "Original description", toValue: "Corrected description", changedByUserId: "manager" }),
      expect.objectContaining({ fieldName: "atFaultDriverId", fromValue: "driver", toValue: "otherDriver", changedByUserId: "manager" }),
    ]));
  });

  it("corrects both joint review records and audits both", async () => {
    const state = fixture("league_manager", true);
    await state.save();
    expect(state.documents.get("linked")).toMatchObject({
      userId: "secondSteward", linkedReviewId: "review", incidentDescription: "Corrected description", atFaultDriverId: "otherDriver",
    });
    expect(state.changes.filter(change => change.documentId === "linked")).toHaveLength(2);
  });

  it("keeps a finalized No Driver ruling independent of corrected review drivers", async () => {
    const state = fixture();
    Object.assign(state.documents.get("report")!, { atFaultDriverId: undefined, isNoDriverAtFault: true });
    await state.save();
    const result = await getById._handler(state.ctx as unknown as QueryCtx, { reportId: "report" as Id<"reports"> });
    expect(result?.atFaultDriver).toBeNull();
    expect(result?.reviews[0].atFaultDriver).toMatchObject({ championshipId: "series" });
    expect(result?.reviews[0].atFaultDriverId).toBe("otherDriver");
  });

  it("keeps the report list consistent with finalized No Driver decisions", async () => {
    const state = fixture();
    Object.assign(state.documents.get("report")!, { atFaultDriverId: undefined, isNoDriverAtFault: true });
    await state.save();
    const result = await list._handler(state.ctx as unknown as QueryCtx, {});
    expect(result[0].atFaultDriver).toBeNull();
    expect(result[0].isNoDriverAtFault).toBe(true);
  });

  it("preserves an explicitly stored finalized driver over the corrected review driver", async () => {
    const state = fixture();
    state.documents.get("driver")!.driverName = "Final ruling driver";
    state.documents.get("otherDriver")!.driverName = "Corrected assessment driver";
    await state.save();
    const detail = await getById._handler(state.ctx as unknown as QueryCtx, { reportId: "report" as Id<"reports"> });
    const reports = await list._handler(state.ctx as unknown as QueryCtx, {});
    expect(detail?.atFaultDriver?.driverName).toBe("Final ruling driver");
    expect(reports[0].atFaultDriver?.driverName).toBe("Final ruling driver");
  });

  for (const status of ["finalized", "rejected"]) {
    it(`retains the latest review driver for legacy ${status} reports without outcome fields`, async () => {
      const state = fixture();
      const report = state.documents.get("report")!;
      Object.assign(report, { status, atFaultDriverId: undefined });
      delete report.isNoDriverAtFault;
      const detail = await getById._handler(state.ctx as unknown as QueryCtx, { reportId: "report" as Id<"reports"> });
      const reports = await list._handler(state.ctx as unknown as QueryCtx, {});
      expect(detail?.atFaultDriver).toMatchObject({ championshipId: "series" });
      expect(reports[0].atFaultDriver).toMatchObject({ championshipId: "series" });
    });
  }

  it("retains the review-driver fallback for unfinalized reports", async () => {
    const state = fixture();
    Object.assign(state.documents.get("report")!, { atFaultDriverId: undefined, isFinalized: false });
    const result = await getById._handler(state.ctx as unknown as QueryCtx, { reportId: "report" as Id<"reports"> });
    expect(result?.atFaultDriver).toMatchObject({ championshipId: "series" });
  });

  it("clears the driver for a permitted No Driver correction", async () => {
    const state = fixture("league_manager", true);
    state.args.isNoDriverAtFault = true;
    await state.save();
    for (const id of ["review", "linked"]) {
      expect(state.documents.get(id)?.atFaultDriverId).toBeUndefined();
      expect(state.documents.get(id)?.isNoDriverAtFault).toBe(true);
    }
  });

  it("rejects No Driver when either joint review penalty requires a driver", async () => {
    const state = fixture("league_manager", true);
    state.documents.get("linked")!.recommendedPenalty = "missingPenalty";
    state.args.isNoDriverAtFault = true;
    expect(await state.save()).toMatchObject({ success: false });
    expect(state.documents.get("review")?.atFaultDriverId).toBe("driver");
    expect(state.changes).toHaveLength(0);
  });

  it("rejects drivers from another series", async () => {
    const state = fixture();
    state.args.atFaultDriverId = "wrongSeriesDriver" as Id<"drivers">;
    expect(await state.save()).toMatchObject({ success: false, error: "At-fault driver must belong to the report event's series" });
    expect(state.changes).toHaveLength(0);
  });

  it("rejects blank descriptions and missing drivers", async () => {
    const state = fixture();
    state.args.incidentDescription = "   ";
    expect(await state.save()).toMatchObject({ success: false, error: "Incident description is required" });
    expect(await correctVerified._handler(state.ctx, { ...state.args, incidentDescription: "Description", atFaultDriverId: undefined })).toMatchObject({ success: false, error: "Select an at-fault driver" });
    expect(state.changes).toHaveLength(0);
  });

  it("rejects missing reviews, reports, and invalid joint links", async () => {
    const state = fixture("league_manager", true);
    state.documents.get("linked")!.reportId = "otherReport";
    expect(await state.save()).toMatchObject({ success: false });
    state.documents.delete("report");
    await expect(state.save()).rejects.toThrow("Report not found");
    state.documents.delete("review");
    await expect(state.save()).rejects.toThrow("Review not found");
  });

  it("does not add audit noise for unchanged values", async () => {
    const state = fixture();
    state.args.incidentDescription = "Original description";
    state.args.atFaultDriverId = "driver" as Id<"drivers">;
    await state.save();
    expect(state.changes).toHaveLength(0);
    expect(state.documents.get("review")?.updatedAt).toBe(123);
  });
});
