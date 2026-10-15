import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { UserFacingError } from "./errors";

/** Verify account ownership before trusting the client-supplied StewardSync ID. */
export async function requireDiscordImportManager(
  ctx: ActionCtx,
  args: { currentUserId: Id<"users">; discordAccessToken: string },
): Promise<void> {
  if (!args.discordAccessToken.trim()) {
    throw new UserFacingError("Please sign in with Discord again to manage driver imports.");
  }

  let response: Response;
  try {
    response = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${args.discordAccessToken}` },
    });
  } catch {
    throw new UserFacingError("Could not reach Discord to verify your sign-in. Please try again.");
  }
  if (!response.ok) {
    throw new UserFacingError("Discord authentication failed. Please sign in with Discord again.");
  }

  const profile: unknown = await response.json().catch(() => null);
  if (!profile || typeof profile !== "object" || !("id" in profile) || typeof profile.id !== "string") {
    throw new UserFacingError("Discord returned an invalid user identity.");
  }

  await ctx.runQuery(internal.auth.requireImportPermission, {
    currentUserId: args.currentUserId,
    discordId: profile.id,
  });
}
