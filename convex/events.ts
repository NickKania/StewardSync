import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireRole } from "./lib/auth";

interface ImportOrUpdateEventResult {
  action: "created" | "updated";
  eventId: Id<"events">;
}

// Helper to avoid circular type inference in Convex API references.
async function runImportOrUpdateEvent(
  ctx: any,
  args: {
    seriesId: Id<"series">;
    eventNumber: number;
    trackName: string;
    eventDate: number;
  },
): Promise<ImportOrUpdateEventResult> {
  // @ts-ignore - Circular type inference in Convex API
  return ctx.runMutation(api.events.importOrUpdateEvent, args);
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db
      .query("events")
      .withIndex("by_date")
      .order("asc")
      .collect();

    // Filter out events from inactive series and populate series information
    const filteredEvents: any[] = [];
    for (const event of events) {
      const series = await ctx.db.get(event.seriesId);
      if (series && series.isActive !== false) {
        filteredEvents.push({ ...event, series });
      }
    }

    return filteredEvents;
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

export const getBySeriesId = query({
  args: { seriesId: v.id("series") },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("events")
      .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId))
      .collect();
    return events;
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

    const racesWithSessionNames = races
      .map((race) => ({
        ...race,
        sessionName:
          race.sessionName?.trim() ||
          (typeof race.raceNumber === "number"
            ? `Race ${race.raceNumber}`
            : "Session"),
      }))
      .sort((a, b) => {
        const left = a.raceNumber ?? Number.MAX_SAFE_INTEGER;
        const right = b.raceNumber ?? Number.MAX_SAFE_INTEGER;
        if (left !== right) return left - right;
        return a.sessionName.localeCompare(b.sessionName);
      });

    return { ...event, series, races: racesWithSessionNames };
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
    currentUserId: v.id("users"),
    seriesId: v.optional(v.id("series")),
    eventNumber: v.optional(v.number()),
    trackName: v.optional(v.string()),
    eventDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { eventId, currentUserId, ...updates } = args;

    await requireRole(ctx, currentUserId, ["event_manager", "league_manager"]);

    const existingEvent = await ctx.db.get(eventId);
    if (!existingEvent) {
      throw new Error("Event not found");
    }

    // Verify series exists if being updated
    if (updates.seriesId) {
      const series = await ctx.db.get(updates.seriesId);
      if (!series) {
        throw new Error("Series not found");
      }
    }

    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined),
    );

    const changedEntries = Object.entries(cleanUpdates).filter(
      ([field, value]) => (existingEvent as any)[field] !== value,
    );

    if (changedEntries.length === 0) {
      return eventId;
    }

    await ctx.db.patch(eventId, cleanUpdates);

    for (const [fieldName, toValue] of changedEntries) {
      await recordChange(ctx, {
        tableName: "events",
        documentId: String(eventId),
        fieldName,
        fromValue: serializeValue((existingEvent as any)[fieldName]),
        toValue: serializeValue(toValue),
        changedByUserId: currentUserId,
        source: "manual",
      });
    }

    return eventId;
  },
});

export const importOrUpdateEvent = mutation({
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

    // Check if event with same seriesId and eventNumber exists
    const existing = await ctx.db
      .query("events")
      .withIndex("by_series_and_number", (q) =>
        q.eq("seriesId", args.seriesId).eq("eventNumber", args.eventNumber),
      )
      .first();

    if (existing) {
      // Update existing event
      const updates: {
        trackName?: string;
        eventDate?: number;
      } = {};

      if (existing.trackName !== args.trackName) {
        updates.trackName = args.trackName;
      }

      if (existing.eventDate !== args.eventDate) {
        updates.eventDate = args.eventDate;
      }

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);

        if (updates.trackName !== undefined) {
          await recordChange(ctx, {
            tableName: "events",
            documentId: String(existing._id),
            fieldName: "trackName",
            fromValue: serializeValue(existing.trackName),
            toValue: serializeValue(updates.trackName),
            source: "simgrid",
          });
        }

        if (updates.eventDate !== undefined) {
          await recordChange(ctx, {
            tableName: "events",
            documentId: String(existing._id),
            fieldName: "eventDate",
            fromValue: serializeValue(existing.eventDate),
            toValue: serializeValue(updates.eventDate),
            source: "simgrid",
          });
        }
      }

      return { action: "updated", eventId: existing._id };
    } else {
      // Create new event
      const eventId = await ctx.db.insert("events", {
        seriesId: args.seriesId,
        eventNumber: args.eventNumber,
        trackName: args.trackName,
        eventDate: args.eventDate,
        createdAt: Date.now(),
      });
      return { action: "created", eventId };
    }
  },
});

// Helper function to avoid circular type inference in Convex
async function runGetSeriesByIdWithSimgridLink(
  ctx: any,
  args: { id: Id<"series"> },
) {
  return ctx.runQuery("series:getByIdWithSimgridLink", args);
}

export const importFromSimGrid = action({
  args: { seriesId: v.id("series") },
  handler: async (ctx, args) => {
    const apiKey = process.env["SIMGRID_API_KEY"];
    if (!apiKey) {
      throw new Error("SIMGRID_API_KEY environment variable not configured");
    }

    const series = await runGetSeriesByIdWithSimgridLink(ctx, {
      id: args.seriesId,
    });
    if (!series || !series.simgridLink) {
      throw new Error("Series not found or simgridLink not configured");
    }

    const championshipId = extractChampionshipId(series.simgridLink);
    if (!championshipId) {
      throw new Error("Could not extract championship ID from simgridLink");
    }

    const response = await fetch(
      `https://www.thesimgrid.com/api/v1/races?championship_id=${championshipId}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );
    if (!response.ok) {
      throw new Error(`SimGrid API error: ${response.statusText}`);
    }

    const races = await response.json();

    let created = 0;
    let skipped = 0;

    const sortedRaces = races.sort(
      (a: any, b: any) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );

    for (let i = 0; i < sortedRaces.length; i++) {
      const race = sortedRaces[i];
      const eventDate = new Date(race.starts_at).getTime();
      if (isNaN(eventDate)) continue;

      const trackName =
        race.track?.name || race.display_name || "Unknown Track";

      const result = await runImportOrUpdateEvent(ctx, {
        seriesId: args.seriesId,
        eventNumber: i + 1,
        trackName: trackName,
        eventDate,
      });

      if (result.action === "created") {
        created++;
      } else {
        skipped++;
      }
    }

    return { created, skipped };
  },
});

function extractChampionshipId(url: string): string | null {
  const patterns = [/championship\/(\d+)/, /id=(\d+)/, /\/(\d+)\/?$/];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function serializeValue(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function recordChange(
  ctx: any,
  args: {
    tableName: string;
    documentId: string;
    fieldName: string;
    fromValue?: string;
    toValue?: string;
    changedByUserId?: Id<"users">;
    source: "manual" | "simgrid" | "system";
  },
) {
  await ctx.db.insert("changeHistory", {
    tableName: args.tableName,
    documentId: args.documentId,
    fieldName: args.fieldName,
    fromValue: args.fromValue,
    toValue: args.toValue,
    changedByUserId: args.changedByUserId,
    source: args.source,
    changedAt: Date.now(),
  });
}
