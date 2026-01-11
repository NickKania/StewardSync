import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { Console } from "console";

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
      }),
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
      Object.entries(updates).filter(([_, v]) => v !== undefined),
    );

    await ctx.db.patch(eventId, cleanUpdates);
    return eventId;
  },
});

export const importFromSimGrid = action({
  args: { seriesId: v.id("series") },
  handler: async (ctx, args) => {
    const apiKey = process.env["SIMGRID_API_KEY"];
    if (!apiKey) {
      throw new Error("SIMGRID_API_KEY environment variable not configured");
    }

    const series = await ctx.runQuery(api.series.getById, {
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

    const sortedRaces = races.sort((a: any, b: any) =>
      new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    );

    for (let i = 0; i < sortedRaces.length; i++) {
      const race = sortedRaces[i];
      const eventDate = new Date(race.starts_at).getTime();
      if (isNaN(eventDate)) continue;

      const trackName = race.track?.name || race.display_name || "Unknown Track";

      try {
        await ctx.runMutation(api.events.create, {
          seriesId: args.seriesId,
          eventNumber: i + 1,
          trackName: trackName,
          eventDate,
        });
        created++;
      } catch (e) {
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
