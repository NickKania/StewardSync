import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db
      .query("events")
      .withIndex("by_date")
      .order("desc")
      .collect();

    // Populate series information
    return await Promise.all(
      events.map(async (event) => {
        const series = await ctx.db.get(event.seriesId);
        return { ...event, series };
      })
    );
  },
});

export const getById = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) return null;

    const series = await ctx.db.get(event.seriesId);
    return { ...event, series };
  },
});

export const getWithRaces = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) return null;

    const series = await ctx.db.get(event.seriesId);

    const races = await ctx.db
      .query("races")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    return { ...event, series, races };
  },
});

export const create = mutation({
  args: {
    seriesId: v.id("series"),
    eventNumber: v.number(),
    trackName: v.string(),
    eventDate: v.number(),
  },
  handler: async (ctx, args) => {
    // Verify series exists
    const series = await ctx.db.get(args.seriesId);
    if (!series) {
      throw new Error("Series not found");
    }

    const eventId = await ctx.db.insert("events", {
      ...args,
      createdAt: Date.now(),
    });

    return eventId;
  },
});

export const update = mutation({
  args: {
    eventId: v.id("events"),
    seriesId: v.optional(v.id("series")),
    eventNumber: v.optional(v.number()),
    trackName: v.optional(v.string()),
    eventDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { eventId, ...updates } = args;

    // Verify series exists if being updated
    if (updates.seriesId) {
      const series = await ctx.db.get(updates.seriesId);
      if (!series) {
        throw new Error("Series not found");
      }
    }

    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(eventId, cleanUpdates);
    return eventId;
  },
});
