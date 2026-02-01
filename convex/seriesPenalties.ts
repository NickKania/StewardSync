import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const seriesPenalties = await ctx.db.query("seriesPenalties").collect();

    const seriesPenaltiesWithDetails = await Promise.all(
      seriesPenalties.map(async (sp) => {
        const series = await ctx.db.get(sp.seriesId);
        const thresholds = await ctx.db
          .query("seriesPenaltyThresholds")
          .withIndex("by_series_penalty", (q) => q.eq("seriesPenaltyId", sp._id))
          .collect();

        // Populate driverClassObjects for each threshold
        const thresholdsWithDriverClasses = await Promise.all(
          thresholds.map(async (t) => {
            const driverClassObjects = await Promise.all(
              t.driverClassIds.map(async (id) => await ctx.db.get(id)),
            ).then((classes) => classes.filter(Boolean));

            return {
              ...t,
              driverClassObjects,
            };
          }),
        );

        return {
          ...sp,
          series,
          thresholds: thresholdsWithDriverClasses,
        };
      }),
    );

    return seriesPenaltiesWithDetails;
  },
});

export const listBySeries = query({
  args: { seriesId: v.id("series") },
  handler: async (ctx, args) => {
    const seriesPenalties = await ctx.db
      .query("seriesPenalties")
      .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId))
      .collect();

    const seriesPenaltiesWithDetails = await Promise.all(
      seriesPenalties.map(async (sp) => {
        const series = await ctx.db.get(sp.seriesId);
        const thresholds = await ctx.db
          .query("seriesPenaltyThresholds")
          .withIndex("by_series_penalty", (q) => q.eq("seriesPenaltyId", sp._id))
          .collect();

        // Populate driverClassObjects for each threshold
        const thresholdsWithDriverClasses = await Promise.all(
          thresholds.map(async (t) => {
            const driverClassObjects = await Promise.all(
              t.driverClassIds.map(async (id) => await ctx.db.get(id)),
            ).then((classes) => classes.filter(Boolean));

            return {
              ...t,
              driverClassObjects,
            };
          }),
        );

        return {
          ...sp,
          series,
          thresholds: thresholdsWithDriverClasses,
        };
      }),
    );

    return seriesPenaltiesWithDetails;
  },
});

export const getById = query({
  args: { id: v.id("seriesPenalties") },
  handler: async (ctx, args) => {
    const seriesPenalty = await ctx.db.get(args.id);
    if (!seriesPenalty) {
      return null;
    }

    const series = await ctx.db.get(seriesPenalty.seriesId);
    const thresholds = await ctx.db
      .query("seriesPenaltyThresholds")
      .withIndex("by_series_penalty", (q) => q.eq("seriesPenaltyId", args.id))
      .collect();

    // Populate driverClassObjects for each threshold
    const thresholdsWithDriverClasses = await Promise.all(
      thresholds.map(async (t) => {
        const driverClassObjects = await Promise.all(
          t.driverClassIds.map(async (id) => await ctx.db.get(id)),
        ).then((classes) => classes.filter(Boolean));

        return {
          ...t,
          driverClassObjects,
        };
      }),
    );

    return {
      ...seriesPenalty,
      series,
      thresholds: thresholdsWithDriverClasses,
    };
  },
});

export const create = mutation({
  args: {
    seriesId: v.id("series"),
    penaltyName: v.string(),
    penaltyDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const seriesPenaltyId = await ctx.db.insert("seriesPenalties", {
      seriesId: args.seriesId,
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
