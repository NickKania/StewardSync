import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("events")
      .withIndex("by_date")
      .order("desc")
      .collect();
  },
});

export const getById = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.eventId);
  },
});

export const getWithRaces = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) return null;

    const races = await ctx.db
      .query("races")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    return { ...event, races };
  },
});

export const create = mutation({
  args: {
    series: v.string(),
    eventNumber: v.number(),
    trackName: v.string(),
    eventDate: v.number(),
  },
  handler: async (ctx, args) => {
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
    series: v.optional(v.string()),
    eventNumber: v.optional(v.number()),
    trackName: v.optional(v.string()),
    eventDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { eventId, ...updates } = args;

    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(eventId, cleanUpdates);
    return eventId;
  },
});
