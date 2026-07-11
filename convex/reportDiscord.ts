"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import {
  allMessagesLackVisibleContent,
  discordMessageUrl,
  extractDiscordMentionIds,
  filterDriverMessagesForWindow,
  formatDiscordMentions,
  getOldestMessageInPage,
  shouldStopDiscordPagination,
} from "./lib/discordSelfReport";
import { withDiscordClient } from "./discord";

const GET_SELF_REPORT_CONTEXT = "reportDiscordContext:getSelfReportContext" as any;
const MAX_DRIVER_MESSAGES = 500;
const DISCORD_PAGE_LIMIT = 100;
/** Cap REST pages so busy channels cannot spin until Convex action timeout. */
const MAX_PAGES = 30;
/** Soft wall-clock budget for the Discord walk (ms). */
const MAX_FETCH_DURATION_MS = 25_000;
const MENTION_FETCH_CONCURRENCY = 5;

type SelfReportContext = {
  windowStart: number;
  windowEnd: number;
  channelId: string | null;
  atFaultDriverId: string | null;
  driverDiscordId: string | null;
  driverLabel: string | null;
};

type SelfReportReason =
  | "missing_channel"
  | "missing_driver_discord"
  | "discord_access_error"
  | "no_at_fault_driver";

type SelfReportMessage = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  content: string;
  timestamp: number;
  jumpUrl: string;
  attachmentUrls: string[];
};

const emptyResult = (
  context: SelfReportContext,
  reason: SelfReportReason,
) => ({
  ok: false,
  reason,
  channelId: context.channelId ?? undefined,
  driverDiscordId: context.driverDiscordId ?? undefined,
  driverLabel: context.driverLabel ?? undefined,
  windowStart: context.windowStart,
  windowEnd: context.windowEnd,
  messages: [] as SelfReportMessage[],
  hasMore: false,
  contentAccessWarning: false,
});

const fetchGuildForChannel = async (
  client: any,
  channel: any,
) => {
  const guildId = channel.guildId ?? channel.guild?.id ?? null;
  if (!guildId) {
    return null;
  }

  const guild =
    channel.guild ??
    (await client.guilds.fetch(guildId).catch((error: unknown) => {
      console.error("Failed to fetch Discord self reporting guild", {
        guildId,
        error,
      });
      return null;
    }));

  return guild;
};

const fetchGuildMember = async (guild: any, discordId: string) => {
  if (!guild?.members?.fetch) {
    return null;
  }

  return await guild.members.fetch(discordId).catch((error: unknown) => {
    console.error("Failed to fetch Discord self reporting guild member", {
      guildId: guild.id,
      discordId,
      error,
    });
    return null;
  });
};

const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> => {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex++;
        results[index] = await mapper(items[index]);
      }
    },
  );

  await Promise.all(workers);
  return results;
};

