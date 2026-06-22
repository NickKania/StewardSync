import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./lib/auth";
import { Id } from "./_generated/dataModel";
import { recalculateSeriesLicensePoints } from "./lib/penalties";
import { UserFacingError } from "./lib/errors";

export const list = query({
  handler: async (ctx) => {
    const penalties = await ctx.db.query("penalties").collect();

    // Populate series information
    return await Promise.all(
      penalties.map(async (penalty) => {
        const series = await ctx.db.get(penalty.seriesId);
        return { ...penalty, series };
      })
    );
  },
});

export const getBySeries = query({
  args: { seriesId: v.id("series") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("penalties")
      .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId))
      .collect();
  },
});

export const getById = query({
  args: { id: v.id("penalties") },
  handler: async (ctx, args) => {
    const penalty = await ctx.db.get(args.id);
    if (!penalty) return null;

    const series = await ctx.db.get(penalty.seriesId);
    return { ...penalty, series };
  },
});

export const create = mutation({
  args: {
    currentUserId: v.id("users"),
    seriesId: v.id("series"),
    name: v.string(),
    timePenalty: v.number(),
    selfReportReduction: v.optional(v.number()),
    timePenaltyLap1: v.optional(v.number()),
    licensePoints: v.number(),
    selfReportLicensePointReduction: v.optional(v.number()),
    allowNoDriverAtFault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { currentUserId, ...data } = args;
    await requireRole(ctx, currentUserId as Id<"users">, ["event_manager", "league_manager"]);

    const series = await ctx.db.get(data.seriesId);
    if (!series) {
      throw new UserFacingError("Series not found");
    }

    const penaltyId = await ctx.db.insert("penalties", {
      seriesId: data.seriesId,
      name: data.name,
      timePenalty: data.timePenalty,
      selfReportReduction: data.selfReportReduction ?? 0,
      timePenaltyLap1: data.timePenaltyLap1 ?? data.timePenalty,
      licensePoints: data.licensePoints,
      selfReportLicensePointReduction: data.selfReportLicensePointReduction ?? 0,
      allowNoDriverAtFault: data.allowNoDriverAtFault ?? false,
      createdAt: Date.now(),
    });

    return penaltyId;
  },
});

export const update = mutation({
  args: {
    id: v.id("penalties"),
    currentUserId: v.id("users"),
    name: v.string(),
    timePenalty: v.number(),
    selfReportReduction: v.optional(v.number()),
    timePenaltyLap1: v.optional(v.number()),
    licensePoints: v.number(),
    selfReportLicensePointReduction: v.optional(v.number()),
    allowNoDriverAtFault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.currentUserId as Id<"users">, ["event_manager", "league_manager"]);
    const { id, currentUserId, ...updates } = args;
    const existingPenalty = await ctx.db.get(id);
    if (!existingPenalty) {
      throw new UserFacingError("Penalty not found");
    }

    const cleanUpdates = {
      name: updates.name,
      timePenalty: updates.timePenalty,
      selfReportReduction: updates.selfReportReduction ?? 0,
      licensePoints: updates.licensePoints,
      selfReportLicensePointReduction: updates.selfReportLicensePointReduction ?? 0,
      ...(updates.allowNoDriverAtFault !== undefined && {
        allowNoDriverAtFault: updates.allowNoDriverAtFault,
      }),
      ...(updates.timePenaltyLap1 !== undefined && { timePenaltyLap1: updates.timePenaltyLap1 }),
    };

    await ctx.db.patch(id, cleanUpdates);

    const licenseFieldsChanged =
      existingPenalty.licensePoints !== cleanUpdates.licensePoints ||
      existingPenalty.selfReportLicensePointReduction !== cleanUpdates.selfReportLicensePointReduction;

    if (licenseFieldsChanged) {
      await recalculateSeriesLicensePoints(ctx, existingPenalty.seriesId);
    }

    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("penalties"), currentUserId: v.id("users") },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.currentUserId as Id<"users">, ["event_manager", "league_manager"]);
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new UserFacingError("Penalty not found");
    }
    await ctx.db.delete(args.id);
    await recalculateSeriesLicensePoints(ctx, existing.seriesId);
  },
});
