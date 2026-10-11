"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { getEnvOrThrow, withDiscordClient } from "./discord";
import {
  syncDriverNicknames,
  type DriverNicknameTargets,
  type NicknameSyncResult,
} from "./lib/discordNicknames";

export const syncForSeries = internalAction({
  args: { championshipId: v.id("series") },
  handler: async (ctx, args): Promise<NicknameSyncResult> => {
    const targets: DriverNicknameTargets = await ctx.runQuery(
      internal.driverNicknames.getForSeries, args,
    );
    if (targets.targets.length === 0) {
      return { updated: 0, unchanged: 0, skipped: targets.skipped, failed: 0, errors: [] };
    }

    try {
      const result = await withDiscordClient(async (client) => {
        const guildId = process.env["DISCORD_GUILD_ID"];
        let guild;
        if (guildId) {
          guild = await client.guilds.fetch(guildId);
        } else {
          const channel = await client.channels.fetch(getEnvOrThrow("DISCORD_RACE_REVIEW_CHANNEL_ID"));
          if (!channel || !("guild" in channel)) {
            throw new Error("Discord race review channel must belong to a server");
          }
          guild = channel.guild;
        }
        return syncDriverNicknames(guild, targets);
      });
      if (result.failed > 0) console.error("Discord nickname sync failures:", result.errors);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Discord nickname sync failed:", message);
      return {
        updated: 0, unchanged: 0, skipped: targets.skipped,
        failed: targets.targets.length, errors: [message],
      };
    }
  },
});
