export const getEnvOrThrow = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is not configured.`);
  }
  return value;
};

export const toMention = (discordId: string) => `<@${discordId}>`;

export const toDiscordTimestamp = (timestampMs: number, style: "F" | "t" | "R") =>
  `<t:${Math.floor(timestampMs / 1000)}:${style}>`;

export interface DiscordThread {
  id: string;
  name: string;
  type: number;
}

class DiscordRestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function discordRequest<T>(
  method: "GET" | "POST" | "PUT" | "PATCH",
  path: string,
  body?: Record<string, unknown>,
  reason?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bot ${getEnvOrThrow("DISCORD_BOT_TOKEN")}`,
  };
  if (body) headers["Content-Type"] = "application/json";
  if (reason) headers["X-Audit-Log-Reason"] = encodeURIComponent(reason);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  const request = `${method} ${path}`;
  try {
    const response = await fetch(`https://discord.com/api/v10${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new DiscordRestError(
        response.status,
        `Discord ${request} failed (HTTP ${response.status}): ${await response.text()}`,
      );
    }
    return (response.status === 204 ? undefined : await response.json()) as T;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Discord ${request} timed out`);
    }
    if (error instanceof DiscordRestError) throw error;
    throw new Error(`Discord ${request} failed`, { cause: error });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchThreadIfAvailable(threadId: string | null): Promise<DiscordThread | null> {
  if (!threadId) return null;
  try {
    const channel = await discordRequest<DiscordThread>("GET", `/channels/${threadId}`);
    return [10, 11, 12].includes(channel.type) ? channel : null;
  } catch (error) {
    if (error instanceof DiscordRestError && error.status === 404) return null;
    throw error;
  }
}

interface CreateThreadParams {
  name: string;
  parentChannelId: string;
  participantDiscordIds: string[];
  invitable?: boolean;
  reason?: string;
}

export async function addThreadMember(threadId: string, userId: string): Promise<void> {
  await discordRequest<void>("PUT", `/channels/${threadId}/thread-members/${userId}`);
}

export async function sendDiscordMessage(channelId: string, content: string): Promise<void> {
  await discordRequest("POST", `/channels/${channelId}/messages`, { content });
}

export async function createPrivateThread(params: CreateThreadParams): Promise<DiscordThread> {
  const thread = await discordRequest<DiscordThread>(
    "POST",
    `/channels/${params.parentChannelId}/threads`,
    {
      name: params.name.slice(0, 100),
      type: 12,
      auto_archive_duration: 1440,
      invitable: params.invitable ?? false,
    },
    params.reason,
  );

  for (const discordId of params.participantDiscordIds) {
    await addThreadMember(thread.id, discordId);
  }
  return thread;
}

export async function closeThread(
  threadId: string,
  reason = "Thread closed",
): Promise<{ closed: boolean; archived: boolean; locked: boolean }> {
  const thread = await fetchThreadIfAvailable(threadId);
  if (!thread) throw new Error("Thread not found");

  await discordRequest("PATCH", `/channels/${thread.id}`, { archived: true, locked: true }, reason);
  return { closed: true, archived: true, locked: true };
}
