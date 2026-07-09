import { UserFacingError } from "./errors";

export const DISCORD_CHANNEL_ID_PATTERN = /^\d{17,20}$/;

export interface DiscordEvidenceMessageLike {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  content: string;
  timestamp: number;
  jumpUrl: string;
  attachmentUrls: string[];
}

export const normalizeDiscordChannelId = (
  value?: string | null,
): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const rawMatch = trimmed.match(/^\d{17,20}$/);
  if (rawMatch) {
    return rawMatch[0];
  }

  const urlMatch = trimmed.match(
    /discord(?:app)?\.com\/channels\/(?:@me|\d{17,20})\/(\d{17,20})(?:\/\d{17,20})?/i,
  );
  if (urlMatch) {
    return urlMatch[1];
  }

  throw new UserFacingError(
    "Discord incident channel must be a channel ID or Discord channel link",
  );
};

export const discordMessageUrl = (
  guildId: string | null | undefined,
  channelId: string,
  messageId: string,
) => `https://discord.com/channels/${guildId ?? "@me"}/${channelId}/${messageId}`;

export const extractDiscordMentionIds = (content: string): string[] => {
  const ids = new Set<string>();

  for (const match of content.matchAll(/<@!?(\d{17,20})>/g)) {
    ids.add(match[1]);
  }

  return [...ids];
};

export const formatDiscordMentions = (
  content: string,
  displayNamesByDiscordId: Record<string, string | null | undefined>,
) =>
  content.replace(/<@!?(\d{17,20})>/g, (mention, discordId: string) => {
    const displayName = displayNamesByDiscordId[discordId]?.trim();
    return displayName ? `@${displayName}` : mention;
  });

export const filterDriverMessagesForWindow = <
  T extends DiscordEvidenceMessageLike,
>(
  messages: T[],
  driverDiscordId: string,
  windowStart: number,
  windowEnd: number,
) =>
  messages.filter(
    (message) =>
      message.authorId === driverDiscordId &&
      message.timestamp >= windowStart &&
      message.timestamp <= windowEnd,
  );

export const shouldStopDiscordPagination = (
  oldestMessageTimestamp: number | null,
  windowStart: number,
) => oldestMessageTimestamp !== null && oldestMessageTimestamp < windowStart;

/**
 * Returns the oldest message in a page by timestamp (snowflake-stable when equal).
 * Discord.js collection order is usually newest-first, but we do not rely on it.
 */
export const getOldestMessageInPage = <
  T extends { id: string; timestamp: number },
>(
  messages: T[],
): T | null => {
  if (messages.length === 0) {
    return null;
  }

  let oldest = messages[0];
  for (let i = 1; i < messages.length; i++) {
    const message = messages[i];
    if (
      message.timestamp < oldest.timestamp ||
      (message.timestamp === oldest.timestamp && message.id < oldest.id)
    ) {
      oldest = message;
    }
  }
  return oldest;
};

/** Whether every message lacks usable text and attachments (intent/empty heuristic). */
export const allMessagesLackVisibleContent = <
  T extends { content: string; attachmentUrls: string[] },
>(
  messages: T[],
) =>
  messages.length > 0 &&
  messages.every(
    (message) =>
      message.content.trim() === "" && message.attachmentUrls.length === 0,
  );
