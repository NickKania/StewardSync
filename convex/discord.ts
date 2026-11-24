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

export interface DiscordThreadMetadata {
  archived?: boolean;
  locked?: boolean;
}

export interface DiscordThread {
  id: string;
  name: string;
  type: number;
  thread_metadata?: DiscordThreadMetadata;
}

class DiscordRestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const MAX_RETRIES = 3;
const MAX_RETRY_DELAY_MS = 10_000;
const IDEMPOTENT_METHODS = new Set(["GET", "PUT", "PATCH"]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryDelayMs(response: Response, responseText: string, attempt: number): number | null {
  const headerVal = response.headers.get("retry-after");
  if (headerVal !== null && headerVal.trim() !== "") {
    const parsed = Number(headerVal.trim());
    if (Number.isFinite(parsed) && parsed >= 0) {
      const delayMs = Math.ceil(parsed * 1000);
      return delayMs <= MAX_RETRY_DELAY_MS ? delayMs : null;
    }
  }
  try {
    const json = JSON.parse(responseText) as { retry_after?: unknown };
    if (typeof json.retry_after === "number" && Number.isFinite(json.retry_after) && json.retry_after >= 0) {
      const delayMs = Math.ceil(json.retry_after * 1000);
      return delayMs <= MAX_RETRY_DELAY_MS ? delayMs : null;
    }
  } catch {
    // Non-JSON error body
  }
  return Math.min(250 * 2 ** attempt, MAX_RETRY_DELAY_MS);
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

  const request = `${method} ${path}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`https://discord.com/api/v10${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = await response.text();
        const canRetry =
          attempt < MAX_RETRIES &&
          (response.status === 429 ||
            (response.status >= 500 && IDEMPOTENT_METHODS.has(method)));
        if (canRetry) {
          const delayMs = parseRetryDelayMs(response, text, attempt);
          if (delayMs !== null) {
            await sleep(delayMs);
            continue;
          }
        }
        throw new DiscordRestError(
          response.status,
          `Discord ${request} failed (HTTP ${response.status}): ${text}`,
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

  throw new Error(`Discord ${request} failed after retries`);
}

export async function fetchThreadIfAvailable(threadId: string | null): Promise<DiscordThread | null> {
  if (!threadId) return null;
  try {
    const channel = await discordRequest<DiscordThread>("GET", `/channels/${threadId}`);
    return [10, 11, 12].includes(channel.type) ? channel : null;
  } catch (error) {
    if (error instanceof DiscordRestError && (error.status === 404 || error.status === 403)) {
      return null;
    }
    throw error;
  }
}

interface CreateThreadParams {
  name: string;
  parentChannelId: string;
  participantDiscordIds: string[];
  invitable?: boolean;
  reason?: string;
  onThreadCreated?: (thread: DiscordThread) => Promise<void> | void;
}

export async function addThreadMember(threadId: string, userId: string): Promise<void> {
  await discordRequest<void>("PUT", `/channels/${threadId}/thread-members/${userId}`);
}

export async function sendDiscordMessage(
  channelId: string,
  content: string,
  allowedMentionUserIds?: string[],
): Promise<void> {
  const allowed_mentions = allowedMentionUserIds
    ? { parse: [] as string[], users: Array.from(new Set(allowedMentionUserIds)) }
    : { parse: ["users"] };
  await discordRequest("POST", `/channels/${channelId}/messages`, {
    content,
    allowed_mentions,
  });
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

  if (params.onThreadCreated) {
    await params.onThreadCreated(thread);
  }

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

  const isArchived = Boolean(thread.thread_metadata?.archived);
  const isLocked = Boolean(thread.thread_metadata?.locked);

  if (isArchived && isLocked) {
    return { closed: true, archived: true, locked: true };
  }

  // Discord rejects locking an already-archived thread (HTTP 400 / 50083) unless unarchived first.
  if (isArchived && !isLocked) {
    await discordRequest<DiscordThread>("PATCH", `/channels/${thread.id}`, { archived: false }, reason);
  }

  const updated = await discordRequest<DiscordThread>(
    "PATCH",
    `/channels/${thread.id}`,
    { archived: true, locked: true },
    reason,
  );

  const archived = updated?.thread_metadata?.archived ?? true;
  const locked = updated?.thread_metadata?.locked ?? true;
  return { closed: archived && locked, archived, locked };
}
