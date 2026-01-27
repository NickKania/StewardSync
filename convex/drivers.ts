import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { UserFacingError } from "./lib/errors";

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

export const getByIdWithUser = query({
  args: { driverId: v.id("drivers") },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.driverId);
    if (!driver) return null;

    let linkedUser = null;
    if (driver.userId) {
      const user = await ctx.db.get(driver.userId);
      if (user) {
        linkedUser = {
          _id: user._id,
          name: user.name,
          officialName: user.officialName,
        };
      }
    }

    return {
      ...driver,
      linkedUser,
      displayName: linkedUser?.officialName ?? driver.driverName,
    };
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

export const getByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("drivers")
      .withIndex("by_username", (q) => q.eq("username", args.username))
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
      throw new UserFacingError(`Driver with number ${args.driverNumber} already exists`);
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

export const getDriverClassesBySeries = query({
  args: { seriesId: v.id("series") },
  handler: async (ctx, args) => {
    const drivers = await ctx.db
      .query("drivers")
      .withIndex("by_championship", (q) => q.eq("championshipId", args.seriesId))
      .collect();
    
    const driverClasses = [...new Set(drivers.map((d) => d.driverClass))];
    
    return driverClasses.sort();
  },
});

export const getDriverStats = query({
  args: { driverId: v.id("drivers") },
  handler: async (ctx, args) => {
    const reportsFiledAgainst = await ctx.db
      .query("reports")
      .withIndex("by_reported_driver", (q) => q.eq("reportedDriverId", args.driverId))
      .collect();

    // Get the user linked to this driver
    const driver = await ctx.db.get(args.driverId);
    let reportsFiled = [];
    if (driver?.userId) {
      reportsFiled = await ctx.db
        .query("reports")
        .withIndex("by_reporting_user", (q) => q.eq("reportingUserId", driver.userId))
        .collect();
    }

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

// Debug queries
export const getUserDriverLinks = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    console.log(`[DEBUG] Getting driver links for user: ${args.userId}`);
    const drivers = await ctx.db
      .query("drivers")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .collect();

    console.log(`[DEBUG] Found ${drivers.length} drivers linked to user:`, drivers);

    return drivers.map((driver) => ({
      driverId: driver._id,
      driverNumber: driver.driverNumber,
      driverName: driver.driverName,
      driverClass: driver.driverClass,
      username: driver.username,
      externalId: driver.externalId,
      steamId: driver.steamId,
      championshipId: driver.championshipId,
      userId: driver.userId,
    }));
  },
});
