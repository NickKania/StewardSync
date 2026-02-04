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
        let linkedUser:
          | {
              _id: typeof driver.userId;
              name: string;
              officialName?: string;
            }
          | null = null;

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

        let driverClassData = null;
        if (driver.driverClassId) {
          driverClassData = await ctx.db.get(driver.driverClassId);
        }

        return {
          ...driver,
          linkedUser,
          displayName: getDriverDisplayName(
            driver,
            linkedUser?.officialName
              ? { officialName: linkedUser.officialName }
              : undefined,
          ),
          driverClass: driverClassData
            ? {
                _id: driverClassData._id,
                className: driverClassData.className,
                displayName: driverClassData.displayName,
              }
            : null,
        };
      }),
    );

    return enrichedDrivers;
  },
});

export const getPenaltyHistory = query({
  args: {
    driverId: v.id("drivers"),
    championshipId: v.optional(v.id("series")),
  },
  handler: async (ctx, args) => {
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_reported_driver", (q) => q.eq("reportedDriverId", args.driverId))
      .collect();

    const finalizedReports = reports.filter((report) => {
      if (report.status !== "finalized") return false;
      if (report.atFaultDriverId) return report.atFaultDriverId === args.driverId;
      return report.reportedDriverId === args.driverId;
    });

    const rows = await Promise.all(
      finalizedReports.map(async (report) => {
        const [event, race, appliedPenalty] = await Promise.all([
          ctx.db.get(report.eventId),
          ctx.db.get(report.raceId),
          report.appliedPenalty ? ctx.db.get(report.appliedPenalty as any) : null,
        ]);

        if (!event) return null;
        if (args.championshipId && event.seriesId !== args.championshipId) return null;

        return {
          reportId: report._id,
          reportNumber: report.reportId ?? null,
          eventId: event._id,
          eventName: event.trackName,
          eventNumber: event.eventNumber,
          raceNumber: race?.raceNumber ?? null,
          seriesId: event.seriesId,
          penaltyId: report.appliedPenalty ?? null,
          penaltyName: (appliedPenalty as any)?.name ?? null,
          licensePoints: (appliedPenalty as any)?.licensePoints ?? 0,
          finalizedAt: report.finalizedAt ?? report.updatedAt ?? report.createdAt,
        };
      }),
    );

    return rows
      .filter((row) => row !== null)
      .sort((a, b) => b!.finalizedAt - a!.finalizedAt);
  },
});

export const getUserProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const seriesRecency = new Map<string, number>();
    const profiles = await Promise.all(
      (
        await ctx.db
          .query("drivers")
          .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
          .collect()
      ).map(async (driver) => {
        const [series, driverClass, reportsAgainst] = await Promise.all([
          driver.championshipId ? ctx.db.get(driver.championshipId) : Promise.resolve(null),
          driver.driverClassId ? ctx.db.get(driver.driverClassId) : Promise.resolve(null),
          ctx.db
            .query("reports")
            .withIndex("by_reported_driver", (q) => q.eq("reportedDriverId", driver._id))
            .collect(),
        ]);

        const seriesId = driver.championshipId;
        if (seriesId) {
          const events = await ctx.db
            .query("events")
            .withIndex("by_series", (q) => q.eq("seriesId", seriesId))
            .collect();
          const lastEventDate =
            events.reduce((latest, evt) => Math.max(latest, evt.eventDate), 0) || 0;
          seriesRecency.set(seriesId.toString(), lastEventDate);
        }

        const penaltyHistoryRows = await Promise.all(
          reportsAgainst
            .filter((report) => {
              if (report.status !== "finalized") return false;
              if (report.atFaultDriverId) return report.atFaultDriverId === driver._id;
              return report.reportedDriverId === driver._id;
            })
            .map(async (report) => {
              const [event, race, penalty] = await Promise.all([
                ctx.db.get(report.eventId),
                ctx.db.get(report.raceId),
                report.appliedPenalty ? ctx.db.get(report.appliedPenalty as any) : null,
              ]);

              if (!event) return null;
              if (seriesId && event.seriesId !== seriesId) return null;

              return {
                reportId: report._id,
                reportNumber: report.reportId ?? null,
                eventName: event.trackName,
                eventNumber: event.eventNumber,
                raceNumber: race?.raceNumber ?? null,
                penaltyName: (penalty as any)?.name ?? null,
                licensePoints: (penalty as any)?.licensePoints ?? 0,
                finalizedAt: report.finalizedAt ?? report.updatedAt ?? report.createdAt,
              };
            }),
        );

        const penaltyHistory = penaltyHistoryRows
          .filter((row) => row !== null)
          .sort((a, b) => b!.finalizedAt - a!.finalizedAt);

        return {
          driverId: driver._id,
          seriesId: series?._id ?? null,
          seriesName: series?.name ?? "No Series",
          seriesLastEventDate: series ? seriesRecency.get(series._id.toString()) ?? 0 : 0,
          driverNumber: driver.driverNumber,
          driverName: driver.driverName,
          displayName: getDriverDisplayName(
            driver,
            user.officialName ? { officialName: user.officialName } : undefined,
          ),
          isActive: driver.isActive ?? true,
          steamId: driver.steamId,
          driverClassId: driver.driverClassId ?? null,
          driverClassName: driverClass?.displayName ?? null,
          accumulatedLicensePoints: driver.accumulatedLicensePoints ?? 0,
          penalties: penaltyHistory,
        };
      }),
    );

    return {
      user: {
        _id: user._id,
        name: user.name,
        officialName: user.officialName,
        discordUsername: user.discordUsername,
      },
      profiles: profiles.sort((a, b) => {
        if (a.seriesLastEventDate !== b.seriesLastEventDate) {
          return b.seriesLastEventDate - a.seriesLastEventDate;
        }
        return a.seriesName.localeCompare(b.seriesName);
      }),
    };
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
      accumulatedLicensePoints: 0,
      isActive: true,
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
    const driver = await ctx.db.get(args.driverId);
    if (!driver) return null;

    const reportsFiledAgainst = await ctx.db
      .query("reports")
      .withIndex("by_reported_driver", (q) => q.eq("reportedDriverId", args.driverId))
      .collect();

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
      accumulatedLicensePoints: driver.accumulatedLicensePoints || 0,
      isActive: driver.isActive ?? true,
    };
  },
});

