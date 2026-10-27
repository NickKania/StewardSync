import { Doc, Id } from "../_generated/dataModel";

/**
 * Calculates the reporting window (open and close times) for an event.
 * Used to validate driver report submissions.
 * NOTE: This should NOT be used for steward incidents, which bypass time validation.
 *
 * @param eventDate - The date of the event
 * @param reportingOpenTime - The time reporting opens (HH:MM format in UTC)
 * @param reportingCloseDuration - The number of hours after open time when reporting closes
 * @returns Object with openTime and closeTime Date objects
 */
export function getReportingWindow(
  eventDate: Date,
  reportingOpenTime: string,
  reportingCloseDuration: number
): { openTime: Date; closeTime: Date } {
  const [hours, minutes] = reportingOpenTime.split(":").map(Number);
  const utcYear = eventDate.getUTCFullYear();
  const utcMonth = eventDate.getUTCMonth();
  const utcDay = eventDate.getUTCDate();
  const utcDateStart = Date.UTC(utcYear, utcMonth, utcDay);
  const offsetFromUtcDateStart = eventDate.getTime() - utcDateStart;
  const dayMs = 24 * 60 * 60 * 1000;
  const eventTimezoneOffset =
    offsetFromUtcDateStart > dayMs / 2
      ? offsetFromUtcDateStart - dayMs
      : offsetFromUtcDateStart;
  const eventLocalDateStart = eventDate.getTime() - eventTimezoneOffset;
  const eventLocalDate = new Date(eventLocalDateStart);
  const eventYear = eventLocalDate.getUTCFullYear();
  const eventMonth = eventLocalDate.getUTCMonth();
  const eventDay = eventLocalDate.getUTCDate();

  const candidates = [-1, 0, 1].map(
    (dayOffset) =>
      new Date(
        Date.UTC(eventYear, eventMonth, eventDay + dayOffset, hours, minutes, 0, 0),
      )
  );
  const openTime =
    candidates.find((candidate) => {
      const shiftedCandidate = new Date(
        candidate.getTime() - eventTimezoneOffset,
      );
      return (
        shiftedCandidate.getUTCFullYear() === eventYear &&
        shiftedCandidate.getUTCMonth() === eventMonth &&
        shiftedCandidate.getUTCDate() === eventDay
      );
    }) ?? candidates[1];

  const closeTime = new Date(
    openTime.getTime() + reportingCloseDuration * 60 * 60 * 1000,
  );

  return { openTime, closeTime };
}

/**
 * Checks if a user is involved in a report
 * @param ctx - Convex context
 * @param userId - The user ID to check
 * @param report - The report document to check against
 * @returns Object with conflict information
 */
export async function checkUserDriverConflict(
  ctx: any,
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
    .withIndex("by_user_id", (q: any) => q.eq("userId", userId))
    .collect();

  const driverIds = driversLinkedToUser.map((d: any) => d._id);

  if (driverIds.some((id: any) => String(id) === String(report.reportedDriverId))) {
    const driver = driversLinkedToUser.find((d: any) => String(d._id) === String(report.reportedDriverId));
    return {
      hasConflict: true,
      conflictType: "reported_driver",
      driverName: driver?.driverName,
    };
  }

  return { hasConflict: false, conflictType: null };
}

/**
 * A review counts toward readiness only if it assessed the report's current
 * reported driver. Reviews created before reported-driver edits existed have
 * no assessedReportedDriverId; reports.update backfills that provenance with
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
  ctx: any,
  report: Doc<"reports">,
): Promise<any[]> {
  const reviews = await ctx.db
    .query("reviews")
    .withIndex("by_report", (q: any) => q.eq("reportId", report._id))
    .collect();
  return reviews.filter((review: any) =>
    isReviewForCurrentTarget(review, report),
  );
}

/**
 * Marks a report as reviewed once at least two reviews assess the current
 * reported driver. Returns the number of current-target reviews.
 */
export async function maybeMarkReportReviewed(
  ctx: any,
  report: Doc<"reports">,
): Promise<number> {
  const currentTargetReviews = await listReviewsForCurrentTarget(ctx, report);
  if (
    currentTargetReviews.length >= 2 &&
    report.status !== "reviewed" &&
    report.status !== "finalized"
  ) {
    await ctx.db.patch(report._id, {
      status: "reviewed",
      updatedAt: Date.now(),
    });
  }
  return currentTargetReviews.length;
}
