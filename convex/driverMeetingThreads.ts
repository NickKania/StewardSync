import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./lib/auth";

const CREATE_THREAD_FN = "driverMeetingDiscord:createDriverMeetingThreadAction" as any;

export const createDriverMeetingThread = mutation({
  args: {
    driverId: v.id("drivers"),
    initialMessage: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // 1. Permission check - only head_steward and league_manager
    await requireRole(ctx, args.userId, ["head_steward", "league_manager"]);

    // 2. Fetch driver with linked user
    const driver = await ctx.db.get(args.driverId);
    if (!driver) {
      throw new Error("Driver not found");
    }

    // 3. Verify driver has linked user with Discord ID
    const linkedUser = driver.userId ? await ctx.db.get(driver.userId) : null;
    if (!linkedUser || !linkedUser.discordId) {
      throw new Error("Driver must have a linked Discord account");
    }

    // 4. Get creating user's Discord ID
    const creatingUser = await ctx.db.get(args.userId);
    if (!creatingUser?.discordId) {
      throw new Error("Your Discord account must be linked");
    }

    // 5. Get series info for thread name (if available)
    const series = driver.championshipId ? await ctx.db.get(driver.championshipId) : null;
    const seriesName = series?.name ?? "Unknown Series";

    // 6. Create Discord thread via scheduler
    await ctx.scheduler.runAfter(0, CREATE_THREAD_FN, {
      driverLabel: driver.officialName || driver.driverName || `#${driver.driverNumber}`,
      driverNumber: driver.driverNumber,
      seriesName,
      driverDiscordId: linkedUser.discordId,
      creatorDiscordId: creatingUser.discordId,
      creatorName: creatingUser.officialName || creatingUser.name || "Staff",
      initialMessage: args.initialMessage,
    });

    return {
      success: true,
    };
  },
});
