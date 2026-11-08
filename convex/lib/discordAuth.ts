import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { api } from "../_generated/api";
import { UserFacingError } from "./errors";

/** Resolve the actor from Discord, never from a caller-selected StewardSync ID. */
export async function requireDiscordUser(
  ctx: Pick<ActionCtx, "runQuery">,
  accessToken: string,
): Promise<Id<"users">> {
  if (!accessToken || /\s/.test(accessToken)) {
    throw new UserFacingError("Sign in with Discord again to make corrections");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let response: Response;
  let profile: unknown;
  try {
    response = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    if (response.ok) profile = await response.json();
  } catch {
    throw new UserFacingError("Unable to verify Discord sign-in. Please try again");
  } finally {
    clearTimeout(timeout);
  }
  if (response.status === 401 || response.status === 403) {
    throw new UserFacingError("Sign in with Discord again to make corrections");
  }
  if (!response.ok) {
    throw new UserFacingError("Unable to verify Discord sign-in. Please try again");
  }
  if (!profile || typeof profile !== "object" || !("id" in profile) ||
    typeof profile.id !== "string" || !/^\d+$/.test(profile.id)) {
    throw new UserFacingError("Unable to verify Discord identity");
  }
  const user = await ctx.runQuery(api.auth.getUserByDiscordId, { discordId: profile.id });
  if (!user) throw new UserFacingError("No StewardSync account exists for this Discord user");
  return user._id;
}
