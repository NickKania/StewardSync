import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const assignPenalty = mutation({
  args: {
    driverId: v.id("drivers"),
    seriesId: v.id("series"),
    seriesPenaltyId: v.id("seriesPenalties"),
    seriesPenaltyThresholdId: v.id("seriesPenaltyThresholds"),
    pointsAtAssignment: v.number(),
  },
  handler: async (ctx, args) => {
    const driverSeriesPenaltyId = await ctx.db.insert("driverSeriesPenalties", {
      driverId: args.driverId,
      seriesId: args.seriesId,
      seriesPenaltyId: args.seriesPenaltyId,
      seriesPenaltyThresholdId: args.seriesPenaltyThresholdId,
      isServed: false,
      pointsAtAssignment: args.pointsAtAssignment,
      assignedAt: Date.now(),
    });
    return driverSeriesPenaltyId;
  },
});

export const markAsServed = mutation({
  args: {
    id: v.id("driverSeriesPenalties"),
    servedBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      isServed: true,
      servedAt: Date.now(),
      servedBy: args.servedBy,
    });
    return args.id;
  },
});

export const checkAndAssignThresholds = mutation({
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

    for (const driver of drivers) {
      const driverId = driver._id.toString();
      const totalPoints = penaltyAccumulator[driverId] ?? 0;

      // Get driver's class information
      const driverClass = driver.driverClassId ? await ctx.db.get(driver.driverClassId) : null;
      const driverClassId = driverClass?._id;

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
          // Check if driver's class is in the threshold's driverClassIds
          const appliesToDriver = driverClassId ? threshold.driverClassIds.includes(driverClassId) : false;

          if (appliesToDriver &&
            totalPoints >= threshold.threshold &&
            !assignedThresholds.includes(threshold._id)) {
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
              driverName: driver.driverName,
              driverClass: driverClass?.displayName || "",
              penaltyName: seriesPenalty.penaltyName,
              threshold: threshold.threshold,
              pointsAtAssignment: totalPoints,
            });
          }
        }
      }
    }

    return assignedPenalties;
  },
});

export const getByDriverAndSeries = query({
  args: {
    driverId: v.id("drivers"),
    seriesId: v.id("series"),
  },
  handler: async (ctx, args) => {
    const driverSeriesPenalties = await ctx.db
      .query("driverSeriesPenalties")
      .withIndex("by_driver_and_series", (q) =>
        q.eq("driverId", args.driverId).eq("seriesId", args.seriesId)
      )
      .collect();

    const driverSeriesPenaltiesWithDetails = await Promise.all(
      driverSeriesPenalties.map(async (dsp: any) => {
        const driver = await ctx.db.get(dsp.driverId);
        const series = await ctx.db.get(dsp.seriesId);
        const seriesPenalty = await ctx.db.get(dsp.seriesPenaltyId);
        const seriesPenaltyThreshold = await ctx.db.get(dsp.seriesPenaltyThresholdId);
        const servedByUser = dsp.servedBy ? await ctx.db.get(dsp.servedBy) : null;

        return {
          ...dsp,
          driver,
          series,
          seriesPenalty,
          seriesPenaltyThreshold,
          servedByUser,
        };
      })
    );

    return driverSeriesPenaltiesWithDetails;
  },
});

export const getBySeries = query({
  args: { seriesId: v.id("series") },
  handler: async (ctx, args) => {
    const driverSeriesPenalties = await ctx.db
      .query("driverSeriesPenalties")
      .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId))
      .collect();

    const driverSeriesPenaltiesWithDetails = await Promise.all(
      driverSeriesPenalties.map(async (dsp: any) => {
        const driver = await ctx.db.get(dsp.driverId);
        const series = await ctx.db.get(dsp.seriesId);
        const seriesPenalty = await ctx.db.get(dsp.seriesPenaltyId);
        const seriesPenaltyThreshold = await ctx.db.get(dsp.seriesPenaltyThresholdId);
        const servedByUser = dsp.servedBy ? await ctx.db.get(dsp.servedBy) : null;

        return {
          ...dsp,
          driver,
          series,
          seriesPenalty,
          seriesPenaltyThreshold,
          servedByUser,
        };
      })
    );

    return driverSeriesPenaltiesWithDetails;
  },
});

