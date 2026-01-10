import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const races = await ctx.db.query("races").collect();

    const racesWithEvents = await Promise.all(
      races.map(async (race) => {
        const event = await ctx.db.get(race.eventId);
        return { ...race, event };
      })
    );

    return racesWithEvents;
  },
});

export const getByEvent = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("races")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
  },
});

export const getById = query({
  args: { raceId: v.id("races") },
  handler: async (ctx, args) => {
    const race = await ctx.db.get(args.raceId);
    if (!race) return null;

    const event = await ctx.db.get(race.eventId);
    return { ...race, event };
  },
});

export const create = mutation({
  args: {
    eventId: v.id("events"),
    raceNumber: v.number(),
  },
  handler: async (ctx, args) => {
    // Verify event exists
    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    // Check if race number already exists for this event
    const existingRaces = await ctx.db
      .query("races")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    if (existingRaces.some((r) => r.raceNumber === args.raceNumber)) {
      throw new Error(`Race ${args.raceNumber} already exists for this event`);
    }

    const raceId = await ctx.db.insert("races", {
      ...args,
      createdAt: Date.now(),
    });

    return raceId;
  },
});

export const remove = mutation({
  args: { raceId: v.id("races") },
  handler: async (ctx, args) => {
    // Check if there are any reports for this race
    const reports = await ctx.db
      .query("reports")
      .filter((q) => q.eq(q.field("raceId"), args.raceId))
      .first();

    if (reports) {
      throw new Error("Cannot delete race with existing reports");
    }

    await ctx.db.delete(args.raceId);
  },
});
