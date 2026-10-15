import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalQuery } from "./_generated/server";
import type { DriverNicknameTargets } from "./lib/discordNicknames";

export const getForSeries = internalQuery({
  args: { championshipId: v.id("series") },
  handler: async (ctx, args): Promise<DriverNicknameTargets> => {
    // Include withdrawn drivers so remaining active-series numbers are checked.
    const importedSeriesDrivers = await ctx.db
      .query("drivers")
      .withIndex("by_championship", (q) => q.eq("championshipId", args.championshipId))
      .collect();
    const userIds = new Set<Id<"users">>();
    const result: DriverNicknameTargets = { targets: [], skipped: 0 };
    for (const driver of importedSeriesDrivers) {
      if (driver.userId) userIds.add(driver.userId);
      else result.skipped++;
    }

    const allSeries = await ctx.db.query("series").collect();
    const activeSeriesIds = new Set(
      allSeries.filter((series) => series.isActive !== false).map((series) => series._id),
    );

    for (const userId of userIds) {
      const user = await ctx.db.get(userId);
      if (!user?.discordId) {
        result.skipped++;
        continue;
      }

      const userDrivers = await ctx.db
        .query("drivers")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect();
      const activeDrivers = userDrivers.filter(
        (driver) => driver.isActive !== false &&
          driver.championshipId && activeSeriesIds.has(driver.championshipId),
      );
      if (activeDrivers.length === 0) {
        result.skipped++;
        continue;
      }

      // Prefer the driver's row from the series just imported for a stable
      // name source. Fall back to the full driverName, not the abbreviated
      // "F. Lastname" officialName, so nicknames keep the driver's full name.
      const nameDriver =
        activeDrivers.find((driver) => driver.championshipId === args.championshipId) ??
        activeDrivers[0];
      const officialName = (user.officialName?.trim() || nameDriver.driverName).trim();
      if (!officialName) {
        result.skipped++;
        continue;
      }

      result.targets.push({
        discordId: user.discordId,
        officialName,
        driverNumbers: [...new Set(activeDrivers.flatMap(
          (driver) => driver.driverNumber === undefined ? [] : [driver.driverNumber],
        ))].sort((a, b) => a - b),
      });
    }

    return result;
  },
});
