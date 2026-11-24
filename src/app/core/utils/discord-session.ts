/** Keep the short-lived OAuth credential in this tab; never treat a stored user ID as proof of identity. */
export const DISCORD_SESSION_KEY = "steward_sync_discord_session";

type SessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function normalizeDeploymentScope(convexUrl: string | undefined): string | null {
  const trimmed = convexUrl?.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    const path = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.origin.toLowerCase()}${path}`;
  } catch {
    return trimmed.replace(/\/+$/, "").toLowerCase();
  }
}

export function getDiscordSessionKey(convexUrl?: string): string {
  const scope = normalizeDeploymentScope(convexUrl);
  return scope ? `${DISCORD_SESSION_KEY}:${scope}` : DISCORD_SESSION_KEY;
}

export function storeDiscordSession(
  storage: SessionStorage,
  userId: string,
  accessToken: string,
  expiresInSeconds: number,
  now = Date.now(),
  storageKey = DISCORD_SESSION_KEY,
): void {
  if (!accessToken || !Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    throw new Error("Invalid Discord sign-in response");
  }
  storage.setItem(storageKey, JSON.stringify({
    userId,
    accessToken,
    expiresAt: now + expiresInSeconds * 1000,
  }));
}

export function readDiscordAccessToken(
  storage: SessionStorage,
  userId: string | null,
  now = Date.now(),
  storageKey = DISCORD_SESSION_KEY,
): string | null {
  const token = parseAccessToken(storage.getItem(storageKey), userId, now);
  if (!token) storage.removeItem(storageKey);
  return token;
}

export function migrateLegacyDiscordSession(
  storage: SessionStorage,
  userId: string,
  targetKey: string,
  now = Date.now(),
): void {
  if (targetKey === DISCORD_SESSION_KEY) return;
  const raw = storage.getItem(DISCORD_SESSION_KEY);
  if (!raw || !parseAccessToken(raw, userId, now)) return;
  if (!storage.getItem(targetKey)) storage.setItem(targetKey, raw);
  storage.removeItem(DISCORD_SESSION_KEY);
}

function parseAccessToken(raw: string | null, userId: string | null, now: number): string | null {
  if (!raw || !userId) return null;
  try {
    const session: unknown = JSON.parse(raw);
    if (
      session && typeof session === "object" &&
      "userId" in session && session.userId === userId &&
      "accessToken" in session && typeof session.accessToken === "string" && session.accessToken &&
      "expiresAt" in session && typeof session.expiresAt === "number" &&
      Number.isFinite(session.expiresAt) && session.expiresAt > now
    ) {
      return session.accessToken;
    }
  } catch {
    // A malformed credential is treated as expired.
  }
  return null;
}
