import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { reportCounter } from "../reportCounter";

/**
 * Backfills sequential reportId to all existing reports.
 * Reports are processed in order of creation (oldest first).
 * Returns the highest reportId assigned.
 */
export const backfillReportIds = mutation({
  args: {},
  handler: async (ctx) => {
    // Fetch all reports ordered by creation time (oldest first)
    const reports = await ctx.db
      .query("reports")
      .order("asc")
      .collect();

    if (reports.length === 0) {
      console.log("[MIGRATION] No reports found to backfill");
      return { success: true, highestReportId: 0, count: 0 };
    }

    let reportId = 1;
    let patched = 0;

    // Assign sequential reportId to each report
    for (const report of reports) {
      // Skip if already has reportId
      if (report.reportId !== undefined) {
        console.log(
          `[MIGRATION] Report ${report._id} already has reportId ${report.reportId}, skipping`,
        );
        // Track the highest existing reportId
        if (report.reportId && report.reportId > reportId - 1) {
          reportId = report.reportId + 1;
        }
        continue;
      }

      await ctx.db.patch(report._id, {
        reportId,
      });

      console.log(`[MIGRATION] Assigned reportId ${reportId} to report ${report._id}`);
      reportId++;
      patched++;
    }

    const highestReportId = reportId - 1;
    console.log(
      `[MIGRATION] Backfill complete: ${patched} reports updated, highest reportId: ${highestReportId}`,
    );

    return {
      success: true,
      highestReportId,
      count: patched,
    };
  },
});

/**
 * Initializes the sharded counter to the correct value.
 * Should be called after backfillReportIds to set counter to next reportId.
 */
export const initializeCounter = mutation({
  args: {
    targetValue: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get current counter value (should be 0 initially)
    const currentCount = await reportCounter.count(ctx, "reportId");
    console.log(`[MIGRATION] Current counter value: ${currentCount}`);

    // Get target value from args or use highest reportId from reports
    let targetValue = args.targetValue;

    if (targetValue === undefined) {
      // Find highest reportId from all reports
      const reports = await ctx.db.query("reports").collect();
      const maxReportId = reports.reduce((max, r) => {
        if (r.reportId && r.reportId > max) {
          return r.reportId;
        }
        return max;
      }, 0);

      targetValue = maxReportId;
      console.log(`[MIGRATION] Highest reportId found: ${maxReportId}`);
    }

    // If counter is already at target, nothing to do
    if (currentCount === targetValue) {
      console.log(
        `[MIGRATION] Counter already at target value ${targetValue}, skipping`,
      );
      return { success: true, previousValue: currentCount, newValue: currentCount };
    }

    // Use add() to set counter to target value
    // Note: add() increments by amount, so we add (targetValue - currentCount)
    const incrementAmount = targetValue - currentCount;
    await reportCounter.add(ctx, "reportId", incrementAmount);

    // Verify the new value
    const newValue = await reportCounter.count(ctx, "reportId");
    console.log(
      `[MIGRATION] Counter initialized: ${currentCount} → ${newValue} (incremented by ${incrementAmount})`,
    );

    return {
      success: true,
      previousValue: currentCount,
      newValue,
    };
  },
});
