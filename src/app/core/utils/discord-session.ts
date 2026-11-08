/** Keep the short-lived OAuth credential in this tab; never treat a stored user ID as proof of identity. */
export const DISCORD_SESSION_KEY = "steward_sync_discord_session";

type SessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function storeDiscordSession(
  storage: SessionStorage,
  userId: string,
  accessToken: string,
  expiresInSeconds: number,
  now = Date.now(),
): void {
  if (!accessToken || !Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    throw new Error("Invalid Discord sign-in response");
  }
  storage.setItem(DISCORD_SESSION_KEY, JSON.stringify({
    userId,
    accessToken,
    expiresAt: now + expiresInSeconds * 1000,
  }));
}

export function readDiscordAccessToken(
  storage: SessionStorage,
  userId: string | null,
  now = Date.now(),
): string | null {
  try {
    const session: unknown = JSON.parse(storage.getItem(DISCORD_SESSION_KEY) ?? "null");
    if (userId && session && typeof session === "object" &&
      "userId" in session && session.userId === userId &&
      "accessToken" in session && typeof session.accessToken === "string" && session.accessToken &&
      "expiresAt" in session && typeof session.expiresAt === "number" && session.expiresAt > now) {
      return session.accessToken;
    }
  } catch {
    // A malformed or outdated credential is treated as signed out for privileged corrections.
  }
  storage.removeItem(DISCORD_SESSION_KEY);
  return null;
}
