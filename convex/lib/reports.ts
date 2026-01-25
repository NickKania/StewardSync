import { Doc, Id } from "../_generated/dataModel";

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
  conflictType: "reporting_user" | "reported_driver" | null;
  driverName?: string;
}> {
  // Check if user is the reporting user
  if (report.reportingUserId && String(report.reportingUserId) === String(userId)) {
    return {
      hasConflict: true,
      conflictType: "reporting_user",
    };
  }

  // Check if user is the reported driver
  const driversLinkedToUser = await ctx.db
    .query("drivers")
    .withIndex("by_user_id", (q: any) => q.eq("userId", userId))
    .collect();

  const driverIds = driversLinkedToUser.map((d: any) => d._id);

  if (driverIds.some((id: any) => id === report.reportedDriverId)) {
    const driver = driversLinkedToUser.find((d: any) => d._id === report.reportedDriverId);
    return {
      hasConflict: true,
      conflictType: "reported_driver",
      driverName: driver?.driverName
    };
  }

  return { hasConflict: false, conflictType: null };
}
