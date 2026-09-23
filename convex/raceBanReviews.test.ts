import { describe, expect, it } from "bun:test";
import { forceCompleteForPenalty, markCompleted } from "./raceBanReviews";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const managerId = "manager" as Id<"users">;
const penaltyId = "penalty" as Id<"driverSeriesPenalties">;
const reviewId = "review" as Id<"raceBanReviews">;

function fixture(options: {
  role?: string;
  requiresReview?: boolean;
  existingReview?: boolean;
  reviewStatus?: "open" | "scheduled" | "completed";
} = {}) {
  const documents = new Map<string, Record<string, unknown>>([
    [managerId, { _id: managerId, roleId: "role" }],
    ["role", { _id: "role", name: options.role ?? "league_manager" }],
    [penaltyId, {
      _id: penaltyId,
      driverId: "driver",
      seriesId: "series",
      seriesPenaltyId: "seriesPenalty",
      seriesPenaltyThresholdId: "threshold",
      requiresReview: options.requiresReview ?? true,
      ...(options.existingReview ? { raceBanReviewId: reviewId } : {}),
    }],
    ["driver", { _id: "driver", driverName: "Driver" }],
    ["threshold", { _id: "threshold", requiresReview: true }],
  ]);
  if (options.existingReview) {
    const reviewStatus = options.reviewStatus ?? "scheduled";
    documents.set(reviewId, {
      _id: reviewId,
      driverSeriesPenaltyId: penaltyId,
      status: reviewStatus,
      userId: "requester",
      ...(reviewStatus === "scheduled" ? {
        meetingReminderJobId: "reminder",
        meetingThreadId: "thread",
      } : {}),
    });
  }

  const canceled: string[] = [];
  const scheduled: Array<{ name: string; args: Record<string, unknown> }> = [];
  let inserts = 0;
  const ctx = {
    db: {
      get: async (id: string) => documents.get(id) ?? null,
      patch: async (id: string, changes: Record<string, unknown>) => {
        const document = documents.get(id);
        if (!document) throw new Error(`Missing document: ${id}`);
        Object.assign(document, changes);
      },
      insert: async (_table: string, document: Record<string, unknown>) => {
        inserts += 1;
        documents.set(reviewId, { _id: reviewId, ...document });
        return reviewId;
      },
      query: () => ({
        withIndex: () => ({ first: async () => null }),
      }),
    },
    scheduler: {
      cancel: async (id: string) => { canceled.push(id); },
      runAfter: async (_delay: number, name: string, args: Record<string, unknown>) => {
        scheduled.push({ name, args });
      },
    },
  } as unknown as MutationCtx;

  const complete = () => forceCompleteForPenalty._handler(ctx, {
    currentUserId: managerId,
    driverSeriesPenaltyId: penaltyId,
  });

  const completeNormally = () => markCompleted._handler(ctx, {
    id: reviewId,
    completedBy: managerId,
  });

  return { complete, completeNormally, documents, canceled, scheduled, get inserts() { return inserts; } };
}

describe("forceCompleteForPenalty", () => {
  it("creates a completed review when the driver never submitted a request", async () => {
    const state = fixture();

    expect(await state.complete()).toBe(reviewId);
    expect(state.inserts).toBe(1);
    expect(state.documents.get(penaltyId)?.raceBanReviewId).toBe(reviewId);
    expect(state.documents.get(reviewId)).toMatchObject({
      status: "completed",
      completedBy: managerId,
      manuallyCompleted: true,
      availabilityWindows: [],
    });
    expect(state.documents.get(reviewId)?.userId).toBeUndefined();
  });

  it("completes an existing request and cancels its reminder", async () => {
    const state = fixture({ existingReview: true });

    expect(await state.complete()).toBe(reviewId);
    expect(state.inserts).toBe(0);
    expect(state.documents.get(reviewId)).toMatchObject({
      status: "completed",
      userId: "requester",
      completedBy: managerId,
      manuallyCompleted: true,
    });
    expect(state.canceled).toEqual(["reminder"]);
    expect(state.scheduled).toEqual([{
      name: "raceBanReviewDiscord:closeMeetingThread",
      args: { id: reviewId },
    }]);
  });

  it("completes an unscheduled request without creating a meeting", async () => {
    const state = fixture({ existingReview: true, reviewStatus: "open" });

    await state.complete();
    expect(state.documents.get(reviewId)?.status).toBe("completed");
    expect(state.canceled).toEqual([]);
    expect(state.scheduled).toEqual([]);
  });

  it("preserves the ordinary completion path for an existing request", async () => {
    const state = fixture({ existingReview: true });

    await state.completeNormally();
    expect(state.documents.get(reviewId)).toMatchObject({
      status: "completed",
      completedBy: managerId,
      manuallyCompleted: false,
    });
    expect(state.canceled).toEqual(["reminder"]);
    expect(state.scheduled).toHaveLength(1);
  });

  it("rejects non-managers and leaves the penalty unchanged", async () => {
    const state = fixture({ role: "head_steward" });

    await expect(state.complete()).rejects.toThrow("Unauthorized");
    expect(state.inserts).toBe(0);
    expect(state.documents.get(penaltyId)?.raceBanReviewId).toBeUndefined();
  });

  it("rejects penalties without a review requirement and completed reviews", async () => {
    const unneeded = fixture({ requiresReview: false });
    await expect(unneeded.complete()).rejects.toThrow("does not require a race review");

    const completed = fixture({ existingReview: true, reviewStatus: "completed" });
    await expect(completed.complete()).rejects.toThrow("already completed");
  });
});
