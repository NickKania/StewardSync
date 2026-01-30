import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkUserDriverConflict } from "./lib/reports";

export const debugReportConflict = query({
  args: {
    userId: v.id("users"),
    reportId: v.id("reports"),
  },
  handler: async (ctx, args) => {
    console.log(`[DEBUG QUERY] debugReportConflict called with userId: ${args.userId}, reportId: ${args.reportId}`);

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      console.log(`[DEBUG QUERY] Report not found: ${args.reportId}`);
      return {
        error: "Report not found",
        result: null,
      };
    }

    const result = await checkUserDriverConflict(ctx, args.userId, report);
    console.log(`[DEBUG QUERY] debugReportConflict result:`, result);

    return result;
  },
});

export const checkConflict = query({
  args: {
    userId: v.id("users"),
    reportId: v.id("reports"),
  },
  handler: async (ctx, args) => {
    console.log(`[DEBUG QUERY] checkConflict called with userId: ${args.userId}, reportId: ${args.reportId}`);

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      console.log(`[DEBUG QUERY] Report not found: ${args.reportId}`);
      return {
        error: "Report not found",
        hasConflict: false,
        conflictType: null,
      };
    }

    const result = await checkUserDriverConflict(ctx, args.userId, report);
    console.log(`[DEBUG QUERY] checkConflict result:`, result);

    return {
      hasConflict: result.hasConflict,
      conflictType: result.conflictType,
      driverName: result.driverName,
    };
  },
});

export const debugPenaltyAssignment = query({
  args: {
    reportId: v.id("reports"),
    driverId: v.id("drivers"),
  },
  handler: async (ctx, args) => {
    console.log(`[DEBUG PENALTY] Starting debug for report: ${args.reportId}, driver: ${args.driverId}`);

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      return { error: "Report not found" };
    }

    const driver = await ctx.db.get(args.driverId);
    if (!driver) {
      return { error: "Driver not found" };
    }

    const event = await ctx.db.get(report.eventId);
    if (!event) {
      return { error: "Event not found" };
    }

    const series = await ctx.db.get(event.seriesId);
    const appliedPenalty = report.appliedPenalty ? await ctx.db.get(report.appliedPenalty as any) : null;

    // Get all events in series
    const events = await ctx.db
      .query("events")
      .withIndex("by_series", (q) => q.eq("seriesId", event.seriesId))
      .collect();

    // Calculate points accumulator
    const penaltyAccumulator: Record<string, number> = {};

    for (const evt of events) {
      const evtReports = await ctx.db
        .query("reports")
        .withIndex("by_event", (q) => q.eq("eventId", evt._id))
        .collect();

      const finalizedReports = evtReports.filter((r) => r.status === "finalized");

      for (const finalizedReport of finalizedReports) {
        let penalty: any = null;
        if (finalizedReport.appliedPenalty) {
          penalty = await ctx.db.get(finalizedReport.appliedPenalty as any);
        }

        const points = penalty?.licensePoints ?? 0;
        const driverId = finalizedReport.atFaultDriverId?.toString() || finalizedReport.reportedDriverId.toString();

        if (penaltyAccumulator[driverId]) {
          penaltyAccumulator[driverId] += points;
        } else {
          penaltyAccumulator[driverId] = points;
        }
      }
    }

    // Get total points for this driver
    const driverIdStr = driver._id.toString();
    const totalPoints = penaltyAccumulator[driverIdStr] ?? 0;

    // Get series penalties
    const seriesPenalties = await ctx.db
      .query("seriesPenalties")
      .withIndex("by_series", (q) => q.eq("seriesId", event.seriesId))
      .collect();

    // Get existing penalties
    const existingDriverSeriesPenalties = await ctx.db
      .query("driverSeriesPenalties")
      .withIndex("by_driver_and_series", (q) =>
        q.eq("driverId", driver._id).eq("seriesId", event.seriesId),
      )
      .collect();

    const assignedThresholds = existingDriverSeriesPenalties
      .filter((dsp: any) => !dsp.isServed)
      .map((dsp: any) => dsp.seriesPenaltyThresholdId.toString());

    // Check each penalty/threshold
    const thresholdChecks: any[] = [];
    let wouldAssign = false;

    for (const seriesPenalty of seriesPenalties) {
      const thresholds = await ctx.db
        .query("seriesPenaltyThresholds")
        .withIndex("by_series_penalty", (q) =>
          q.eq("seriesPenaltyId", seriesPenalty._id),
        )
        .collect();

      for (const threshold of thresholds) {
        const appliesToDriver = threshold.driverClasses.includes(driver.driverClass || "");
        const thresholdMet = totalPoints >= threshold.threshold;
        const alreadyAssigned = assignedThresholds.includes(threshold._id.toString());

        const check = {
          seriesPenaltyId: seriesPenalty._id,
          seriesPenaltyName: seriesPenalty.penaltyName,
          thresholdId: threshold._id,
          thresholdValue: threshold.threshold,
          driverClass: driver.driverClass,
          thresholdDriverClasses: threshold.driverClasses,
          appliesToDriver,
          totalPoints,
          thresholdMet,
          alreadyAssigned,
          wouldAssign: appliesToDriver && thresholdMet && !alreadyAssigned,
        };

        thresholdChecks.push(check);

        if (check.wouldAssign) {
          wouldAssign = true;
        }
      }
    }

    return {
      report: {
        _id: report._id,
        status: report.status,
        isFinalized: report.isFinalized,
        atFaultDriverId: report.atFaultDriverId,
        reportedDriverId: report.reportedDriverId,
        appliedPenaltyId: report.appliedPenalty,
        eventId: report.eventId,
      },
      driver: {
        _id: driver._id,
        driverNumber: driver.driverNumber,
        driverName: driver.driverName,
        driverClass: driver.driverClass,
        championshipId: driver.championshipId,
      },
      event: {
        _id: event._id,
        seriesId: event.seriesId,
      },
      series: series ? { _id: series._id, name: (series as any).name } : null,
      appliedPenalty: appliedPenalty ? {
        _id: appliedPenalty._id,
        name: (appliedPenalty as any).name,
        licensePoints: (appliedPenalty as any).licensePoints,
      } : null,
      penaltyAccumulator,
      totalPointsForDriver: totalPoints,
      existingPenalties: existingDriverSeriesPenalties.map(dsp => ({
        _id: dsp._id,
        seriesPenaltyThresholdId: dsp.seriesPenaltyThresholdId,
        isServed: dsp.isServed,
      })),
      assignedThresholds,
      seriesPenaltyCount: seriesPenalties.length,
      thresholdChecks,
      wouldAssign,
    };
  },
});

