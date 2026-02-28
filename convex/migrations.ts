import { mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { UserFacingError } from "./lib/errors";
import type { Id } from "./_generated/dataModel";

export const assignPenaltiesForSeries = internalMutation({
  args: { seriesId: v.id("series") },
  handler: async (ctx, args) => {
    console.log(
      "[assignPenaltiesForSeries] Starting assignment for series:",
      args.seriesId,
    );

    // Requirements for penalty assignment:
    // 1. Driver must have driverClassId set (run migrateDriverClasses migration)
    // 2. Threshold must have driverClassIds array with at least one entry (run migrateDriverClasses migration)
    // 3. Driver's driverClassId must be in threshold's driverClassIds
    // If these requirements are not met, check the returned diagnostic arrays for details
    const events = await ctx.db
      .query("events")
      .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId))
      .collect();

    const drivers = await ctx.db
      .query("drivers")
      .withIndex("by_championship", (q) =>
        q.eq("championshipId", args.seriesId),
      )
      .collect();

    const penaltyAccumulator: Record<string, number> = {};

    for (const event of events) {
      const reports = await ctx.db
        .query("reports")
        .withIndex("by_event", (q) => q.eq("eventId", event._id))
        .collect();

      const finalizedReports = reports.filter((r) => r.status === "finalized");

      for (const report of finalizedReports) {
        let penalty: any = null;
        if (report.appliedPenalty) {
          penalty = await ctx.db.get(report.appliedPenalty as any);
        }

        const points = penalty?.licensePoints ?? 0;
        const driverId =
          report.atFaultDriverId?.toString() ||
          report.reportedDriverId.toString();

        // Verify the driver belongs to this series before accumulating points
        const driver = await ctx.db.get(
          report.atFaultDriverId || report.reportedDriverId,
        );

        // Only accumulate points if the driver's championship matches the current series
        if (driver && driver.championshipId === args.seriesId) {
          if (penaltyAccumulator[driverId]) {
            penaltyAccumulator[driverId] += points;
          } else {
            penaltyAccumulator[driverId] = points;
          }
        }
      }
    }

    const seriesPenalties = await ctx.db
      .query("seriesPenalties")
      .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId))
      .collect();

    const assignedPenalties: any[] = [];
    const existingPenalties: any[] = [];
    const skippedThresholds: any[] = [];
    const missingDriverClass: any[] = [];
    const emptyDriverClassIds: any[] = [];
    const mismatchedDriverClass: any[] = [];

    for (const driver of drivers) {
      const driverId = driver._id.toString();
      const totalPoints = penaltyAccumulator[driverId] ?? 0;
      const driverClassId = driver.driverClassId || null;

      const existingDriverSeriesPenalties = await ctx.db
        .query("driverSeriesPenalties")
        .withIndex("by_driver_and_series", (q) =>
          q.eq("driverId", driver._id).eq("seriesId", args.seriesId),
        )
        .collect();

      const assignedThresholdIds = new Set(
        existingDriverSeriesPenalties.map(
          (dsp) => dsp.seriesPenaltyThresholdId,
        ),
      );

      for (const seriesPenalty of seriesPenalties) {
        const thresholds = await ctx.db
          .query("seriesPenaltyThresholds")
          .withIndex("by_series_penalty", (q) =>
            q.eq("seriesPenaltyId", seriesPenalty._id),
          )
          .collect();

        for (const threshold of thresholds) {
          const hasDriverClass = !!driverClassId;
          const hasThresholdClasses =
            threshold.driverClassIds && threshold.driverClassIds.length > 0;
          const matchesDriverClass =
            hasDriverClass &&
            hasThresholdClasses &&
            threshold.driverClassIds.includes(driverClassId);

          let appliesToDriver = false;
          let skipReason = "";

          if (!hasDriverClass) {
            skipReason = "missing_driver_class";
            missingDriverClass.push({
              driverId: driver._id,
              driverName: driver.driverName,
              penaltyName: seriesPenalty.penaltyName,
              threshold: threshold.threshold,
              currentPoints: totalPoints,
            });
          } else if (!hasThresholdClasses) {
            skipReason = "empty_threshold_classes";
            emptyDriverClassIds.push({
              driverId: driver._id,
              driverName: driver.driverName,
              driverClassId,
              penaltyName: seriesPenalty.penaltyName,
              threshold: threshold.threshold,
              currentPoints: totalPoints,
            });
          } else if (!matchesDriverClass) {
            skipReason = "mismatched_driver_class";
            mismatchedDriverClass.push({
              driverId: driver._id,
              driverName: driver.driverName,
              driverClassId,
              penaltyName: seriesPenalty.penaltyName,
              threshold: threshold.threshold,
              currentPoints: totalPoints,
            });
          } else {
            appliesToDriver = true;
          }

          if (appliesToDriver && totalPoints >= threshold.threshold) {
            if (assignedThresholdIds.has(threshold._id)) {
              existingPenalties.push({
                driverId: driver._id,
                driverName: driver.driverName,
                penaltyName: seriesPenalty.penaltyName,
                threshold: threshold.threshold,
                pointsAtAssignment: totalPoints,
              });
            } else {
              const driverSeriesPenaltyId = await ctx.db.insert(
                "driverSeriesPenalties",
                {
                  driverId: driver._id,
                  seriesId: args.seriesId,
                  seriesPenaltyId: seriesPenalty._id,
                  seriesPenaltyThresholdId: threshold._id,
                  isServed: false,
                  requiresReview: threshold.requiresReview ?? false,
                  pointsAtAssignment: totalPoints,
                  assignedAt: Date.now(),
                },
              );

              const driverClass = driverClassId
                ? await ctx.db.get(driverClassId)
                : null;
              assignedPenalties.push({
                driverSeriesPenaltyId,
                driverId: driver._id,
                driverName: driver.driverName,
                driverClass: driverClass?.displayName || "",
                penaltyName: seriesPenalty.penaltyName,
                threshold: threshold.threshold,
                pointsAtAssignment: totalPoints,
              });
            }
          } else if (appliesToDriver) {
            skippedThresholds.push({
              driverId: driver._id,
              driverName: driver.driverName,
              penaltyName: seriesPenalty.penaltyName,
              threshold: threshold.threshold,
              currentPoints: totalPoints,
              skipReason: "insufficient_points",
            });
          }
        }
      }
    }

    console.log("[assignPenaltiesForSeries] Assignment complete:", {
      assignedCount: assignedPenalties.length,
      existingCount: existingPenalties.length,
      skippedThresholds: skippedThresholds.length,
      missingDriverClass: missingDriverClass.length,
      emptyDriverClassIds: emptyDriverClassIds.length,
      mismatchedDriverClass: mismatchedDriverClass.length,
    });

    return {
      assignedCount: assignedPenalties.length,
      existingCount: existingPenalties.length,
      assignedPenalties,
      existingPenalties,
      skippedThresholds,
      missingDriverClass,
      emptyDriverClassIds,
      mismatchedDriverClass,
    };
  },
});

