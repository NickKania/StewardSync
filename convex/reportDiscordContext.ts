import { internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./lib/auth";

export const getSelfReportContext = internalQuery({
  args: {
    currentUserId: v.id("users"),
    reportId: v.id("reports"),
    atFaultDriverId: v.optional(v.id("drivers")),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.currentUserId, [
      "steward",
      "head_steward",
      "event_manager",
      "league_manager",
    ]);

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    const event = await ctx.db.get(report.eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    const series = await ctx.db.get(event.seriesId);
    if (!series) {
      throw new Error("Series not found");
    }

    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_report", (q) => q.eq("reportId", args.reportId))
      .collect();

    const latestReview =
      reviews.length > 0
        ? reviews.reduce((latest, current) => {
            const latestDate = latest.reviewDate || latest.createdAt || 0;
            const currentDate = current.reviewDate || current.createdAt || 0;
            return currentDate > latestDate ? current : latest;
          })
        : null;

    const effectiveAtFaultDriverId =
      args.atFaultDriverId ??
      report.atFaultDriverId ??
      latestReview?.atFaultDriverId ??
      report.reportedDriverId;

    const driver = effectiveAtFaultDriverId
      ? await ctx.db.get(effectiveAtFaultDriverId)
      : null;
    const driverUser = driver?.userId ? await ctx.db.get(driver.userId) : null;
    const windowEnd = Date.now();

    return {
      reportId: args.reportId,
      windowStart: event.eventDate,
      windowEnd,
      channelId: series.discordIncidentChannelId ?? null,
      atFaultDriverId: effectiveAtFaultDriverId ?? null,
      driverDiscordId: driverUser?.discordId ?? null,
      driverLabel: driver
        ? `${driver.driverName} (#${driver.driverNumber})`
        : null,
    };
  },
});
