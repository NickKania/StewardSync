import { query } from "./_generated/server";
import { v } from "convex/values";

export const getEventRundown = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    const finalizedReports = reports.filter((r) => r.status === "finalized");

    const rundown = await Promise.all(
      finalizedReports.map(async (report) => {
        const reportedDriver = await ctx.db.get(report.reportedDriverId);
        let appliedPenalty: any = null;

        if (report.appliedPenalty) {
          appliedPenalty = await ctx.db.get(report.appliedPenalty as any);
        }

        const baseTimePenalty = appliedPenalty?.timePenalty ?? 0;
        const selfReportReduction = appliedPenalty?.selfReportReduction ?? 0;
        const timePenaltySeconds = appliedPenalty && report.isSelfReport
          ? Math.max(0, baseTimePenalty - selfReportReduction)
          : baseTimePenalty;

        return {
          reportId: report._id,
          carNumber: reportedDriver?.driverNumber ?? null,
          driverName: reportedDriver?.driverName ?? null,
          driverClass: reportedDriver?.driverClass ?? null,
          incidentDescription: report.finalDecision ?? "",
          penaltyName: appliedPenalty?.name ?? null,
          timePenaltySeconds,
          isSelfReport: report.isSelfReport ?? false,
        };
      })
    );

    return rundown;
  },
});

export const getSeriesLicensePoints = query({
  args: { seriesId: v.id("series") },
  handler: async (ctx, args) => {
    const drivers = await ctx.db
      .query("drivers")
      .withIndex("by_championship", (q) => q.eq("championshipId", args.seriesId))
      .collect();

    const events = await ctx.db
      .query("events")
      .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId))
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
        const driverId = report.reportedDriverId.toString();

        if (penaltyAccumulator[driverId]) {
          penaltyAccumulator[driverId] += points;
        } else {
          penaltyAccumulator[driverId] = points;
        }
      }
    }

    const driverPoints = drivers.map((driver) => ({
      driverId: driver._id,
      driverNumber: driver.driverNumber,
      driverName: driver.driverName,
      totalLicensePoints: penaltyAccumulator[driver._id.toString()] ?? 0,
    }));

    driverPoints.sort((a, b) => b.totalLicensePoints - a.totalLicensePoints);

    return driverPoints;
  },
});

export const getSeriesLicensePointsWithPenalties = query({
  args: { seriesId: v.id("series") },
  handler: async (ctx, args) => {
    const drivers = await ctx.db
      .query("drivers")
      .withIndex("by_championship", (q) => q.eq("championshipId", args.seriesId))
      .collect();

    const events = await ctx.db
      .query("events")
      .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId))
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
        const driverId = report.reportedDriverId.toString();

        if (penaltyAccumulator[driverId]) {
          penaltyAccumulator[driverId] += points;
        } else {
          penaltyAccumulator[driverId] = points;
        }
      }
    }

    const allSeriesPenalties = await ctx.db
      .query("seriesPenalties")
      .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId))
      .collect();

    const seriesPenaltiesWithThresholds = await Promise.all(
      allSeriesPenalties.map(async (sp) => {
        const thresholds = await ctx.db
          .query("seriesPenaltyThresholds")
          .withIndex("by_series_penalty", (q) => q.eq("seriesPenaltyId", sp._id))
          .collect();
        
        return {
          ...sp,
          thresholds,
        };
      })
    );

    const driverPointsWithPenalties = await Promise.all(
      drivers.map(async (driver) => {
        const driverId = driver._id.toString();
        const totalPoints = penaltyAccumulator[driverId] ?? 0;

        const allDriverSeriesPenalties = await ctx.db
          .query("driverSeriesPenalties")
          .withIndex("by_driver_and_series", (q) =>
            q.eq("driverId", driver._id).eq("seriesId", args.seriesId)
          )
          .collect();

        const driverSeriesPenaltiesWithDetails = await Promise.all(
          allDriverSeriesPenalties.map(async (dsp) => {
            const seriesPenalty = await ctx.db.get(dsp.seriesPenaltyId);
            const servedByUser = dsp.servedBy ? await ctx.db.get(dsp.servedBy) : null;

            return {
              ...dsp,
              seriesPenalty,
              servedByUser,
            };
          })
        );

        const eligibleSeriesPenalties: any[] = [];
        
        for (const sp of seriesPenaltiesWithThresholds) {
          for (const threshold of sp.thresholds) {
            const appliesToDriver = threshold.driverClasses.includes(driver.driverClass);
            
            if (appliesToDriver && totalPoints >= threshold.threshold) {
              const alreadyAssigned = allDriverSeriesPenalties.some(
                (dsp) => dsp.seriesPenaltyId === sp._id && dsp.seriesPenaltyThresholdId === threshold._id
              );
              
              if (!alreadyAssigned) {
                eligibleSeriesPenalties.push({
                  seriesPenaltyId: sp._id,
                  penaltyName: sp.penaltyName,
                  penaltyDescription: sp.penaltyDescription,
                  driverClasses: threshold.driverClasses,
                  threshold: threshold.threshold,
                  seriesPenaltyThresholdId: threshold._id,
                  isAssigned: false,
                });
              }
            }
          }
        }

        return {
          driverId: driver._id,
          driverNumber: driver.driverNumber,
          driverName: driver.driverName,
          driverClass: driver.driverClass,
          totalLicensePoints: totalPoints,
          seriesPenalties: driverSeriesPenaltiesWithDetails,
          eligibleSeriesPenalties,
        };
      })
    );

    driverPointsWithPenalties.sort((a, b) => b.totalLicensePoints - a.totalLicensePoints);

    return driverPointsWithPenalties;
  },
});
