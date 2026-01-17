import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    seriesPenaltyId: v.id("seriesPenalties"),
    driverClass: v.string(),
    threshold: v.number(),
  },
  handler: async (ctx, args) => {
    const thresholdId = await ctx.db.insert("seriesPenaltyThresholds", {
      seriesPenaltyId: args.seriesPenaltyId,
      driverClass: args.driverClass,
      threshold: args.threshold,
      createdAt: Date.now(),
    });
    return thresholdId;
  },
});

export const update = mutation({
  args: {
    id: v.id("seriesPenaltyThresholds"),
    driverClass: v.string(),
    threshold: v.number(),
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