export const getDriverPenaltyDetails = query({
  args: {
    driverId: v.id("drivers"),
    seriesId: v.optional(v.id("series")),
  },
  handler: async (ctx, args) => {
    let driverSeriesPenalties: any[] = [];

    if (args.seriesId) {
      driverSeriesPenalties = await ctx.db
        .query("driverSeriesPenalties")
        .withIndex("by_driver_and_series", (q) =>
          q.eq("driverId", args.driverId).eq("seriesId", args.seriesId as any)
        )
        .collect();
    } else {
      driverSeriesPenalties = await ctx.db
        .query("driverSeriesPenalties")
        .filter((q) => q.eq(q.field("driverId"), args.driverId))
        .collect();
    }

    const driverSeriesPenaltiesWithDetails = await Promise.all(
      driverSeriesPenalties.map(async (dsp: any) => {
        const series = await ctx.db.get(dsp.seriesId);
        const seriesPenalty = await ctx.db.get(dsp.seriesPenaltyId);
        const seriesPenaltyThreshold = await ctx.db.get(dsp.seriesPenaltyThresholdId);
        const servedByUser = dsp.servedBy ? await ctx.db.get(dsp.servedBy) : null;

        return {
          _id: dsp._id,
          driverId: dsp.driverId,
          seriesId: dsp.seriesId,
          seriesName: (series as any)?.name ?? null,
          seriesPenaltyId: dsp.seriesPenaltyId,
          seriesPenaltyThresholdId: dsp.seriesPenaltyThresholdId,
          penaltyName: (seriesPenalty as any)?.penaltyName ?? null,
          penaltyDescription: (seriesPenalty as any)?.penaltyDescription ?? null,
          threshold: (seriesPenaltyThreshold as any)?.threshold ?? null,
          isServed: dsp.isServed,
          pointsAtAssignment: dsp.pointsAtAssignment,
          assignedAt: dsp.assignedAt,
          servedAt: dsp.servedAt,
          servedBy: dsp.servedBy,
          servedByUserName: (servedByUser as any)?.name ?? null,
        };
      })
    );

    return driverSeriesPenaltiesWithDetails.sort((a, b) => b.assignedAt - a.assignedAt);
  },
});

export const getUnservedPenaltiesBySeries = query({
  args: {
    seriesId: v.optional(v.id("series")),
  },
  handler: async (ctx, args) => {
    let driverSeriesPenalties: any[] = [];

    if (args.seriesId) {
      driverSeriesPenalties = await ctx.db
        .query("driverSeriesPenalties")
        .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId as any))
        .filter((q) => q.eq(q.field("isServed"), false))
        .collect();
    } else {
      driverSeriesPenalties = await ctx.db
        .query("driverSeriesPenalties")
        .filter((q) => q.eq(q.field("isServed"), false))
        .collect();
    }

    const penaltiesWithDetails = await Promise.all(
      driverSeriesPenalties.map(async (dsp: any) => {
        const driver = await ctx.db.get(dsp.driverId);
        const series = await ctx.db.get(dsp.seriesId);
        const seriesPenalty = await ctx.db.get(dsp.seriesPenaltyId);
        const seriesPenaltyThreshold = await ctx.db.get(dsp.seriesPenaltyThresholdId);
        const servedByUser = dsp.servedBy ? await ctx.db.get(dsp.servedBy) : null;

        return {
          _id: dsp._id,
          driverId: dsp.driverId,
          seriesId: dsp.seriesId,
          seriesPenaltyId: dsp.seriesPenaltyId,
          seriesPenaltyThresholdId: dsp.seriesPenaltyThresholdId,
          driver,
          series,
          seriesPenalty,
          seriesPenaltyThreshold,
          servedByUser,
          isServed: dsp.isServed,
          pointsAtAssignment: dsp.pointsAtAssignment,
          assignedAt: dsp.assignedAt,
          servedAt: dsp.servedAt,
          servedBy: dsp.servedBy,
          servedByUserName: (servedByUser as any)?.name ?? null,
        };
      })
    );

    const penaltiesBySeries: Record<string, any[]> = {};

    for (const penalty of penaltiesWithDetails) {
      const seriesId = penalty.seriesId?.toString();
      if (!seriesId) continue;
      if (!penaltiesBySeries[seriesId]) {
        penaltiesBySeries[seriesId] = [];
      }
      penaltiesBySeries[seriesId].push(penalty);
    }

    const result: any[] = [];

    for (const [seriesId, penalties] of Object.entries(penaltiesBySeries)) {
      const penaltiesByDriver: Record<string, any[]> = {};

      for (const penalty of penalties) {
        const driverId = penalty.driverId?.toString();
        if (!driverId) continue;
        if (!penaltiesByDriver[driverId]) {
          penaltiesByDriver[driverId] = [];
        }
        penaltiesByDriver[driverId].push(penalty);
      }

      const sortedPenalties = Object.values(penaltiesByDriver)
        .map((driverPenalties) => {
          driverPenalties.sort(
            (a, b) =>
              (b.seriesPenaltyThreshold?.threshold ?? 0) -
              (a.seriesPenaltyThreshold?.threshold ?? 0)
          );
          return driverPenalties[0];
        })
        .sort((a, b) => {
          const driverNameA = a.driver?.driverName ?? "";
          const driverNameB = b.driver?.driverName ?? "";
          return driverNameA.localeCompare(driverNameB);
        });

      result.push({
        seriesId,
        seriesName: penalties[0].series?.name ?? null,
        penalties: sortedPenalties,
      });
    }

    result.sort((a, b) => (a.seriesName ?? "").localeCompare(b.seriesName ?? ""));

    return result;
  },
});
