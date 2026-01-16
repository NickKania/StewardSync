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

        const timePenaltySeconds = appliedPenalty && report.isSelfReport
          ? appliedPenalty.timePenaltyWithSelfReport
          : appliedPenalty?.timePenalty ?? 0;

        return {
          reportId: report._id,
          carNumber: reportedDriver?.driverNumber ?? null,
          driverName: reportedDriver?.driverName ?? null,
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