export const getSelfReportMessages = action({
  args: {
    currentUserId: v.id("users"),
    reportId: v.id("reports"),
    atFaultDriverId: v.optional(v.id("drivers")),
  },
  handler: async (ctx, args) => {
    const context = (await ctx.runQuery(
      GET_SELF_REPORT_CONTEXT,
      args,
    )) as SelfReportContext;

    if (!context.channelId) {
      return emptyResult(context, "missing_channel");
    }

    if (!context.atFaultDriverId) {
      return emptyResult(context, "no_at_fault_driver");
    }

    if (!context.driverDiscordId) {
      return emptyResult(context, "missing_driver_discord");
    }

    try {
      return await withDiscordClient(async (client) => {
        const channel = await client.channels
          .fetch(context.channelId!)
          .catch((error) => {
            console.error("Failed to fetch Discord self reporting channel", {
              channelId: context.channelId,
              error,
            });
            return null;
          });

        if (
          !channel ||
          !("messages" in channel) ||
          typeof (channel as any).messages?.fetch !== "function"
        ) {
          return emptyResult(context, "discord_access_error");
        }

        const guild = await fetchGuildForChannel(client, channel);
        const driverGuildMember = await fetchGuildMember(
          guild,
          context.driverDiscordId!,
        );
        const driverServerName =
          typeof driverGuildMember?.displayName === "string" &&
          driverGuildMember.displayName.trim() !== ""
            ? driverGuildMember.displayName
            : null;
        const driverServerAvatarUrl =
          typeof driverGuildMember?.displayAvatarURL === "function"
            ? driverGuildMember.displayAvatarURL()
            : null;

        const collected: SelfReportMessage[] = [];
        let before: string | undefined;
        let hasMore = false;
        let pagesFetched = 0;
        const startedAt = Date.now();
        const displayNamesByDiscordId = new Map<string, string | null>();
        displayNamesByDiscordId.set(context.driverDiscordId!, driverServerName);

        while (collected.length < MAX_DRIVER_MESSAGES) {
          if (pagesFetched >= MAX_PAGES) {
            hasMore = true;
            break;
          }
          if (Date.now() - startedAt >= MAX_FETCH_DURATION_MS) {
            hasMore = true;
            break;
          }

          const batch = await (channel as any).messages.fetch({
            limit: DISCORD_PAGE_LIMIT,
            before,
          });
          pagesFetched += 1;

          const messages = Array.from(batch.values()) as any[];
          if (messages.length === 0) {
            break;
          }

          const mentionIds = new Set<string>();
          for (const message of messages) {
            for (const mentionId of extractDiscordMentionIds(
              message.content ?? "",
            )) {
              if (!displayNamesByDiscordId.has(mentionId)) {
                mentionIds.add(mentionId);
              }
            }
          }

          const unresolvedMentionIds = [...mentionIds];
          await mapWithConcurrency(
            unresolvedMentionIds,
            MENTION_FETCH_CONCURRENCY,
            async (mentionId) => {
              const member = await fetchGuildMember(guild, mentionId);
              const displayName =
                typeof member?.displayName === "string" &&
                member.displayName.trim() !== ""
                  ? member.displayName
                  : null;
              displayNamesByDiscordId.set(mentionId, displayName);
            },
          );

          const mentionDisplayNames = Object.fromEntries(
            displayNamesByDiscordId,
          );

          const mappedMessages = messages.map((message) => {
            const attachmentUrls = Array.from(
              message.attachments?.values?.() ?? [],
            ).map((attachment: any) => attachment.url);

            return {
              id: message.id,
              authorId: message.author.id,
              authorName:
                (message.author.id === context.driverDiscordId
                  ? driverServerName
                  : null) ||
                message.member?.displayName ||
                message.author.globalName ||
                message.author.username,
              authorAvatarUrl:
                (message.author.id === context.driverDiscordId
                  ? driverServerAvatarUrl
                  : null) ?? message.author.displayAvatarURL?.(),
              content: formatDiscordMentions(
                message.content ?? "",
                mentionDisplayNames,
              ),
              timestamp: message.createdTimestamp,
              jumpUrl: discordMessageUrl(
                message.guildId ?? (channel as any).guildId,
                message.channelId ?? context.channelId!,
                message.id,
              ),
              attachmentUrls,
            };
          });

          const driverMessages = filterDriverMessagesForWindow(
            mappedMessages,
            context.driverDiscordId!,
            context.windowStart,
            context.windowEnd,
          );

          for (const message of driverMessages) {
            collected.push(message);
            if (collected.length >= MAX_DRIVER_MESSAGES) {
              hasMore = true;
              break;
            }
          }

          const oldestMessage = getOldestMessageInPage(
            mappedMessages.map((message) => ({
              id: message.id,
              timestamp: message.timestamp,
            })),
          );
          if (!oldestMessage) {
            break;
          }

          before = oldestMessage.id;

          if (
            shouldStopDiscordPagination(
              oldestMessage.timestamp,
              context.windowStart,
            )
          ) {
            break;
          }

          if (messages.length < DISCORD_PAGE_LIMIT) {
            break;
          }
        }

        // Stickers/embeds/polls can look empty without Message Content intent
        // issues. Surface a warning instead of a hard access error.
        const contentAccessWarning = allMessagesLackVisibleContent(collected);

        collected.sort((a, b) => a.timestamp - b.timestamp);

        return {
          ok: true,
          channelId: context.channelId,
          channelName: (channel as any).name,
          driverDiscordId: context.driverDiscordId,
          driverLabel: context.driverLabel ?? undefined,
          windowStart: context.windowStart,
          windowEnd: context.windowEnd,
          messages: collected,
          hasMore,
          contentAccessWarning,
        };
      });
    } catch (error) {
      console.error("Failed to load Discord self-report evidence", {
        channelId: context.channelId,
        driverDiscordId: context.driverDiscordId,
        error,
      });
      return emptyResult(context, "discord_access_error");
    }
  },
});
