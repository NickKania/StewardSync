"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { getEnvOrThrow, withDiscordClient } from "./discord";
import {
  syncDriverNicknames,
  type DriverNicknameTargets,
  type NicknameSyncResult,
} from "./lib/discordNicknames";

interface GuildResolutionClient {
  guilds: { fetch(guildId: string): Promise<unknown> };
  channels: { fetch(channelId: string): Promise<unknown> };
}

/** Use DISCORD_GUILD_ID when set, otherwise the race review channel's server. */
export async function resolveNicknameGuild(
  client: GuildResolutionClient,
  guildId: string | undefined,
  raceReviewChannelId: () => string,
): Promise<Parameters<typeof syncDriverNicknames>[0]> {
  if (guildId) {
    return (await client.guilds.fetch(guildId)) as Parameters<typeof syncDriverNicknames>[0];
  }
  const channel = await client.channels.fetch(raceReviewChannelId());
  if (!channel || typeof channel !== "object" || !("guild" in channel) || !channel.guild) {
    throw new Error("Discord race review channel must belong to a server");
  }
  return channel.guild as Parameters<typeof syncDriverNicknames>[0];
}

export const syncForSeries = internalAction({
  args: {
    championshipId: v.id("series"),
    changedByUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args): Promise<NicknameSyncResult> => {
    const targets: DriverNicknameTargets = await ctx.runQuery(
      internal.driverNicknames.getForSeries, { championshipId: args.championshipId },
    );
    if (targets.targets.length === 0) {
      return { updated: 0, unchanged: 0, skipped: targets.skipped, failed: 0, errors: [] };
    }

    try {
      const result = await withDiscordClient(async (client) => {
        const guild = await resolveNicknameGuild(
          client,
          process.env["DISCORD_GUILD_ID"],
          () => getEnvOrThrow("DISCORD_RACE_REVIEW_CHANNEL_ID"),
        );
        return syncDriverNicknames(guild, targets);
      });
      if (result.failed > 0) console.error("Discord nickname sync failures:", result.errors);
      if (result.changes.length > 0) {
        // Renames already happened on Discord; an audit-write failure must
        // not misreport the sync itself, so log it and keep the counts.
        try {
          await ctx.runMutation(internal.driverNicknames.recordNicknameChanges, {
            ...(args.changedByUserId ? { changedByUserId: args.changedByUserId } : {}),
            changes: result.changes.map((change) => ({
              userId: change.userId as Id<"users">,
              ...(change.fromNickname !== null ? { fromNickname: change.fromNickname } : {}),
              toNickname: change.toNickname,
            })),
          });
        } catch (auditError) {
          console.error("Failed to audit Discord nickname changes:", auditError);
        }
      }
      const { changes: _changes, ...summary } = result;
      return summary;
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