export const importOrUpdateDriver = mutation({
  args: {
    championshipId: v.id("series"),
    driverNumber: v.number(),
    driverName: v.string(),
    username: v.optional(v.string()),
    steamId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("drivers")
      .withIndex("by_number", (q) => q.eq("driverNumber", args.driverNumber))
      .collect();

    const driverInThisChampionship = existing.find(
      (driver) => driver.championshipId === args.championshipId
    );

    const officialName = formatDriverName(args.driverName);

    if (driverInThisChampionship) {
      await ctx.db.patch(driverInThisChampionship._id, {
        driverName: args.driverName,
        officialName,
        username: args.username,
        steamId: args.steamId,
        isActive: true,
      });
      return { action: 'updated', driverId: driverInThisChampionship._id };
    }

    const unassignedDriver = existing.find(
      (driver) => driver.championshipId === undefined
    );

    if (unassignedDriver) {
      await ctx.db.patch(unassignedDriver._id, {
        driverName: args.driverName,
        officialName,
        username: args.username,
        steamId: args.steamId,
        championshipId: args.championshipId,
        isActive: true,
      });
      return { action: 'updated', driverId: unassignedDriver._id };
    }

    const driverId = await ctx.db.insert("drivers", {
      driverNumber: args.driverNumber,
      driverName: args.driverName,
      officialName,
      username: args.username,
      steamId: args.steamId,
      championshipId: args.championshipId,
      accumulatedLicensePoints: 0,
      isActive: true,
      createdAt: Date.now(),
    });
    return { action: 'created', driverId };
  },
});

export const markInactiveDrivers = mutation({
  args: {
    championshipId: v.id("series"),
    activeDriverNumbers: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    const allDrivers = await ctx.db
      .query("drivers")
      .withIndex("by_championship", (q) => q.eq("championshipId", args.championshipId))
      .collect();

    let markedInactive = 0;

    for (const driver of allDrivers) {
      if (!args.activeDriverNumbers.includes(driver.driverNumber) && driver.isActive !== false) {
        await ctx.db.patch(driver._id, { isActive: false });
        markedInactive++;
      }
    }

    return { markedInactive };
  },
});

export const updateDriverLicensePoints = mutation({
  args: {
    driverId: v.id("drivers"),
    newPoints: v.number(),
    userId: v.id("users"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.driverId);
    if (!driver) throw new UserFacingError("Driver not found");

    const user = await ctx.db.get(args.userId);
    if (!user) throw new UserFacingError("User not found");

    const role = await ctx.db.get(user.roleId);
    if (!role) throw new UserFacingError("User role not found");

    if (!["event_manager", "league_manager"].includes(role.name)) {
      throw new UserFacingError("Unauthorized to update license points");
    }

    await ctx.db.patch(args.driverId, {
      accumulatedLicensePoints: args.newPoints,
    });

    await ctx.db.insert("changeHistory", {
      tableName: "drivers",
      documentId: args.driverId.toString(),
      fieldName: "accumulatedLicensePoints",
      fromValue: driver.accumulatedLicensePoints?.toString(),
      toValue: args.newPoints.toString(),
      changedByUserId: args.userId,
      source: "manual",
      changedAt: Date.now(),
    });

    return args.driverId;
  },
});

