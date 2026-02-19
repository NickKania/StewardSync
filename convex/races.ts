import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { UserFacingError } from "./lib/errors";

function buildSessionName(race: {
  sessionName?: string;
  raceNumber?: number;
}): string {
  const explicit = race.sessionName?.trim();
  if (explicit) return explicit;

  if (typeof race.raceNumber === "number" && Number.isFinite(race.raceNumber)) {
    return `Race ${race.raceNumber}`;
  }

  return "Session";
}

function normalizeSessionName(name: string): string {
  return name.trim().toLowerCase();
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const races = await ctx.db.query("races").collect();

    const racesWithEvents = await Promise.all(
      races.map(async (race) => {
        const event = await ctx.db.get(race.eventId);
        return { ...race, sessionName: buildSessionName(race), event };
      }),
    );

    return racesWithEvents;
  },
});

export const getByEvent = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const races = await ctx.db
      .query("races")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    return races
      .map((race) => ({ ...race, sessionName: buildSessionName(race) }))
      .sort((a, b) => {
        const left = a.raceNumber ?? Number.MAX_SAFE_INTEGER;
        const right = b.raceNumber ?? Number.MAX_SAFE_INTEGER;
        if (left !== right) return left - right;
        return a.sessionName.localeCompare(b.sessionName);
      });
  },
});

export const getById = query({
  args: { raceId: v.id("races") },
  handler: async (ctx, args) => {
    const race = await ctx.db.get(args.raceId);
    if (!race) return null;

    const event = await ctx.db.get(race.eventId);
    return { ...race, sessionName: buildSessionName(race), event };
  },
});

export const create = mutation({
  args: {
    eventId: v.id("events"),
    raceNumber: v.optional(v.number()),
    sessionName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify event exists
    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    const normalizedProvidedSessionName =
      args.sessionName && args.sessionName.trim()
        ? normalizeSessionName(args.sessionName)
        : typeof args.raceNumber === "number"
          ? normalizeSessionName(`Race ${args.raceNumber}`)
          : "";

    if (!normalizedProvidedSessionName) {
      throw new UserFacingError("Session name is required");
    }

    if (
      args.raceNumber !== undefined &&
      (!Number.isInteger(args.raceNumber) || args.raceNumber < 1)
    ) {
      throw new UserFacingError("Race number must be a positive whole number");
    }

    // Check if session label or race number already exists for this event
    const existingRaces = await ctx.db
      .query("races")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    if (
      existingRaces.some(
        (r) =>
          normalizeSessionName(buildSessionName(r)) ===
          normalizedProvidedSessionName,
      )
    ) {
      throw new UserFacingError(
        `Session "${buildSessionName(args)}" already exists for this event`,
      );
    }

    if (
      args.raceNumber !== undefined &&
      existingRaces.some((r) => r.raceNumber === args.raceNumber)
    ) {
      throw new UserFacingError(
        `Race ${args.raceNumber} already exists for this event`,
      );
    }

    const sessionName = args.sessionName?.trim() || buildSessionName(args);
    const raceId = await ctx.db.insert("races", {
      eventId: args.eventId,
      raceNumber:
        args.raceNumber ??
        (sessionName.match(/^race\s+(\d+)$/i)
          ? Number(sessionName.match(/^race\s+(\d+)$/i)?.[1])
          : 0),
      sessionName,
      createdAt: Date.now(),
    });

    return raceId;
  },
});

export const remove = mutation({
  args: { raceId: v.id("races") },
  handler: async (ctx, args) => {
    // Check if there are any reports for this session
    const reports = await ctx.db
      .query("reports")
      .filter((q) => q.eq(q.field("raceId"), args.raceId))
      .first();

    if (reports) {
      throw new UserFacingError("Cannot delete session with existing reports");
    }

    await ctx.db.delete(args.raceId);
  },
});
