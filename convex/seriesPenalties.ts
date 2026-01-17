import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    seriesId: v.id("series"),
    driverClass: v.optional(v.string()),
    threshold: v.number(),
    penaltyName: v.string(),
    penaltyDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const seriesPenaltyId = await ctx.db.insert("seriesPenalties", {
      seriesId: args.seriesId,
      driverClass: args.driverClass,
      threshold: args.threshold,
      penaltyName: args.penaltyName,
      penaltyDescription: args.penaltyDescription,
      createdAt: Date.now(),
    });
    return seriesPenaltyId;
  },
});

export const update = mutation({
  args: {
    id: v.id("seriesPenalties"),
    driverClass: v.optional(v.string()),
    threshold: v.number(),
    penaltyName: v.string(),
    penaltyDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("seriesPenalties") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