export const updateDriverClass = mutation({
  args: {
    driverId: v.id("drivers"),
    newDriverClassId: v.id("driverClasses"),
    userId: v.id("users"),
    adjustLicensePoints: v.optional(v.boolean()),
    newLicensePoints: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.driverId);
    if (!driver) throw new UserFacingError("Driver not found");

    const user = await ctx.db.get(args.userId);
    if (!user) throw new UserFacingError("User not found");

    const role = await ctx.db.get(user.roleId);
    if (!role) throw new UserFacingError("User role not found");

    if (!["event_manager", "league_manager"].includes(role.name)) {
      throw new UserFacingError("Unauthorized to update driver class");
    }

    const updates: any = {
      driverClassId: args.newDriverClassId,
    };

    if (args.adjustLicensePoints) {
      updates.accumulatedLicensePoints = args.newLicensePoints ?? 0;
    }

    await ctx.db.patch(args.driverId, updates);

    await ctx.db.insert("changeHistory", {
      tableName: "drivers",
      documentId: args.driverId.toString(),
      fieldName: "driverClassId",
      fromValue: driver.driverClassId?.toString(),
      toValue: args.newDriverClassId.toString(),
      changedByUserId: args.userId,
      source: "manual",
      changedAt: Date.now(),
    });

    if (args.adjustLicensePoints && args.newLicensePoints !== undefined) {
      await ctx.db.insert("changeHistory", {
        tableName: "drivers",
        documentId: args.driverId.toString(),
        fieldName: "accumulatedLicensePoints",
        fromValue: driver.accumulatedLicensePoints?.toString(),
        toValue: args.newLicensePoints.toString(),
        changedByUserId: args.userId,
        source: "manual",
        changedAt: Date.now(),
      });
    }

    return args.driverId;
  },
});

export const updateUserAssociation = mutation({
  args: {
    driverId: v.id("drivers"),
    newUserId: v.id("users"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.driverId);
    if (!driver) throw new UserFacingError("Driver not found");

    const user = await ctx.db.get(args.userId);
    if (!user) throw new UserFacingError("User not found");

    const role = await ctx.db.get(user.roleId);
    if (!role) throw new UserFacingError("User role not found");

    if (!["event_manager", "league_manager"].includes(role.name)) {
      throw new UserFacingError("Unauthorized to update user association");
    }

    if (driver.steamId && driver.userId) {
      const oldMapping = await ctx.db
        .query("steamUserMappings")
        .withIndex("by_steam_id", (q) => q.eq("steamId", driver.steamId!))
        .first();

      if (oldMapping) {
        await ctx.db.delete(oldMapping._id);
      }
    }

    if (driver.steamId) {
      await ctx.db.insert("steamUserMappings", {
        steamId: driver.steamId,
        userId: args.newUserId,
        isBanned: false,
        createdAt: Date.now(),
      });
    }

    await ctx.db.patch(args.driverId, {
      userId: args.newUserId,
    });

    return args.driverId;
  },
});

export const listAggregatedByUser = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();

    const result = await Promise.all(
      users.map(async (user) => {
        const drivers = await ctx.db
          .query("drivers")
          .withIndex("by_user_id", (q) => q.eq("userId", user._id))
          .collect();

        if (drivers.length === 0) return null;

        const driversWithDetails = await Promise.all(
          drivers.map(async (driver) => {
            const series = driver.championshipId ? await ctx.db.get(driver.championshipId) : null;
            const driverClass = driver.driverClassId ? await ctx.db.get(driver.driverClassId) : null;

            return {
              ...driver,
              seriesName: series?.name,
              seriesIsActive: series?.isActive ?? true,
              driverClassName: driverClass?.displayName,
            };
          })
        );

        const sortedDrivers = driversWithDetails.sort((a, b) => {
          const aActive = a.seriesIsActive === true;
          const bActive = b.seriesIsActive === true;
          if (aActive !== bActive) return (bActive ? 1 : 0) - (aActive ? 1 : 0);
          return (a.seriesName || "").localeCompare(b.seriesName || "");
        });

        return {
          userId: user._id,
          userName: user.name,
          discordUsername: user.discordUsername,
          officialName: user.officialName,
          drivers: sortedDrivers,
        };
      })
    );

    return result.filter(r => r !== null).sort((a, b) =>
      a!.userName.localeCompare(b!.userName)
    );
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
