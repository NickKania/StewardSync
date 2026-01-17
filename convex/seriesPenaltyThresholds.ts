import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listBySeriesPenalty = query({
  args: { seriesPenaltyId: v.id("seriesPenalties") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("seriesPenaltyThresholds")
      .withIndex("by_series_penalty", (q) => q.eq("seriesPenaltyId", args.seriesPenaltyId))
      .collect();
  },
});

export const getById = query({
  args: { id: v.id("seriesPenaltyThresholds") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    seriesPenaltyId: v.id("seriesPenalties"),
    threshold: v.number(),
    driverClasses: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const thresholdId = await ctx.db.insert("seriesPenaltyThresholds", {
      seriesPenaltyId: args.seriesPenaltyId,
      threshold: args.threshold,
      driverClasses: args.driverClasses,
      createdAt: Date.now(),
    });
    return thresholdId;
  },
});

export const update = mutation({
  args: {
    id: v.id("seriesPenaltyThresholds"),
    threshold: v.number(),
    driverClasses: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("seriesPenaltyThresholds") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
