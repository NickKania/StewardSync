import { mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const migratePenaltiesAddLap1Time = mutation({
  args: {},
  handler: async (ctx) => {
    const penalties = await ctx.db.query("penalties").collect();

    let migrated = 0;
    for (const penalty of penalties) {
      const penaltyDoc = penalty as any;

      if (!penaltyDoc.timePenaltyLap1) {
        await ctx.db.patch(penalty._id, {
          timePenaltyLap1: penalty.timePenalty,
        });
        migrated++;
      }
    }

    return { success: true, migrated };
  },
});

export const migrateReportsAddLap = mutation({
  args: {},
  handler: async (ctx) => {
    const reports = await ctx.db.query("reports").collect();

    let migrated = 0;
    for (const report of reports) {
      const reportDoc = report as any;

      if (!reportDoc.lap) {
        // Randomly assign lap 1 or lap 2
        const randomLap = Math.random() < 0.5 ? 1 : 2;
        await ctx.db.patch(report._id, {
          lap: randomLap,
        });
        migrated++;
      }
    }

    return { success: true, migrated };
  },
});

export const migrateExistingSeriesPenalties = mutation({
  args: {},
  handler: async (ctx) => {
    const seriesList = await ctx.db.query("series").collect();

    const results: any[] = [];

    for (const series of seriesList) {
      const seriesResult = await ctx.runMutation(
        internal.migrations.assignPenaltiesForSeries,
        { seriesId: series._id }
      );
      results.push({
        seriesId: series._id,
        seriesName: series.name,
        ...seriesResult
      });
    }

    return {
      totalSeries: seriesList.length,
      results
    };
  },
});

export const assignPenaltiesForSeries = internalMutation({
  args: { seriesId: v.id("series") },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("events")
      .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId))
      .collect();

    const drivers = await ctx.db
      .query("drivers")
      .withIndex("by_championship", (q) => q.eq("championshipId", args.seriesId))
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
        const driverId = report.atFaultDriverId?.toString() || report.reportedDriverId.toString();

        if (penaltyAccumulator[driverId]) {
          penaltyAccumulator[driverId] += points;
        } else {
          penaltyAccumulator[driverId] = points;
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

    for (const driver of drivers) {
      const driverId = driver._id.toString();
      const totalPoints = penaltyAccumulator[driverId] ?? 0;
      const driverClass = driver.driverClass || "";

      const existingDriverSeriesPenalties = await ctx.db
        .query("driverSeriesPenalties")
        .withIndex("by_driver_and_series", (q) =>
          q.eq("driverId", driver._id).eq("seriesId", args.seriesId)
        )
        .collect();

      const assignedThresholds = existingDriverSeriesPenalties
        .filter((dsp: any) => !dsp.isServed)
        .map((dsp: any) => dsp.seriesPenaltyThresholdId);

      for (const seriesPenalty of seriesPenalties) {
        const thresholds = await ctx.db
          .query("seriesPenaltyThresholds")
          .withIndex("by_series_penalty", (q) => q.eq("seriesPenaltyId", seriesPenalty._id))
          .collect();

        for (const threshold of thresholds) {
          const appliesToDriver = threshold.driverClasses.includes(driverClass);

          if (appliesToDriver && totalPoints >= threshold.threshold) {
            if (assignedThresholds.includes(threshold._id)) {
              existingPenalties.push({
                driverId: driver._id,
                driverName: driver.driverName,
                penaltyName: seriesPenalty.penaltyName,
                threshold: threshold.threshold,
                pointsAtAssignment: totalPoints,
              });
            } else {
              const driverSeriesPenaltyId = await ctx.db.insert("driverSeriesPenalties", {
                driverId: driver._id,
                seriesId: args.seriesId,
                seriesPenaltyId: seriesPenalty._id,
                seriesPenaltyThresholdId: threshold._id,
                isServed: false,
                pointsAtAssignment: totalPoints,
                assignedAt: Date.now(),
              });

              assignedPenalties.push({
                driverSeriesPenaltyId,
                driverId: driver._id,
                driverName: driver.driverName,
                driverClass: driver.driverClass,
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
            });
          }
        }
      }
    }

    return {
      assignedCount: assignedPenalties.length,
      existingCount: existingPenalties.length,
      assignedPenalties,
      existingPenalties,
      skippedThresholds,
    };
  },
});

export const backfillAtFaultDriverId = internalMutation({
  args: {},
  handler: async (ctx) => {
    const reports = await ctx.db.query("reports").collect();

    let reportsUpdated = 0;
    let reviewsUpdated = 0;

    for (const report of reports) {
      if (report.atFaultDriverId) continue;

      if (report.status === "finalized") {
        await ctx.db.patch(report._id, {
          atFaultDriverId: report.reportedDriverId,
          updatedAt: Date.now(),
        });
        reportsUpdated++;
      } else if (report.status === "reviewed") {
        const reviews = await ctx.db
          .query("reviews")
          .withIndex("by_report", (q) => q.eq("reportId", report._id))
          .collect();

        for (const review of reviews) {
          if (review.atFaultDriverId) continue;

          await ctx.db.patch(review._id, {
            atFaultDriverId: report.reportedDriverId,
            updatedAt: Date.now(),
          });
          reviewsUpdated++;
        }
      }
    }

    return {
      reportsUpdated,
      reviewsUpdated,
    };
  },
});
