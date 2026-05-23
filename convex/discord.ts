"use node";

import {
  ChannelType,
  Client,
  GatewayIntentBits,
  ThreadAutoArchiveDuration,
  type ThreadChannel,
} from "discord.js";

export const getEnvOrThrow = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is not configured.`);
  }
  return value;
};

export const withDiscordClient = async <T>(
  callback: (client: Client) => Promise<T>,
) => {
  const token = getEnvOrThrow("DISCORD_BOT_TOKEN");
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });
  await client.login(token);
  try {
    return await callback(client);
  } finally {
    client.destroy();
  }
};

export const toMention = (discordId: string) => `<@${discordId}>`;

export const toDiscordTimestamp = (timestampMs: number, style: "F" | "t" | "R") =>
  `<t:${Math.floor(timestampMs / 1000)}:${style}>`;

export const fetchThreadIfAvailable = async (
  client: Client,
  threadId: string | null,
): Promise<ThreadChannel | null> => {
  if (!threadId) {
    return null;
  }
  const channel = await client.channels.fetch(threadId).catch(() => null);
  if (!channel || !channel.isThread()) {
    return null;
  }
  return channel;
};

interface CreateThreadParams {
  name: string;
  parentChannelId: string;
  participantDiscordIds: string[];
  invitable?: boolean;
  reason?: string;
}

export const createPrivateThread = async (
  client: Client,
  params: CreateThreadParams,
): Promise<ThreadChannel> => {
  const parentChannel = await client.channels.fetch(params.parentChannelId);

  if (!parentChannel || parentChannel.type !== ChannelType.GuildText) {
    throw new Error("Invalid Discord channel configuration");
  }

  const truncatedName = params.name.length > 100 ? params.name.slice(0, 100) : params.name;

  const thread = await parentChannel.threads.create({
    name: truncatedName,
    autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
    type: ChannelType.PrivateThread,
    invitable: params.invitable ?? false,
    reason: params.reason,
  });

  for (const discordId of params.participantDiscordIds) {
    await thread.members.add(discordId);
  }

  return thread;
};

export const closeThread = async (
  client: Client,
  threadId: string,
  reason: string = "Thread closed",
): Promise<{ closed: boolean; archived: boolean; locked: boolean }> => {
  const thread = await fetchThreadIfAvailable(client, threadId);
  if (!thread) {
    throw new Error("Thread not found");
  }

  if (!thread.archived) {
    await thread.setArchived(true, reason);
  }

  if (typeof thread.setLocked === "function" && !thread.locked) {
    await thread.setLocked(true, reason);
  }

  return {
    closed: true,
    archived: true,
    locked: true,
  };
};
