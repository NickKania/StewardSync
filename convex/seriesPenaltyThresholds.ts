import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./lib/auth";
import { Id } from "./_generated/dataModel";

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
    currentUserId: v.id("users"),
    seriesPenaltyId: v.id("seriesPenalties"),
    threshold: v.number(),
    driverClassIds: v.array(v.id("driverClasses")),
    requiresReview: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.currentUserId as Id<"users">, ["event_manager", "league_manager"]);
    const { currentUserId, ...data } = args;
    const thresholdId = await ctx.db.insert("seriesPenaltyThresholds", {
      seriesPenaltyId: data.seriesPenaltyId,
      threshold: data.threshold,
      driverClassIds: data.driverClassIds,
      requiresReview: data.requiresReview,
      createdAt: Date.now(),
    });
    return thresholdId;
  },
});

export const update = mutation({
  args: {
    id: v.id("seriesPenaltyThresholds"),
    currentUserId: v.id("users"),
    threshold: v.number(),
    driverClassIds: v.array(v.id("driverClasses")),
    requiresReview: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.currentUserId as Id<"users">, ["event_manager", "league_manager"]);
    const { id, currentUserId, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("seriesPenaltyThresholds"), currentUserId: v.id("users") },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.currentUserId as Id<"users">, ["event_manager", "league_manager"]);
    await ctx.db.delete(args.id);
  },
});