/**
 * Cleanup script to remove incorrectly assigned driverSeriesPenalties.
 *
 * This script identifies and removes driverSeriesPenalty entries where:
 * 1. The driver's championshipId doesn't match the seriesId in the penalty entry
 *
 * This situation occurs when the assignPenaltiesForSeries migration was run
 * before driver series validation was added, causing penalties to be assigned
 * to drivers from other series who happened to have reports with penalties.
 *
 * Returns details about what was removed and what would be removed (dry run).
 */
export const cleanupIncorrectDriverSeriesPenalties = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;

    const allDriverSeriesPenalties = await ctx.db
      .query("driverSeriesPenalties")
      .collect();

    const toRemove: any[] = [];
    const kept: any[] = [];
    const errors: any[] = [];

    for (const dsp of allDriverSeriesPenalties) {
      try {
        const driver = await ctx.db.get(dsp.driverId);

        if (!driver) {
          // Driver doesn't exist - mark for removal
          toRemove.push({
            driverSeriesPenaltyId: dsp._id,
            driverId: dsp.driverId,
            seriesId: dsp.seriesId,
            reason: "Driver not found",
          });
          continue;
        }

        // Check if driver belongs to the series
        if (!driver.championshipId || driver.championshipId !== dsp.seriesId) {
          // Driver belongs to a different series or has no championship - mark for removal
          const actualSeries = driver.championshipId
            ? await ctx.db.get(driver.championshipId)
            : null;
          const penaltySeries = await ctx.db.get(dsp.seriesId);

          toRemove.push({
            driverSeriesPenaltyId: dsp._id,
            driverId: dsp.driverId,
            driverName: driver.driverName,
            driverClassId: driver.driverClassId,
            seriesId: dsp.seriesId,
            penaltySeries: penaltySeries
              ? (penaltySeries as any).name || "Unknown"
              : "Unknown",
            driverChampionshipId: driver.championshipId || "None",
            driverSeries: actualSeries
              ? (actualSeries as any).name || "Unknown"
              : "None",
            reason: driver.championshipId
              ? "Driver belongs to a different series"
              : "Driver has no championship assigned",
          });
        } else {
          // Driver belongs to the correct series - keep
          kept.push({
            driverSeriesPenaltyId: dsp._id,
            driverId: dsp.driverId,
            driverName: driver.driverName,
            seriesId: dsp.seriesId,
          });
        }
      } catch (error) {
        errors.push({
          driverSeriesPenaltyId: dsp._id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Remove the incorrect entries
    let removedCount = 0;
    if (!dryRun && toRemove.length > 0) {
      for (const entry of toRemove) {
        try {
          await ctx.db.delete(entry.driverSeriesPenaltyId);
          removedCount++;
        } catch (error) {
          errors.push({
            driverSeriesPenaltyId: entry.driverSeriesPenaltyId,
            error: error instanceof Error ? error.message : "Failed to delete",
          });
        }
      }
    }

    return {
      dryRun,
      toRemoveCount: toRemove.length,
      removedCount,
      keptCount: kept.length,
      errorCount: errors.length,
      toRemove,
      kept,
      errors,
    };
  },
});