export const manuallyAssignPenaltiesForReport = mutation({
  args: {
    reportId: v.id("reports"),
  },
  handler: async (ctx, args) => {
    console.log(`[MANUAL ASSIGN] Starting for report: ${args.reportId}`);

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      return { error: "Report not found", success: false };
    }

    if (!report.isFinalized) {
      return { error: "Report must be finalized first", success: false };
    }

    const event = await ctx.db.get(report.eventId);
    if (!event) {
      return { error: "Event not found", success: false };
    }

    const events = await ctx.db
      .query("events")
      .withIndex("by_series", (q) => q.eq("seriesId", event.seriesId))
      .collect();

    const drivers = await ctx.db
      .query("drivers")
      .withIndex("by_championship", (q) =>
        q.eq("championshipId", event.seriesId),
      )
      .collect();

    const penaltyAccumulator: Record<string, number> = {};

    for (const evt of events) {
      const evtReports = await ctx.db
        .query("reports")
        .withIndex("by_event", (q) => q.eq("eventId", evt._id))
        .collect();

      const finalizedReports = evtReports.filter((r) => r.status === "finalized");

      for (const finalizedReport of finalizedReports) {
        let penalty: any = null;
        if (finalizedReport.appliedPenalty) {
          penalty = await ctx.db.get(finalizedReport.appliedPenalty as any);
        }

        const points = penalty?.licensePoints ?? 0;
        const driverId = finalizedReport.atFaultDriverId?.toString() || finalizedReport.reportedDriverId.toString();

        if (penaltyAccumulator[driverId]) {
          penaltyAccumulator[driverId] += points;
        } else {
          penaltyAccumulator[driverId] = points;
        }
      }
    }

    const seriesPenalties = await ctx.db
      .query("seriesPenalties")
      .withIndex("by_series", (q) => q.eq("seriesId", event.seriesId))
      .collect();

    const assignedPenalties: any[] = [];

    for (const driver of drivers) {
      const driverId = driver._id.toString();
      const totalPoints = penaltyAccumulator[driverId] ?? 0;
      const driverClass = driver.driverClass || "";

      console.log(`[MANUAL ASSIGN] Driver ${driver.driverNumber}: ${totalPoints} points, class: ${driverClass}`);

      const existingDriverSeriesPenalties = await ctx.db
        .query("driverSeriesPenalties")
        .withIndex("by_driver_and_series", (q) =>
          q.eq("driverId", driver._id).eq("seriesId", event.seriesId),
        )
        .collect();

      const assignedThresholds = existingDriverSeriesPenalties
        .filter((dsp: any) => !dsp.isServed)
        .map((dsp: any) => dsp.seriesPenaltyThresholdId.toString());

      for (const seriesPenalty of seriesPenalties) {
        const thresholds = await ctx.db
          .query("seriesPenaltyThresholds")
          .withIndex("by_series_penalty", (q) =>
            q.eq("seriesPenaltyId", seriesPenalty._id),
          )
          .collect();

        for (const threshold of thresholds) {
          const appliesToDriver = threshold.driverClasses.includes(driverClass);
          const thresholdMet = totalPoints >= threshold.threshold;
          const alreadyAssigned = assignedThresholds.includes(threshold._id.toString());

          if (appliesToDriver && thresholdMet && !alreadyAssigned) {
            console.log(`[MANUAL ASSIGN] >>> ASSIGNING ${seriesPenalty.penaltyName} to driver ${driver.driverNumber}`);
            const insertedId = await ctx.db.insert("driverSeriesPenalties", {
              driverId: driver._id,
              seriesId: event.seriesId,
              seriesPenaltyId: seriesPenalty._id,
              seriesPenaltyThresholdId: threshold._id,
              isServed: false,
              pointsAtAssignment: totalPoints,
              assignedAt: Date.now(),
            });
            console.log(`[MANUAL ASSIGN] >>> ASSIGNED with ID: ${insertedId}`);

            assignedPenalties.push({
              driverNumber: driver.driverNumber,
              driverName: driver.driverName,
              penaltyName: seriesPenalty.penaltyName,
              threshold: threshold.threshold,
              insertedId,
            });
          }
        }
      }
    }

    return {
      success: true,
      assignedPenalties,
      totalAssigned: assignedPenalties.length,
    };
  },
});
