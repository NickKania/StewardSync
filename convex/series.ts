import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { UserFacingError } from "./lib/errors";

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("series").order("desc").collect();
  },
});

export const listActive = query({
  handler: async (ctx) => {
    const series = await ctx.db.query("series").order("desc").collect();
    return series.filter(s => s.isActive !== false);
  },
});

export const getById = query({
  args: { id: v.id("series") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByIdWithSimgridLink = query({
  args: { id: v.id("series") },
  handler: async (ctx, args) => {
    const series = await ctx.db.get(args.id);
    if (!series) return null;
    return series;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    simgridLink: v.optional(v.string()),
    reportingOpenTime: v.optional(v.string()),
    reportingCloseDuration: v.optional(v.number()),
    isReportingLocked: v.optional(v.boolean()),
    requireVideoEvidence: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
    seriesPenaltyNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.reportingOpenTime && !isValidTimeFormat(args.reportingOpenTime)) {
      throw new UserFacingError("Invalid reportingOpenTime format. Use HH:MM (24-hour format)");
    }

    if (args.reportingCloseDuration !== undefined && args.reportingCloseDuration <= 0) {
      throw new UserFacingError("reportingCloseDuration must be a positive number");
    }

    const insertData: any = {
      name: args.name,
      description: args.description,
      simgridLink: args.simgridLink,
      reportingOpenTime: args.reportingOpenTime,
      reportingCloseDuration: args.reportingCloseDuration,
      requireVideoEvidence: args.requireVideoEvidence,
      seriesPenaltyNotes: args.seriesPenaltyNotes,
      createdAt: Date.now(),
    };

    if (args.isReportingLocked !== undefined) {
      insertData.isReportingLocked = args.isReportingLocked;
    }

    if (args.isActive !== undefined) {
      insertData.isActive = args.isActive;
    }

    const seriesId = await ctx.db.insert("series", insertData);
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
    isReportingLocked: v.optional(v.boolean()),
    requireVideoEvidence: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
    seriesPenaltyNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    if (updates.reportingOpenTime) {
      if (!isValidTimeFormat(updates.reportingOpenTime)) {
        throw new UserFacingError("Invalid reportingOpenTime format. Use HH:MM (24-hour format)");
      }
    }

    if (updates.reportingCloseDuration !== undefined && updates.reportingCloseDuration <= 0) {
      throw new UserFacingError("reportingCloseDuration must be a positive number");
    }

    const cleanUpdates: any = {};
    
    if (updates.name !== undefined) cleanUpdates.name = updates.name;
    if (updates.description !== undefined) cleanUpdates.description = updates.description;
    if (updates.simgridLink !== undefined) cleanUpdates.simgridLink = updates.simgridLink;
    if (updates.reportingOpenTime !== undefined) {
      cleanUpdates.reportingOpenTime = updates.reportingOpenTime || undefined;
    }
    if (updates.reportingCloseDuration !== undefined) cleanUpdates.reportingCloseDuration = updates.reportingCloseDuration;
    if (updates.isReportingLocked !== undefined) cleanUpdates.isReportingLocked = updates.isReportingLocked;
    if (updates.requireVideoEvidence !== undefined) cleanUpdates.requireVideoEvidence = updates.requireVideoEvidence;
    if (updates.isActive !== undefined) cleanUpdates.isActive = updates.isActive;
    if (updates.seriesPenaltyNotes !== undefined) cleanUpdates.seriesPenaltyNotes = updates.seriesPenaltyNotes;

    await ctx.db.patch(id, cleanUpdates);
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
