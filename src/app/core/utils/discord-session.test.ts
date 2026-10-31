import { describe, expect, it } from "bun:test";
import { DISCORD_SESSION_KEY, readDiscordAccessToken, storeDiscordSession } from "./discord-session";

function storage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

describe("Discord correction credentials", () => {
  it("survives reloads in the same tab until OAuth expiry", () => {
    const session = storage();
    storeDiscordSession(session, "user", "oauth-token", 60, 1000);
    expect(readDiscordAccessToken(session, "user", 60999)).toBe("oauth-token");
    expect(readDiscordAccessToken(session, "user", 61000)).toBeNull();
    expect(session.getItem(DISCORD_SESSION_KEY)).toBeNull();
  });

  it("does not reuse credentials when a stored user ID is swapped", () => {
    const session = storage();
    storeDiscordSession(session, "manager", "oauth-token", 60, 0);
    expect(readDiscordAccessToken(session, "attacker", 1000)).toBeNull();
    expect(readDiscordAccessToken(session, "manager", 1000)).toBeNull();
  });

  it("requires real login again for legacy ID-only or malformed sessions", () => {
    for (const content of ["null", "invalid-json", JSON.stringify({ userId: "user" }), JSON.stringify({ userId: "user", accessToken: "token", expiresAt: "tomorrow" })]) {
      const session = storage();
      session.setItem(DISCORD_SESSION_KEY, content);
      expect(readDiscordAccessToken(session, "user")).toBeNull();
      expect(session.getItem(DISCORD_SESSION_KEY)).toBeNull();
    }
  });

  it("rejects malformed OAuth expiration and empty credentials", () => {
    const session = storage();
    for (const expiry of [0, -1, NaN, Infinity]) {
      expect(() => storeDiscordSession(session, "user", "token", expiry)).toThrow();
    }
    expect(() => storeDiscordSession(session, "user", "", 60)).toThrow();
    expect(readDiscordAccessToken(session, "user")).toBeNull();
  });
});
