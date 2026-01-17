import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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
    seriesId: v.id("series"),
    name: v.string(),
    timePenalty: v.number(),
    selfReportReduction: v.optional(v.number()),
    timePenaltyLap1: v.optional(v.number()),
    licensePoints: v.number(),
  },
  handler: async (ctx, args) => {
    const series = await ctx.db.get(args.seriesId);
    if (!series) {
      throw new Error("Series not found");
    }

    const penaltyId = await ctx.db.insert("penalties", {
      seriesId: args.seriesId,
      name: args.name,
      timePenalty: args.timePenalty,
      selfReportReduction: args.selfReportReduction ?? 0,
      timePenaltyLap1: args.timePenaltyLap1 ?? args.timePenalty,
      licensePoints: args.licensePoints,
      createdAt: Date.now(),
    });

    return penaltyId;
  },
});

export const update = mutation({
  args: {
    id: v.id("penalties"),
    name: v.string(),
    timePenalty: v.number(),
    selfReportReduction: v.optional(v.number()),
    timePenaltyLap1: v.optional(v.number()),
    licensePoints: v.number(),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    const cleanUpdates = {
      name: updates.name,
      timePenalty: updates.timePenalty,
      selfReportReduction: updates.selfReportReduction ?? 0,
      licensePoints: updates.licensePoints,
      ...(updates.timePenaltyLap1 !== undefined && { timePenaltyLap1: updates.timePenaltyLap1 }),
    };

    await ctx.db.patch(id, cleanUpdates);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("penalties") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
