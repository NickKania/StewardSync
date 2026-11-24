import type { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

export { getReportingWindow } from "./reportingWindow";

/**
 * Checks if a user is involved in a report
 * @param ctx - Convex context
 * @param userId - The user ID to check
 * @param report - The report document to check against
 * @returns Object with conflict information
 */
export async function checkUserDriverConflict(
  ctx: QueryCtx,
  userId: Id<"users">,
  report: Doc<"reports">
): Promise<{
  hasConflict: boolean;
  conflictType: "reporting_user" | "reporting_driver" | "reported_driver" | null;
  driverName?: string;
}> {
  const userIdStr = String(userId);

  // Check if user is the reporting user
  if (report.reportingUserId && String(report.reportingUserId) === userIdStr) {
    return {
      hasConflict: true,
      conflictType: "reporting_user",
    };
  }

  // Check if user is linked to the reporting driver
  if (report.reportingDriverId) {
    const reportingDriver = await ctx.db.get(report.reportingDriverId);
    if (reportingDriver?.userId && String(reportingDriver.userId) === userIdStr) {
      return {
        hasConflict: true,
        conflictType: "reporting_driver",
        driverName: reportingDriver.driverName,
      };
    }
  }

  // Check if user is the reported driver
  const driversLinkedToUser = await ctx.db
    .query("drivers")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .collect();

  const driverIds = driversLinkedToUser.map((d) => d._id);

  if (driverIds.some((id) => String(id) === String(report.reportedDriverId))) {
    const driver = driversLinkedToUser.find((d) => String(d._id) === String(report.reportedDriverId));
    return {
      hasConflict: true,
      conflictType: "reported_driver",
      driverName: driver?.driverName,
    };
  }

  return { hasConflict: false, conflictType: null };
}

/**
 * Whether a review assessed the report's current reported driver. Used only
 * to pick accurate latest-review defaults; all reviews still count toward
 * readiness. Reviews created before reported-driver edits existed have no
 * assessedReportedDriverId; reports.update backfills that provenance with
 * the previous driver when the target changes, so a missing value means the
 * target has not changed since the review was written.
 */
export function isReviewForCurrentTarget(
  review: { assessedReportedDriverId?: unknown },
  report: { reportedDriverId: unknown },
): boolean {
  return (
    review.assessedReportedDriverId === undefined ||
    String(review.assessedReportedDriverId) === String(report.reportedDriverId)
  );
}

export function latestReviewForCurrentTarget(
  reviews: Doc<"reviews">[],
  report: { reportedDriverId: unknown },
): Doc<"reviews"> | null {
  const current = reviews.filter((review) =>
    isReviewForCurrentTarget(review, report),
  );
  if (current.length === 0) return null;
  return current.reduce((latest, review) => {
    const latestDate = latest.reviewDate || latest.createdAt || 0;
    const currentDate = review.reviewDate || review.createdAt || 0;
    return currentDate > latestDate ? review : latest;
  });
}

export async function listReviewsForCurrentTarget(
  ctx: QueryCtx,
  report: Doc<"reports">,
): Promise<Doc<"reviews">[]> {
  const reviews = await ctx.db
    .query("reviews")
    .withIndex("by_report", (q) => q.eq("reportId", report._id))
    .collect();
  return reviews.filter((review) =>
    isReviewForCurrentTarget(review, report),
  );
}

/**
 * Marks a report as reviewed once it has at least two reviews. Correcting
 * the reported driver does not invalidate existing reviews, so all reviews
 * count. Returns the review count.
 */
export async function maybeMarkReportReviewed(
  ctx: MutationCtx,
  report: Doc<"reports">,
): Promise<number> {
  const reviews = await ctx.db
    .query("reviews")
    .withIndex("by_report", (q) => q.eq("reportId", report._id))
    .collect();
  if (
    reviews.length >= 2 &&
    report.status !== "reviewed" &&
    report.status !== "finalized"
  ) {
    await ctx.db.patch(report._id, {
      status: "reviewed",
      updatedAt: Date.now(),
    });
  }
  return reviews.length;
}
