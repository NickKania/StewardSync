import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireRole } from "./lib/auth";
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
    currentUserId: v.id("users"),
    eventId: v.id("events"),
    raceNumber: v.optional(v.number()),
    sessionName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.currentUserId as Id<"users">, ["event_manager", "league_manager"]);
    const { currentUserId, ...data } = args;
    // Verify event exists
    const event = await ctx.db.get(data.eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    const normalizedProvidedSessionName =
      data.sessionName && data.sessionName.trim()
        ? normalizeSessionName(data.sessionName)
        : typeof data.raceNumber === "number"
          ? normalizeSessionName(`Race ${data.raceNumber}`)
          : "";

    if (!normalizedProvidedSessionName) {
      throw new UserFacingError("Session name is required");
    }

    if (
      data.raceNumber !== undefined &&
      (!Number.isInteger(data.raceNumber) || data.raceNumber < 1)
    ) {
      throw new UserFacingError("Race number must be a positive whole number");
    }

    const existingRaces = await ctx.db
      .query("races")
      .withIndex("by_event", (q) => q.eq("eventId", data.eventId))
      .collect();

    if (
      existingRaces.some(
        (r) =>
          normalizeSessionName(buildSessionName(r)) ===
          normalizedProvidedSessionName,
      )
    ) {
      throw new UserFacingError(
        `Session "${buildSessionName(data)}" already exists for this event`,
      );
    }

    if (
      data.raceNumber !== undefined &&
      existingRaces.some((r) => r.raceNumber === data.raceNumber)
    ) {
      throw new UserFacingError(
        `Race ${data.raceNumber} already exists for this event`,
      );
    }

    const sessionName = data.sessionName?.trim() || buildSessionName(data);
    const raceId = await ctx.db.insert("races", {
      eventId: data.eventId,
      raceNumber:
        data.raceNumber ??
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
  args: { raceId: v.id("races"), currentUserId: v.id("users") },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.currentUserId as Id<"users">, ["event_manager", "league_manager"]);

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
