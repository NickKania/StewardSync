import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { UserFacingError } from "./lib/errors";
import { formatDriverName, getDriverDisplayName } from "./lib/formatting";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("drivers").collect();
  },
});

export const getById = query({
  args: { driverId: v.id("drivers") },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.driverId);
    if (!driver) return null;

    // Check if driver is linked to a user
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
      displayName: getDriverDisplayName(driver, linkedUser ? { officialName: linkedUser.officialName } : undefined),
    };
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
      displayName: getDriverDisplayName(driver, linkedUser ? { officialName: linkedUser.officialName } : undefined),
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
    const drivers = await ctx.db
      .query("drivers")
      .withIndex("by_championship", (q) => q.eq("championshipId", args.championshipId))
      .collect();

    // Enrich with display names and driver class data
    const enrichedDrivers = await Promise.all(
      drivers.map(async (driver) => {
        let userOfficialName: string | undefined;
        if (driver.userId) {
          const user = await ctx.db.get(driver.userId);
          if (user) {
            userOfficialName = user.officialName;
          }
        }
        
        // Get driver class information
        let driverClassData = null;
        if (driver.driverClassId) {
          driverClassData = await ctx.db.get(driver.driverClassId);
        }
        
        return {
          ...driver,
          displayName: getDriverDisplayName(driver, userOfficialName ? { officialName: userOfficialName } : undefined),
          driverClass: driverClassData ? {
            _id: driverClassData._id,
            className: driverClassData.className,
            displayName: driverClassData.displayName,
          } : null,
        };
      })
    );

    return enrichedDrivers;
  },
});

export const create = mutation({
  args: {
    driverNumber: v.number(),
    driverName: v.string(),
    username: v.optional(v.string()),
    externalId: v.optional(v.string()),
    driverClassId: v.id("driverClasses"),
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

    // Auto-generate officialName using "F. Name" format
    const officialName = formatDriverName(args.driverName);

    const driverId = await ctx.db.insert("drivers", {
      ...args,
      officialName,
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
    officialName: v.optional(v.string()),
    username: v.optional(v.string()),
    externalId: v.optional(v.string()),
    driverClassId: v.optional(v.id("driverClasses")),
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

    // If updating driverName, also regenerate officialName
    if (updates.driverName !== undefined) {
      updates.officialName = formatDriverName(updates.driverName);
    }

    // Remove undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(driverId, cleanUpdates);
    return driverId;
  },
});

export const updateOfficialName = mutation({
  args: {
    driverId: v.id("drivers"),
    officialName: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get the current user to check their role
    const currentUser = await ctx.db.get(args.userId);

    if (!currentUser) {
      throw new UserFacingError("User not found");
    }

    // Get the user's role
    const userRole = await ctx.db.get(currentUser.roleId);
    if (!userRole) {
      throw new UserFacingError("User role not found");
    }

    // Only event_manager and league_manager can update official names
    if (userRole.name !== "event_manager" && userRole.name !== "league_manager") {
      throw new UserFacingError("Only event managers can update official names");
    }

    // Check if driver exists
    const driver = await ctx.db.get(args.driverId);
    if (!driver) {
      throw new UserFacingError("Driver not found");
    }

    // Update the official name
    await ctx.db.patch(args.driverId, {
      officialName: args.officialName,
    });

    return args.driverId;
  },
});

export const getDriverClassesBySeries = query({
  args: { seriesId: v.id("series") },
  handler: async (ctx, args) => {
    const driverClasses = await ctx.db
      .query("driverClasses")
      .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId))
      .collect();
    
    return driverClasses.sort((a, b) => a.className.localeCompare(b.className));
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
    driverClassId: v.id("driverClasses"),
    steamId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // First, try to find driver by driverNumber AND championshipId
    // This ensures we only update drivers that are already in this specific series
    const existing = await ctx.db
      .query("drivers")
      .withIndex("by_number", (q) => q.eq("driverNumber", args.driverNumber))
      .collect();

    // Find the driver that belongs to this specific championship
    const driverInThisChampionship = existing.find(
      (driver) => driver.championshipId === args.championshipId
    );

    // Auto-generate officialName for this driver name
    const officialName = formatDriverName(args.driverName);

    if (driverInThisChampionship) {
      // Driver exists in this series - update their data but NOT championshipId
      await ctx.db.patch(driverInThisChampionship._id, {
        driverName: args.driverName,
        officialName,
        username: args.username,
        driverClassId: args.driverClassId,
        steamId: args.steamId,
      });
      return { action: 'updated', driverId: driverInThisChampionship._id };
    }

    // Check if there's an unassigned driver with this number
    const unassignedDriver = existing.find(
      (driver) => driver.championshipId === undefined
    );

    if (unassignedDriver) {
      // Unassigned driver found - assign to this series and update data
      await ctx.db.patch(unassignedDriver._id, {
        driverName: args.driverName,
        officialName,
        username: args.username,
        driverClassId: args.driverClassId,
        steamId: args.steamId,
        championshipId: args.championshipId,
      });
      return { action: 'updated', driverId: unassignedDriver._id };
    }

    // No existing driver found - create new driver for this series
    const driverId = await ctx.db.insert("drivers", {
      driverNumber: args.driverNumber,
      driverName: args.driverName,
      officialName,
      username: args.username,
      driverClassId: args.driverClassId,
      steamId: args.steamId,
      championshipId: args.championshipId,
      createdAt: Date.now(),
    });
    return { action: 'created', driverId };
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
      driverClassId: driver.driverClassId,
      username: driver.username,
      externalId: driver.externalId,
      steamId: driver.steamId,
      championshipId: driver.championshipId,
      userId: driver.userId,
    }));
  },
});
