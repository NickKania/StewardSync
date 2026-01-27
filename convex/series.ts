import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { UserFacingError } from "./lib/errors";

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("series").order("desc").collect();
  },
});

export const getById = query({
  args: { id: v.id("series") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    simgridLink: v.optional(v.string()),
    reportingOpenTime: v.optional(v.string()),
    reportingCloseDuration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.reportingOpenTime && !isValidTimeFormat(args.reportingOpenTime)) {
      throw new UserFacingError("Invalid reportingOpenTime format. Use HH:MM (24-hour format)");
    }

    if (args.reportingCloseDuration !== undefined && args.reportingCloseDuration <= 0) {
      throw new UserFacingError("reportingCloseDuration must be a positive number");
    }

    const seriesId = await ctx.db.insert("series", {
      name: args.name,
      description: args.description,
      simgridLink: args.simgridLink,
      reportingOpenTime: args.reportingOpenTime,
      reportingCloseDuration: args.reportingCloseDuration,
      createdAt: Date.now(),
    });
    return seriesId;
  },
});

export const update = mutation({
  args: {
    id: v.id("series"),
    name: v.string(),
    description: v.optional(v.string()),
    simgridLink: v.optional(v.string()),
    reportingOpenTime: v.optional(v.string()),
    reportingCloseDuration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    if (updates.reportingOpenTime && !isValidTimeFormat(updates.reportingOpenTime)) {
      throw new UserFacingError("Invalid reportingOpenTime format. Use HH:MM (24-hour format)");
    }

    if (updates.reportingCloseDuration !== undefined && updates.reportingCloseDuration <= 0) {
      throw new UserFacingError("reportingCloseDuration must be a positive number");
    }

    await ctx.db.patch(id, updates);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("series") },
  handler: async (ctx, args) => {
    // Check if any events are using this series
    const events = await ctx.db
      .query("events")
      .withIndex("by_series", (q) => q.eq("seriesId", args.id))
      .first();

    if (events) {
      throw new UserFacingError("Cannot delete series with existing events");
    }

    await ctx.db.delete(args.id);
  },
});

function isValidTimeFormat(time: string): boolean {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}
