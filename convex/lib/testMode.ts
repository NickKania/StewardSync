import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { UserFacingError } from "./errors";

export const TEST_MODE_SESSION_PREFIX = "test-mode-session:";
const UUID_V4 = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const SESSION_TOKEN = new RegExp(`^${TEST_MODE_SESSION_PREFIX}${UUID_V4}${UUID_V4}$`);

export function isTestModeEnabled(): boolean {
  return process.env["STEWARDSYNC_TEST_MODE"] === "true";
}

export function assertTestModeEnabled(): void {
  if (!isTestModeEnabled()) throw new UserFacingError("Test mode is disabled");
}

export function isTestSessionToken(token: string): boolean {
  return SESSION_TOKEN.test(token) && !/\s/.test(token);
}

export function findTestModeOwnership(ctx: QueryCtx, entityTable: string, entityId: string) {
  return ctx.db.query("testModeOwnership")
    .withIndex("by_table_and_entity", (q) => q.eq("entityTable", entityTable).eq("entityId", entityId))
    .unique();
}

export async function getValidTestSessionUser(ctx: QueryCtx, token: string): Promise<Id<"users"> | null> {
  if (!isTestModeEnabled() || !isTestSessionToken(token)) return null;
  const session = await ctx.db.query("testModeSessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (!session || !(session.expiresAt > Date.now())) return null;
  const user = await ctx.db.get(session.userId);
  if (!user || !await findTestModeOwnership(ctx, "users", user._id)) return null;
  return user._id;
}

/** Called in the transaction that writes the correction, including any joint review. */
export async function assertCorrectionActorAndTarget(
  ctx: QueryCtx,
  userId: Id<"users">,
  testSessionToken: string | undefined,
  report: Doc<"reports">,
  reviewIds: readonly Id<"reviews">[] = [],
) {
  const actor = await findTestModeOwnership(ctx, "users", userId);
  if (!actor && testSessionToken === undefined) return;
  if (!actor || !testSessionToken || await getValidTestSessionUser(ctx, testSessionToken) !== userId) {
    throw new UserFacingError("A valid test mode session is required to make corrections");
  }

  const event = await ctx.db.get(report.eventId);
  if (event && await findTestModeOwnership(ctx, "series", event.seriesId)) return;
  if (!await findTestModeOwnership(ctx, "reports", report._id)) {
    throw new UserFacingError("Test mode sessions can only correct fixture reports");
  }
  for (const reviewId of reviewIds) {
    if (!await findTestModeOwnership(ctx, "reviews", reviewId)) {
      throw new UserFacingError("Test mode sessions can only correct fixture reviews");
    }
  }
}
