import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { UserFacingError } from "./lib/errors";
import { getCurrentUserRole, hasMinimumRole, requireRole } from "./lib/auth";

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

export const listActiveForUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const userRole = await getCurrentUserRole(ctx, args.userId);

    if (hasMinimumRole(userRole, "steward")) {
      const series = await ctx.db.query("series").order("desc").collect();
      return series.filter(s => s.isActive !== false);
    }

    const drivers = await ctx.db
      .query("drivers")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .collect();

    const seriesIds = new Set(
      drivers
        .filter((d) => d.championshipId)
        .map((d) => d.championshipId)
    );

    if (seriesIds.size === 0) {
      return [];
    }

    const allSeries = await ctx.db.query("series").collect();
    return allSeries.filter(
      (s) => s.isActive !== false && seriesIds.has(s._id)
    );
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
    currentUserId: v.id("users"),
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
    const { currentUserId, ...data } = args;
    await requireRole(ctx, currentUserId, ["event_manager", "league_manager"]);

    if (data.reportingOpenTime && !isValidTimeFormat(data.reportingOpenTime)) {
      throw new UserFacingError("Invalid reportingOpenTime format. Use HH:MM (24-hour format)");
    }

    if (data.reportingCloseDuration !== undefined && data.reportingCloseDuration <= 0) {
      throw new UserFacingError("reportingCloseDuration must be a positive number");
    }

    const insertData: any = {
      name: data.name,
      description: data.description,
      simgridLink: data.simgridLink,
      reportingOpenTime: data.reportingOpenTime,
      reportingCloseDuration: data.reportingCloseDuration,
      requireVideoEvidence: data.requireVideoEvidence,
      seriesPenaltyNotes: data.seriesPenaltyNotes,
      createdAt: Date.now(),
    };

    if (data.isReportingLocked !== undefined) {
      insertData.isReportingLocked = data.isReportingLocked;
    }

    if (data.isActive !== undefined) {
      insertData.isActive = data.isActive;
    }

    const seriesId = await ctx.db.insert("series", insertData);
    return seriesId;
  },
});

export const update = mutation({
  args: {
    id: v.id("series"),
    currentUserId: v.id("users"),
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
    const { id, currentUserId, ...updates } = args;

    await requireRole(ctx, currentUserId, ["event_manager", "league_manager"]);

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
  args: { id: v.id("series"), currentUserId: v.id("users") },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.currentUserId, ["event_manager", "league_manager"]);
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
