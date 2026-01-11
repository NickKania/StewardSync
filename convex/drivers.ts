import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("drivers").collect();
  },
});

export const getById = query({
  args: { driverId: v.id("drivers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.driverId);
  },
});

export const getByNumber = query({
  args: { driverNumber: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("drivers")
      .withIndex("by_number", (q) => q.eq("driverNumber", args.driverNumber))
      .first();
  },
});

export const getBySteamId = query({
  args: { steamId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("drivers")
      .withIndex("by_steam_id", (q) => q.eq("steamId", args.steamId))
      .first();
  },
});

export const getByChampionship = query({
  args: { championshipId: v.id("series") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("drivers")
      .withIndex("by_championship", (q) => q.eq("championshipId", args.championshipId))
      .collect();
  },
});

export const create = mutation({
  args: {
    driverNumber: v.number(),
    driverName: v.string(),
    username: v.optional(v.string()),
    externalId: v.optional(v.string()),
    driverClass: v.string(),
    steamId: v.optional(v.string()),
    championshipId: v.optional(v.id("series")),
  },
  handler: async (ctx, args) => {
    // Check if driver number already exists
    const existing = await ctx.db
      .query("drivers")
      .withIndex("by_number", (q) => q.eq("driverNumber", args.driverNumber))
      .first();

    if (existing) {
      throw new Error(`Driver with number ${args.driverNumber} already exists`);
    }

    const driverId = await ctx.db.insert("drivers", {
      ...args,
      createdAt: Date.now(),
    });

    return driverId;
  },
});

export const update = mutation({
  args: {
    driverId: v.id("drivers"),
    driverNumber: v.optional(v.number()),
    driverName: v.optional(v.string()),
    username: v.optional(v.string()),
    externalId: v.optional(v.string()),
    driverClass: v.optional(v.string()),
    steamId: v.optional(v.string()),
    championshipId: v.optional(v.id("series")),
  },
  handler: async (ctx, args) => {
    const { driverId, ...updates } = args;

    // If updating driver number, check it's not taken
    if (updates.driverNumber !== undefined) {
      const existing = await ctx.db
        .query("drivers")
        .withIndex("by_number", (q) => q.eq("driverNumber", updates.driverNumber!))
        .first();

      if (existing && existing._id !== driverId) {
        throw new Error(`Driver with number ${updates.driverNumber} already exists`);
      }
    }

    // Remove undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(driverId, cleanUpdates);
    return driverId;
  },
});

export const getDriverStats = query({
  args: { driverId: v.id("drivers") },
  handler: async (ctx, args) => {
    const reportsFiledAgainst = await ctx.db
      .query("reports")
      .withIndex("by_reported_driver", (q) => q.eq("reportedDriverId", args.driverId))
      .collect();

    const reportsFiled = await ctx.db
      .query("reports")
      .withIndex("by_reporting_driver", (q) => q.eq("reportingDriverId", args.driverId))
      .collect();

    return {
      reportsFiledCount: reportsFiled.length,
      reportsAgainstCount: reportsFiledAgainst.length,
      pendingReports: reportsFiledAgainst.filter((r) => r.status === "pending").length,
      finalizedReports: reportsFiledAgainst.filter((r) => r.status === "finalized").length,
    };
  },
});

export const importOrUpdateDriver = mutation({
  args: {
    championshipId: v.id("series"),
    driverNumber: v.number(),
    driverName: v.string(),
    username: v.optional(v.string()),
    driverClass: v.string(),
    steamId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("drivers")
      .withIndex("by_number", (q) => q.eq("driverNumber", args.driverNumber))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        driverName: args.driverName,
        username: args.username,
        driverClass: args.driverClass,
        steamId: args.steamId,
        championshipId: args.championshipId,
      });
      return { action: 'updated', driverId: existing._id };
    } else {
      const driverId = await ctx.db.insert("drivers", {
        driverNumber: args.driverNumber,
        driverName: args.driverName,
        username: args.username,
        driverClass: args.driverClass,
        steamId: args.steamId,
        championshipId: args.championshipId,
        createdAt: Date.now(),
      });
      return { action: 'created', driverId };
    }
  },
});
