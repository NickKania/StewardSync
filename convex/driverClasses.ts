import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { UserFacingError } from "./lib/errors";

export const listBySeries = query({
  args: { seriesId: v.id("series") },
  handler: async (ctx, args) => {
    const driverClasses = await ctx.db
      .query("driverClasses")
      .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId))
      .collect();

    return driverClasses.sort((a, b) => a.className.localeCompare(b.className));
  },
});

export const getById = query({
  args: { id: v.id("driverClasses") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getBySeriesAndClassName = query({
  args: {
    seriesId: v.id("series"),
    className: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("driverClasses")
      .withIndex("by_series_class", (q) =>
        q.eq("seriesId", args.seriesId).eq("className", args.className)
      )
      .first();
  },
});

export const getOrCreate = mutation({
  args: {
    seriesId: v.id("series"),
    className: v.string(),
  },
  handler: async (ctx, args) => {
    // First, try to find existing driver class
    const existing = await ctx.db
      .query("driverClasses")
      .withIndex("by_series_class", (q) =>
        q.eq("seriesId", args.seriesId).eq("className", args.className)
      )
      .first();

    if (existing) {
      return { action: "existing" as const, driverClassId: existing._id };
    }

    // Create new driver class
    const driverClassId = await ctx.db.insert("driverClasses", {
      seriesId: args.seriesId,
      className: args.className,
      displayName: args.className, // Initially same as className
      createdAt: Date.now(),
    });

    return { action: "created" as const, driverClassId };
  },
});

export const create = mutation({
  args: {
    seriesId: v.id("series"),
    className: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if class already exists for this series
    const existing = await ctx.db
      .query("driverClasses")
      .withIndex("by_series_class", (q) =>
        q.eq("seriesId", args.seriesId).eq("className", args.className)
      )
      .first();

    if (existing) {
      throw new UserFacingError(
        `Driver class "${args.className}" already exists for this series`
      );
    }

    const driverClassId = await ctx.db.insert("driverClasses", {
      seriesId: args.seriesId,
      className: args.className,
      displayName: args.displayName,
      createdAt: Date.now(),
    });

    return driverClassId;
  },
});

export const updateDisplayName = mutation({
  args: {
    id: v.id("driverClasses"),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const driverClass = await ctx.db.get(args.id);
    if (!driverClass) {
      throw new UserFacingError("Driver class not found");
    }

    await ctx.db.patch(args.id, {
      displayName: args.displayName,
    });

    return args.id;
  },
});

export const remove = mutation({
  args: { id: v.id("driverClasses") },
  handler: async (ctx, args) => {
    // Check if any drivers are using this class
    const driversUsingClass = await ctx.db
      .query("drivers")
      .withIndex("by_driver_class", (q) => q.eq("driverClassId", args.id))
      .collect();

    if (driversUsingClass.length > 0) {
      throw new UserFacingError(
        `Cannot delete driver class: ${driversUsingClass.length} driver(s) are using this class`
      );
    }

    // Check if any series penalty thresholds are using this class
    const thresholds = await ctx.db
      .query("seriesPenaltyThresholds")
      .collect();

    const thresholdsUsingClass = thresholds.filter((t) =>
      t.driverClassIds.includes(args.id)
    );

    if (thresholdsUsingClass.length > 0) {
      throw new UserFacingError(
        `Cannot delete driver class: ${thresholdsUsingClass.length} penalty threshold(s) are using this class`
      );
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

export const getDriverClassesWithUsage = query({
  args: { seriesId: v.id("series") },
  handler: async (ctx, args) => {
    const driverClasses = await ctx.db
      .query("driverClasses")
      .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId))
      .collect();

    // Get usage counts for each class
    const classesWithUsage = await Promise.all(
      driverClasses.map(async (driverClass) => {
        const driversCount = await ctx.db
          .query("drivers")
          .withIndex("by_driver_class", (q) =>
            q.eq("driverClassId", driverClass._id)
          )
          .collect()
          .then((drivers) => drivers.length);

        return {
          ...driverClass,
          driversCount,
        };
      })
    );

    return classesWithUsage.sort((a, b) =>
      a.className.localeCompare(b.className)
    );
  },
});
