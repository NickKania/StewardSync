// Anonymous access to these endpoints is an intentional local-only authorization
// exception. Network access is the trust boundary when STEWARDSYNC_TEST_MODE === "true".
// Never enable this flag on staging or production.
import { v, type Infer } from "convex/values";
import type { WithoutSystemFields } from "convex/server";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import { internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { requireExactRole } from "./lib/auth";
import { UserFacingError } from "./lib/errors";
import { recalculateSeriesLicensePoints } from "./lib/penalties";
import { checkUserDriverConflict } from "./lib/reports";
import {
  assertTestModeEnabled, findTestModeOwnership, getValidTestSessionUser, TEST_MODE_SESSION_PREFIX,
} from "./lib/testMode";
import { reportCounter } from "./reportCounter";

const ROLE_DISPLAY_NAMES = {
  driver: "Driver",
  steward: "Steward",
  head_steward: "Head Steward",
  event_manager: "Event Manager",
  league_manager: "League Manager",
};
type RoleName = keyof typeof ROLE_DISPLAY_NAMES;
const USER_ROLES = {
  driver: "driver",
  driver_2: "driver",
  steward: "steward",
  steward_2: "steward",
  head_steward: "head_steward",
  event_manager: "event_manager",
  league_manager: "league_manager",
} satisfies Record<string, RoleName>;
type TestUserKey = keyof typeof USER_ROLES;
type UserWithRole = Doc<"users"> & { role: Doc<"roles"> & { name: RoleName } };
type UserManifest = { id: Id<"users">; discordId: string; name: string; role: RoleName };

const TEST_USER_KEYS = Object.keys(USER_ROLES) as TestUserKey[];
const USERS_SCENARIO = "__users__";
const DEFAULT_SCENARIO = "default";
const STEWARD_ROLES: RoleName[] = ["steward", "head_steward", "league_manager"];
const FINALIZER_ROLES: RoleName[] = ["head_steward", "league_manager"];
const RACE_BAN_STAFF: RoleName[] = ["head_steward", "event_manager", "league_manager"];

function validateScenarioId(scenarioId: string): string {
  if (scenarioId === USERS_SCENARIO || scenarioId !== scenarioId.trim() ||
      !/^[A-Za-z0-9._-]{1,64}$/.test(scenarioId)) {
    throw new UserFacingError("Scenario ID must be 1–64 letters, numbers, dots, underscores, or hyphens and cannot be __users__");
  }
  return scenarioId;
}

function isTestUserKey(key: string): key is TestUserKey {
  return Object.hasOwn(USER_ROLES, key);
}

function ownershipForScenario(ctx: QueryCtx, scenarioId: string) {
  return ctx.db.query("testModeOwnership")
    .withIndex("by_scenario", (q) => q.eq("scenarioId", scenarioId))
    .collect();
}

function recordOwnership(
  ctx: MutationCtx, scenarioId: string, entityTable: TableNames, entityId: string, fixtureKey: string,
) {
  return ctx.db.insert("testModeOwnership", {
    scenarioId, entityTable, entityId, fixtureKey, createdAt: Date.now(),
  });
}

async function insertFixture<Table extends TableNames>(
  ctx: MutationCtx, scenarioId: string, fixtureKey: string, table: Table, value: WithoutSystemFields<Doc<Table>>,
) {
  const id = await ctx.db.insert(table, value);
  await recordOwnership(ctx, scenarioId, table, id, fixtureKey);
  return id;
}

async function readOwnedUsers(ctx: QueryCtx): Promise<Array<{ key: string | null; user: UserWithRole }>> {
  const users: Array<{ key: string | null; user: UserWithRole }> = [];
  for (const { fixtureKey, entityTable, entityId } of await ownershipForScenario(ctx, USERS_SCENARIO)) {
    const id = entityTable === "users" ? ctx.db.normalizeId("users", entityId) : null;
    const user = id ? await ctx.db.get(id) : null;
    if (!user) continue;
    const role = await ctx.db.get(user.roleId);
    if (role && Object.hasOwn(ROLE_DISPLAY_NAMES, role.name)) {
      users.push({
        key: isTestUserKey(fixtureKey) ? fixtureKey : null,
        user: { ...user, role: { ...role, name: role.name as RoleName } },
      });
    }
  }
  return users;
}

function userManifest(user: UserWithRole): UserManifest {
  return { id: user._id, discordId: user.discordId!, name: user.name, role: user.role.name };
}

async function ensureUsers(ctx: MutationCtx): Promise<Record<TestUserKey, UserManifest>> {
  const roles = new Map<RoleName, Id<"roles">>();
  for (const role of Object.keys(ROLE_DISPLAY_NAMES) as RoleName[]) {
    const existing = await ctx.db.query("roles").withIndex("by_name", (q) => q.eq("name", role)).first();
    roles.set(role, existing?._id ?? await ctx.db.insert("roles", {
      name: role, displayName: ROLE_DISPLAY_NAMES[role],
    }));
  }

  const users = {} as Record<TestUserKey, UserManifest>;
  for (const key of TEST_USER_KEYS) {
    const role = USER_ROLES[key];
    const roleId = roles.get(role)!;
    const discordId = `test-mode-${key}`;
    const owned = await ctx.db.query("testModeOwnership")
      .withIndex("by_scenario_and_key", (q) => q.eq("scenarioId", USERS_SCENARIO).eq("fixtureKey", key))
      .unique();
    const existing = await ctx.db.query("users")
      .withIndex("by_discord_id", (q) => q.eq("discordId", discordId))
      .collect();
    if (existing.some((user) => owned?.entityTable !== "users" || user._id !== owned.entityId)) {
      throw new UserFacingError(`Test user "${key}" collides with an unowned Discord ID`);
    }
    const user = existing[0];
    if (owned && !user) throw new UserFacingError(`Test user "${key}" is missing or has an unexpected Discord ID`);
    const suffix = key.endsWith("_2") ? " 2" : "";
    const name = user?.name ?? `[TEST] ${ROLE_DISPLAY_NAMES[role]}${suffix}`;
    const id = user?._id ?? await insertFixture(ctx, USERS_SCENARIO, key, "users", {
      name, discordId, discordUsername: discordId, roleId, createdAt: Date.now(),
    });
    if (user && user.roleId !== roleId) await ctx.db.patch(id, { roleId });
    users[key] = { id, discordId, name, role };
  }
  return users;
}

export const getStatus = query({
  args: {},
  handler: async () => {
    assertTestModeEnabled();
    return { enabled: true as const };
  },
});

export const listTestUsers = query({
  args: {},
  handler: async (ctx) => {
    assertTestModeEnabled();
    return readOwnedUsers(ctx);
  },
});

export const ensureTestUsers = mutation({
  args: {},
  handler: async (ctx) => {
    assertTestModeEnabled();
    return { users: await ensureUsers(ctx) };
  },
});

export const authenticateAs = mutation({
  args: { roleOrKey: v.string(), ttlSeconds: v.optional(v.number()) },
  handler: async (ctx, args) => {
    assertTestModeEnabled();
    if (!isTestUserKey(args.roleOrKey)) throw new UserFacingError("Unknown test user");
    const ttlSeconds = args.ttlSeconds ?? 900;
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 3600) {
      throw new UserFacingError("Session duration must be a whole number between 1 and 3600 seconds");
    }
    const users = await ensureUsers(ctx);
    const userId = users[args.roleOrKey].id;
    const user = (await readOwnedUsers(ctx)).find(({ key }) => key === args.roleOrKey)?.user;
    if (!user) throw new UserFacingError("Test user not found");

    const now = Date.now();
    const expired = await ctx.db.query("testModeSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.lte(q.field("expiresAt"), now))
      .collect();
    for (const session of expired) await ctx.db.delete(session._id);

    const sessionToken = `${TEST_MODE_SESSION_PREFIX}${crypto.randomUUID()}${crypto.randomUUID()}`;
    const expiresAt = now + ttlSeconds * 1000;
    await ctx.db.insert("testModeSessions", { token: sessionToken, userId, createdAt: now, expiresAt });
    return { user, sessionToken, expiresInSeconds: ttlSeconds, expiresAt };
  },
});

export const resolveTestSession = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<Id<"users"> | null> => getValidTestSessionUser(ctx, args.token),
});

const scenarioName = v.union(v.literal("baseline"), v.literal("review_workflow"), v.literal("race_ban_review"));
type TestScenarioName = Infer<typeof scenarioName>;
const reportStatus = v.union(v.literal("pending"), v.literal("reviewed"), v.literal("finalized"), v.literal("rejected"));

type ReportManifest = { id: Id<"reports">; reportNumber: number; status: Doc<"reports">["status"] };
type ReviewManifest = { id: Id<"reviews">; reportId: Id<"reports">; stewardKey: TestUserKey };
type RaceBanManifest = {
  id: Id<"raceBanReviews">;
  driverSeriesPenaltyId: Id<"driverSeriesPenalties">;
  driverId: Id<"drivers">;
  status: Doc<"raceBanReviews">["status"];
};
type ScenarioLink = { key: string; label: string; path: string; recommendedRoles: RoleName[] };

type ReportInput = Omit<Doc<"reports">,
  "_id" | "_creationTime" | "reportId" | "reportDate" | "createdAt" | "updatedAt" | "isFinalized"
>;
async function insertReport(ctx: MutationCtx, scenarioId: string, key: string, report: ReportInput): Promise<ReportManifest> {
  await reportCounter.inc(ctx, "reportId");
  const reportNumber = await reportCounter.count(ctx, "reportId");
  const now = Date.now();
  const isFinalized = report.status === "finalized" || report.status === "rejected";
  const id = await insertFixture(ctx, scenarioId, key, "reports", {
    ...report, reportId: reportNumber, reportDate: now, createdAt: now, updatedAt: now, isFinalized,
  });
  return { id, reportNumber, status: report.status };
}

type ReviewInput = Omit<Doc<"reviews">,
  "_id" | "_creationTime" | "reviewDate" | "createdAt" | "updatedAt" | "assessedReportedDriverId"
>;
async function insertReview(
  ctx: MutationCtx, scenarioId: string, key: string, stewardKey: TestUserKey, report: Doc<"reports">, review: ReviewInput,
): Promise<ReviewManifest> {
  const now = Date.now();
  const id = await insertFixture(ctx, scenarioId, key, "reviews", {
    ...review, assessedReportedDriverId: report.reportedDriverId, reviewDate: now, createdAt: now, updatedAt: now,
  });
  return { id, reportId: report._id, stewardKey };
}

function seriesPenaltyAssignments(ctx: QueryCtx, seriesId: Id<"series">) {
  return ctx.db.query("driverSeriesPenalties").withIndex("by_series", (q) => q.eq("seriesId", seriesId)).collect();
}

function assignmentManifest(assignment: Doc<"driverSeriesPenalties">) {
  return {
    id: assignment._id, driverId: assignment.driverId, seriesPenaltyId: assignment.seriesPenaltyId,
    requiresReview: assignment.requiresReview ?? false, raceBanReviewId: assignment.raceBanReviewId,
  };
}

async function recalculateFixturePenalties(ctx: MutationCtx, scenarioId: string, seriesId: Id<"series">) {
  const previous = await seriesPenaltyAssignments(ctx, seriesId);
  const previousIds = new Set(previous.map(({ _id }) => _id));
  await recalculateSeriesLicensePoints(ctx, seriesId);
  const current = await seriesPenaltyAssignments(ctx, seriesId);
  const currentIds = new Set(current.map(({ _id }) => _id));

  for (const { _id } of previous) {
    if (currentIds.has(_id)) continue;
    const ownership = await findTestModeOwnership(ctx, "driverSeriesPenalties", _id);
    if (ownership?.scenarioId === scenarioId) await ctx.db.delete(ownership._id);
  }
  for (const { _id } of current) {
    if (!previousIds.has(_id)) {
      const key = `driverSeriesPenalty:${_id}`;
      const collision = await ctx.db.query("testModeOwnership")
        .withIndex("by_scenario_and_key", (q) => q.eq("scenarioId", scenarioId).eq("fixtureKey", key))
        .first();
      if (collision) throw new UserFacingError(`Fixture key "${key}" already exists`);
      await recordOwnership(ctx, scenarioId, "driverSeriesPenalties", _id, key);
    }
  }
  return current;
}

export const stageScenario = mutation({
  args: {
    scenario: scenarioName, scenarioId: v.optional(v.string()), resetScenario: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertTestModeEnabled();
    const scenarioId = validateScenarioId(args.scenarioId ?? DEFAULT_SCENARIO);
    const ownership = await ownershipForScenario(ctx, scenarioId);
    if (ownership.length > 0) {
      if (args.resetScenario === false) throw new UserFacingError(`Scenario "${scenarioId}" already exists`);
      await resetScenarios(ctx, ownership);
    }
    const scenario: TestScenarioName = args.scenario;
    const now = Date.now();
    const users = await ensureUsers(ctx);
    const seriesId = await insertFixture(ctx, scenarioId, "series", "series", {
      name: `[TEST] GT3 Sprint Championship (${scenarioId})`, createdAt: now,
      requireVideoEvidence: false, isReportingLocked: false, isActive: true,
    });
    const driverClass = (key: string, displayName: string) => insertFixture(ctx, scenarioId, key, "driverClasses", {
      seriesId, className: displayName, displayName, createdAt: now,
    });
    const driverClassIds = { pro: await driverClass("pro", "Pro"), am: await driverClass("am", "Am") };
    const stageDriver = (key: string, number: number, driverClassId: Id<"driverClasses">, userId?: Id<"users">) =>
      insertFixture(ctx, scenarioId, key, "drivers", {
        championshipId: seriesId, driverNumber: number, driverName: `Test Driver ${number}`, driverClassId,
        userId, accumulatedLicensePoints: 0, isActive: true, createdAt: now,
      });
    const driverIds = {
      driver1: await stageDriver("driver1", 11, driverClassIds.pro, users.driver.id),
      driver2: await stageDriver("driver2", 22, driverClassIds.pro, users.driver_2.id),
      driver3: await stageDriver("driver3", 33, driverClassIds.am),
      driver4: await stageDriver("driver4", 44, driverClassIds.am),
    };
    const stagePenalty = (key: string, name: string, timePenalty: number, licensePoints: number, reduction = 0, lpReduction = 0) =>
      insertFixture(ctx, scenarioId, key, "penalties", {
        seriesId, name, timePenalty, timePenaltyLap1: timePenalty, licensePoints, selfReportReduction: reduction,
        selfReportLicensePointReduction: lpReduction, allowNoDriverAtFault: key === "noFurtherAction", createdAt: now,
      });
    const penaltyIds = {
      fiveSec: await stagePenalty("fiveSec", "5s Time Penalty", 5, 2, 2, 1),
      tenSec: await stagePenalty("tenSec", "10s Time Penalty", 10, 3),
      noFurtherAction: await stagePenalty("noFurtherAction", "No Further Action", 0, 0),
    };
    const seriesPenaltyIds = {
      qualifyingBan: await insertFixture(ctx, scenarioId, "qualifyingBan", "seriesPenalties", {
        seriesId, penaltyName: "Qualifying Ban", createdAt: now,
      }),
      raceBan: await insertFixture(ctx, scenarioId, "raceBan", "seriesPenalties", {
        seriesId, penaltyName: "Race Ban", createdAt: now,
      }),
    };
    const threshold = (key: string, seriesPenaltyId: Id<"seriesPenalties">, points: number, requiresReview: boolean) =>
      insertFixture(ctx, scenarioId, key, "seriesPenaltyThresholds", {
        seriesPenaltyId, threshold: points, driverClassIds: [driverClassIds.pro, driverClassIds.am],
        requiresReview, createdAt: now,
      });
    const seriesPenaltyThresholdIds = {
      qualifyingBan: await threshold("qualifyingBanThreshold", seriesPenaltyIds.qualifyingBan, 4, false),
      raceBan: await threshold("raceBanThreshold", seriesPenaltyIds.raceBan, 6, true),
    };
    const stageEvent = (key: string, eventNumber: number, trackName: string, daysAgo: number) =>
      insertFixture(ctx, scenarioId, key, "events", {
        seriesId, eventNumber, trackName, eventDate: now - daysAgo * 86_400_000, createdAt: now,
      });
    const eventIds = {
      round1: await stageEvent("round1", 1, "Brands Hatch", 7),
      round2: await stageEvent("round2", 2, "Silverstone", 1),
    };
    const stageRace = (key: string, eventId: Id<"events">, raceNumber: number) =>
      insertFixture(ctx, scenarioId, key, "races", { eventId, raceNumber, createdAt: now });
    const raceIds = {
      round1Race1: await stageRace("round1Race1", eventIds.round1, 1),
      round1Race2: await stageRace("round1Race2", eventIds.round1, 2),
      round2Race1: await stageRace("round2Race1", eventIds.round2, 1),
      round2Race2: await stageRace("round2Race2", eventIds.round2, 2),
    };
    const reports: Record<string, ReportManifest> = {};
    const reviews: Record<string, ReviewManifest> = {};
    const raceBanReviews: Record<string, RaceBanManifest> = {};
    const links: ScenarioLink[] = [
      { key: "submitReport", label: "Submit an incident report", path: "/reports/new", recommendedRoles: ["driver"] },
    ];
    const stageReport = async (key: string, status: Doc<"reports">["status"], target: "driver1" | "driver2",
      raceId: Id<"races">, eventId: Id<"events">, penalty?: Id<"penalties">) => {
      const adjudicated = status === "finalized" || status === "rejected";
      const reportedDriverId = driverIds[target];
      const reportingDriverId = target === "driver2" ? driverIds.driver1 : driverIds.driver2;
      const reportingUserId = target === "driver2" ? users.driver.id : users.driver_2.id;
      const report = await insertReport(ctx, scenarioId, key, {
        reportedDriverId, reportingDriverId, reportingUserId, eventId, raceId, status,
        lap: "2", turn: "3", description: "Contact while racing side by side through the corner.",
        appliedPenalty: penalty, atFaultDriverId: penalty ? reportedDriverId : undefined,
        finalizedAt: adjudicated ? now : undefined, finalizedBy: adjudicated ? users.head_steward.id : undefined,
        finalDecision: status === "finalized" ? "At-fault driver caused avoidable contact." :
          status === "rejected" ? "Insufficient evidence to adjudicate." : undefined,
      });
      reports[key] = report;
      return (await ctx.db.get(report.id))!;
    };
    const stageReview = async (key: string, report: Doc<"reports">, stewardKey: "steward" | "steward_2") => {
      reviews[key] = await insertReview(ctx, scenarioId, key, stewardKey, report, {
        reportId: report._id, userId: users[stewardKey].id,
        incidentDescription: "The reported driver made avoidable contact.",
        reviewNotes: "Reviewed both drivers' lines through the corner.",
        recommendedPenalty: report.appliedPenalty ?? penaltyIds.fiveSec, atFaultDriverId: report.reportedDriverId,
      });
    };

    if (scenario === "review_workflow") {
      await stageReport("pendingReport", "pending", "driver2", raceIds.round1Race1, eventIds.round1);
      const single = await stageReport("singleReviewReport", "pending", "driver2", raceIds.round1Race2, eventIds.round1);
      await stageReview("singleReview", single, "steward");
      const ready = await stageReport("readyToFinalizeReport", "reviewed", "driver2", raceIds.round2Race1, eventIds.round2);
      await stageReview("readyReview1", ready, "steward");
      await stageReview("readyReview2", ready, "steward_2");
      const finalized = await stageReport("finalizedReport", "finalized", "driver2", raceIds.round2Race2, eventIds.round2, penaltyIds.fiveSec);
      await stageReview("finalizedReview1", finalized, "steward");
      await stageReview("finalizedReview2", finalized, "steward_2");
      await stageReport("rejectedReport", "rejected", "driver2", raceIds.round2Race2, eventIds.round2);
      links.push(
        { key: "pendingReport", label: "Review pending report", path: `/reviews/${reports["pendingReport"].id}`, recommendedRoles: STEWARD_ROLES },
        { key: "singleReviewReport", label: "Submit the second review", path: `/reviews/${single._id}`, recommendedRoles: STEWARD_ROLES },
        { key: "readyToFinalizeReport", label: "Finalize a reviewed report", path: `/finalize/${ready._id}`, recommendedRoles: FINALIZER_ROLES },
        { key: "finalizedReport", label: "View finalized report", path: `/reports/${finalized._id}`, recommendedRoles: ["league_manager"] },
      );
    }

    if (scenario === "race_ban_review") {
      for (const target of ["driver2", "driver1"] as const) {
        await stageReport(`${target}FinalizedReport1`, "finalized", target, raceIds.round1Race1, eventIds.round1, penaltyIds.tenSec);
        await stageReport(`${target}FinalizedReport2`, "finalized", target, raceIds.round2Race1, eventIds.round2, penaltyIds.tenSec);
      }
    }
    const assignments = scenario === "baseline" ? [] : await recalculateFixturePenalties(ctx, scenarioId, seriesId);
    if (scenario === "race_ban_review") {
      const raceBanFor = (driverId: Id<"drivers">) => assignments.find((assignment) =>
        assignment.driverId === driverId && assignment.seriesPenaltyId === seriesPenaltyIds.raceBan);
      const openPenalty = raceBanFor(driverIds.driver1);
      const requestablePenalty = raceBanFor(driverIds.driver2);
      if (!openPenalty || !requestablePenalty) throw new Error("Expected recalculated race bans for both test drivers");
      const id = await insertFixture(ctx, scenarioId, "openRaceBanReview", "raceBanReviews", {
        driverSeriesPenaltyId: openPenalty._id, driverId: openPenalty.driverId, userId: users.driver.id,
        seriesId, seriesPenaltyId: openPenalty.seriesPenaltyId,
        seriesPenaltyThresholdId: openPenalty.seriesPenaltyThresholdId,
        status: "open",
        availabilityWindows: [{ startAt: now + 86_400_000, endAt: now + 90_000_000 }],
        createdAt: now, updatedAt: now,
      });
      await ctx.db.patch(openPenalty._id, { raceBanReviewId: id });
      openPenalty.raceBanReviewId = id;
      raceBanReviews["openRaceBanReview"] = { id, driverSeriesPenaltyId: openPenalty._id, driverId: openPenalty.driverId, status: "open" };
      links.push(
        { key: "openRaceBanReview", label: "Manage open race ban review", path: `/race-reviews/${id}`, recommendedRoles: RACE_BAN_STAFF },
        { key: "requestablePenalty", label: "Request a race ban review as Driver 2", path: `/race-reviews/request/${requestablePenalty._id}`, recommendedRoles: ["driver"] },
      );
    }
    return {
      scenarioId, scenario, users, seriesId, driverClassIds, driverIds, penaltyIds,
      seriesPenaltyIds, seriesPenaltyThresholdIds, eventIds, raceIds, reports, reviews,
      driverSeriesPenalties: assignments.map(assignmentManifest), raceBanReviews, links,
    };
  },
});

const fixtureKeyField = { fixtureKey: v.string() };
const namedFixture = { ...fixtureKeyField, name: v.string() };
const optionalRef = v.optional(v.string());
const customArgs = {
  scenarioId: v.optional(v.string()),
  seriesId: v.optional(v.id("series")),
  series: v.optional(v.object({ ...namedFixture, description: v.optional(v.string()) })),
  driverClasses: v.optional(v.array(v.object({ ...fixtureKeyField, className: v.string(), displayName: v.string() }))),
  drivers: v.optional(v.array(v.object({
    ...fixtureKeyField, driverName: v.string(), driverNumber: v.optional(v.number()),
    driverClassId: optionalRef, userKey: optionalRef,
  }))),
  penalties: v.optional(v.array(v.object({
    ...namedFixture, timePenalty: v.number(), timePenaltyLap1: v.optional(v.number()),
    licensePoints: v.number(), selfReportReduction: v.optional(v.number()),
    selfReportLicensePointReduction: v.optional(v.number()), allowNoDriverAtFault: v.optional(v.boolean()),
  }))),
  seriesPenalties: v.optional(v.array(v.object({
    ...fixtureKeyField, penaltyName: v.string(), penaltyDescription: v.optional(v.string()),
  }))),
  seriesPenaltyThresholds: v.optional(v.array(v.object({
    ...fixtureKeyField, seriesPenaltyId: v.string(), driverClassIds: v.array(v.string()),
    threshold: v.number(), requiresReview: v.optional(v.boolean()),
  }))),
  events: v.optional(v.array(v.object({
    ...fixtureKeyField, eventNumber: v.number(), trackName: v.string(), eventDate: v.optional(v.number()),
  }))),
  races: v.optional(v.array(v.object({
    ...fixtureKeyField, eventId: v.string(), raceNumber: v.number(), sessionName: v.optional(v.string()),
  }))),
  reports: v.optional(v.array(v.object({
    ...fixtureKeyField, eventId: v.string(), raceId: v.string(), reportedDriverId: v.string(),
    reportingDriverId: optionalRef, reportingUserKey: optionalRef, atFaultDriverId: optionalRef,
    status: v.optional(reportStatus), finalizerKey: optionalRef, appliedPenalty: optionalRef,
    lap: v.string(), turn: v.string(), description: v.string(), finalDecision: v.optional(v.string()),
    officialNotes: v.optional(v.string()), isNoDriverAtFault: v.optional(v.boolean()),
    isSelfReport: v.optional(v.boolean()), videoLink: v.optional(v.string()), videoTimestamp: v.optional(v.string()),
  }))),
  reviews: v.optional(v.array(v.object({
    ...fixtureKeyField, reportId: v.string(), stewardKey: v.string(), linkedReviewId: optionalRef,
    recommendedPenalty: optionalRef, atFaultDriverId: optionalRef, isNoDriverAtFault: v.optional(v.boolean()),
    incidentDescription: v.string(), reviewNotes: v.string(), videoTimestamp: v.optional(v.string()),
  }))),
};

function resolveUser(users: Record<TestUserKey, UserManifest>, key: string): UserManifest {
  if (!isTestUserKey(key)) throw new UserFacingError(`Unknown test user "${key}"`);
  return users[key];
}

function sameSeries<T>(actual: T, expected: T, field: string) {
  if (actual !== expected) throw new UserFacingError(`${field} does not belong to the selected series or parent`);
}

const RESERVED_FIXTURE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export const stageCustom = mutation({
  args: customArgs,
  handler: async (ctx, args) => {
    assertTestModeEnabled();
    const scenarioId = validateScenarioId(args.scenarioId ?? DEFAULT_SCENARIO);
    const existing = await ownershipForScenario(ctx, scenarioId);
    const occupied = new Set(existing.map(({ fixtureKey }) => fixtureKey));
    for (const entries of [
      args.series ? [args.series] : [], args.driverClasses, args.drivers, args.penalties,
      args.seriesPenalties, args.seriesPenaltyThresholds, args.events, args.races, args.reports, args.reviews,
    ]) {
      for (const { fixtureKey } of entries ?? []) {
        if (
          RESERVED_FIXTURE_KEYS.has(fixtureKey) ||
          !/^[A-Za-z0-9._:-]{1,128}$/.test(fixtureKey) ||
          fixtureKey !== fixtureKey.trim()
        ) {
          throw new UserFacingError(`Invalid fixture key "${fixtureKey}"`);
        }
        if (occupied.has(fixtureKey)) throw new UserFacingError(`Fixture key "${fixtureKey}" already exists`);
        occupied.add(fixtureKey);
      }
    }

    const references = new Map(existing.map(({ fixtureKey, entityTable, entityId }) => [fixtureKey, { entityTable, entityId }]));
    const ownedIds = new Set(existing.map(({ entityId }) => entityId));
    const stagedFixtures = new Map<string, { entityTable: string; entityId: string }>();
    const register = (key: string, entityTable: TableNames, entityId: string) => {
      const entry = { entityTable, entityId };
      references.set(key, entry);
      stagedFixtures.set(key, entry);
      ownedIds.add(entityId);
    };
    const stage = async <Table extends TableNames>(
      key: string, table: Table, data: WithoutSystemFields<Doc<Table>>,
    ) => {
      const id = await insertFixture(ctx, scenarioId, key, table, data);
      register(key, table, id);
      return id;
    };
    const resolve = async <Table extends TableNames>(table: Table, value: string) => {
      const ref = references.get(value);
      const id = ctx.db.normalizeId(table, ref ? ref.entityId : value);
      const doc = id && ownedIds.has(id) ? await ctx.db.get(id) : null;
      if (!doc) throw new UserFacingError(`${table} reference "${value}" is not owned by scenario "${scenarioId}"`);
      return doc;
    };

    const now = Date.now();
    const users = await ensureUsers(ctx);
    const seriesOptions = existing.filter(({ entityTable }) => entityTable === "series");
    let seriesId: Id<"series">;
    if (args.series) {
      if (args.seriesId) throw new UserFacingError("Provide a new series or an existing series ID");
      const { fixtureKey, ...series } = args.series;
      seriesId = await stage(fixtureKey, "series", {
        ...series, isActive: true, isReportingLocked: false, requireVideoEvidence: false, createdAt: now,
      });
    } else {
      const ref = args.seriesId ?? (seriesOptions.length === 1 ? seriesOptions[0].entityId : undefined);
      if (!ref) throw new UserFacingError("Provide a new series or select a series owned by the scenario");
      seriesId = (await resolve("series", ref))._id;
    }

    const driverClass = async (ref: string) => {
      const doc = await resolve("driverClasses", ref);
      sameSeries(doc.seriesId, seriesId, "Driver class");
      return doc._id;
    };
    const driver = async (ref: string) => {
      const doc = await resolve("drivers", ref);
      sameSeries(doc.championshipId, seriesId, "Driver");
      if (doc.driverClassId) await driverClass(doc.driverClassId);
      return doc;
    };
    const event = async (ref: string) => {
      const doc = await resolve("events", ref);
      sameSeries(doc.seriesId, seriesId, "Event");
      return doc;
    };
    const penalty = async (ref: string) => {
      const doc = await resolve("penalties", ref);
      sameSeries(doc.seriesId, seriesId, "Penalty");
      return doc._id;
    };

    for (const { fixtureKey, ...data } of args.driverClasses ?? []) {
      await stage(fixtureKey, "driverClasses", { ...data, seriesId, createdAt: now });
    }
    for (const { fixtureKey, driverClassId, userKey, ...data } of args.drivers ?? []) {
      await stage(fixtureKey, "drivers", {
        ...data, championshipId: seriesId, driverClassId: driverClassId ? await driverClass(driverClassId) : undefined,
        userId: userKey ? resolveUser(users, userKey).id : undefined, isActive: true,
        accumulatedLicensePoints: 0, createdAt: now,
      });
    }
    for (const { fixtureKey, ...data } of args.penalties ?? []) {
      await stage(fixtureKey, "penalties", {
        ...data, timePenaltyLap1: data.timePenaltyLap1 ?? data.timePenalty, seriesId, createdAt: now,
      });
    }
    for (const { fixtureKey, ...data } of args.seriesPenalties ?? []) {
      await stage(fixtureKey, "seriesPenalties", { ...data, seriesId, createdAt: now });
    }
    for (const { fixtureKey, seriesPenaltyId, driverClassIds, ...data } of args.seriesPenaltyThresholds ?? []) {
      const seriesPenalty = await resolve("seriesPenalties", seriesPenaltyId);
      sameSeries(seriesPenalty.seriesId, seriesId, "Series penalty");
      await stage(fixtureKey, "seriesPenaltyThresholds", {
        ...data, seriesPenaltyId: seriesPenalty._id, driverClassIds: await Promise.all(driverClassIds.map(driverClass)),
        createdAt: now,
      });
    }
    for (const { fixtureKey, ...data } of args.events ?? []) {
      await stage(fixtureKey, "events", { ...data, eventDate: data.eventDate ?? now, seriesId, createdAt: now });
    }
    for (const { fixtureKey, eventId, ...data } of args.races ?? []) {
      await stage(fixtureKey, "races", { ...data, eventId: (await event(eventId))._id, createdAt: now });
    }

    const reports = new Map<string, ReportManifest>();
    for (const input of args.reports ?? []) {
      const {
        fixtureKey, eventId, raceId, reportedDriverId, reportingDriverId, reportingUserKey,
        atFaultDriverId, appliedPenalty, status = "pending", finalizerKey, ...details
      } = input;
      const reportEvent = await event(eventId);
      const race = await resolve("races", raceId);
      sameSeries(race.eventId, reportEvent._id, "Race");
      const reported = await driver(reportedDriverId);
      const reporting = reportingDriverId === undefined ? undefined : await driver(reportingDriverId);
      const author = reportingUserKey === undefined ? reporting?.userId : resolveUser(users, reportingUserKey).id;
      if (reporting?.userId && author !== reporting.userId) {
        throw new UserFacingError("Reporting user does not match the reporting driver");
      }
      const adjudicated = status === "finalized" || status === "rejected";
      const finalizedBy = adjudicated ? resolveUser(users, finalizerKey ?? "head_steward").id : undefined;
      if (finalizedBy) await requireExactRole(ctx, finalizedBy, FINALIZER_ROLES);
      const result = await insertReport(ctx, scenarioId, fixtureKey, {
        ...details, status, eventId: reportEvent._id, raceId: race._id, reportedDriverId: reported._id,
        reportingDriverId: reporting?._id, reportingUserId: author,
        atFaultDriverId: atFaultDriverId === undefined ? undefined : (await driver(atFaultDriverId))._id,
        appliedPenalty: appliedPenalty === undefined ? undefined : await penalty(appliedPenalty),
        finalizedBy, finalizedAt: adjudicated ? now : undefined,
      });
      register(fixtureKey, "reports", result.id);
      reports.set(fixtureKey, result);
    }

    const reviews = new Map<string, ReviewManifest>();
    const reviewInputs = new Map((args.reviews ?? []).map((entry) => [entry.fixtureKey, entry]));
    for (const [fixtureKey, input] of reviewInputs) {
      const {
        fixtureKey: _key, reportId, stewardKey, linkedReviewId: _linkedReviewId,
        recommendedPenalty, atFaultDriverId, ...details
      } = input;
      const report = await resolve("reports", reportId);
      await event(report.eventId);
      const reportRace = await resolve("races", report.raceId);
      sameSeries(reportRace.eventId, report.eventId, "Race");
      await driver(report.reportedDriverId);
      if (report.reportingDriverId) await driver(report.reportingDriverId);
      const user = resolveUser(users, stewardKey);
      await requireExactRole(ctx, user.id, STEWARD_ROLES);
      if ((await checkUserDriverConflict(ctx, user.id, report)).hasConflict) {
        throw new UserFacingError(`Steward "${stewardKey}" is involved in report "${reportId}"`);
      }
      const duplicate = await ctx.db.query("reviews")
        .withIndex("by_report", (q) => q.eq("reportId", report._id))
        .filter((q) => q.eq(q.field("userId"), user.id))
        .first();
      if (duplicate) throw new UserFacingError("Reviews on the same report must have distinct stewards");
      const result = await insertReview(ctx, scenarioId, fixtureKey, stewardKey as TestUserKey, report, {
        ...details, reportId: report._id, userId: user.id,
        recommendedPenalty: recommendedPenalty === undefined ? undefined : await penalty(recommendedPenalty),
        atFaultDriverId: atFaultDriverId === undefined ? undefined : (await driver(atFaultDriverId))._id,
      });
      register(fixtureKey, "reviews", result.id);
      reviews.set(fixtureKey, result);
    }
    for (const [key, input] of reviewInputs) {
      if (input.linkedReviewId === undefined) continue;
      const review = reviews.get(key)!;
      const partner = reviews.get(input.linkedReviewId);
      if (input.linkedReviewId === key || !partner || partner.reportId !== review.reportId ||
          reviewInputs.get(input.linkedReviewId)?.linkedReviewId !== key) {
        throw new UserFacingError("Joint reviews must link to each other and assess the same report");
      }
      await ctx.db.patch(review.id, { linkedReviewId: partner.id });
    }

    const needsRecalculation =
      Array.from(reports.values()).some(({ status }) => status === "finalized") ||
      (args.seriesPenaltyThresholds?.length ?? 0) > 0 ||
      (args.drivers?.length ?? 0) > 0;
    const assignments = needsRecalculation
      ? await recalculateFixturePenalties(ctx, scenarioId, seriesId)
      : await seriesPenaltyAssignments(ctx, seriesId);
    for (const { _id } of assignments) {
      const ownership = await findTestModeOwnership(ctx, "driverSeriesPenalties", _id);
      if (ownership?.scenarioId === scenarioId && !ownedIds.has(_id)) {
        register(ownership.fixtureKey, "driverSeriesPenalties", _id);
      }
    }
    return {
      scenarioId, seriesId, fixtures: Object.fromEntries(stagedFixtures),
      reports: Object.fromEntries(reports), reviews: Object.fromEntries(reviews),
      driverSeriesPenalties: assignments.map(assignmentManifest),
    };
  },
});

export const getState = query({
  args: { scenarioId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    assertTestModeEnabled();
    const scenarioId = args.scenarioId === undefined ? undefined : validateScenarioId(args.scenarioId);
    const ownership = scenarioId === undefined
      ? await ctx.db.query("testModeOwnership").collect()
      : await ownershipForScenario(ctx, scenarioId);
    const scenarios = new Map<string, Array<{ entityTable: string; entityId: string; fixtureKey: string }>>();
    for (const row of ownership) {
      if (row.scenarioId === USERS_SCENARIO) continue;
      const entities = scenarios.get(row.scenarioId) ?? [];
      entities.push({ entityTable: row.entityTable, entityId: row.entityId, fixtureKey: row.fixtureKey });
      scenarios.set(row.scenarioId, entities);
    }
    const users: Partial<Record<TestUserKey, UserManifest>> = {};
    for (const { key, user } of await readOwnedUsers(ctx)) {
      if (key !== null && isTestUserKey(key)) users[key] = userManifest(user);
    }
    return { enabled: true as const, users, scenarios: Array.from(scenarios, ([scenarioId, entities]) => ({ scenarioId, entities })) };
  },
});

type ScenarioEntity = {
  table: TableNames;
  id: Id<TableNames>;
  parent?: Id<TableNames>;
  references: ReadonlyArray<string | undefined>;
  job?: Id<"_scheduled_functions">;
};

// Parents are listed before descendants. A secondary reference never puts a
// row in the cascade, so a report in another series cannot be deleted merely
// because it references a fixture driver.
async function readScenarioEntities(ctx: QueryCtx): Promise<ScenarioEntity[]> {
  const [
    series, classes, drivers, penalties, seriesPenalties, thresholds, events, races, reports, reviews,
    assignments, requests,
  ] = await Promise.all([
    ctx.db.query("series").collect(),
    ctx.db.query("driverClasses").collect(),
    ctx.db.query("drivers").collect(),
    ctx.db.query("penalties").collect(),
    ctx.db.query("seriesPenalties").collect(),
    ctx.db.query("seriesPenaltyThresholds").collect(),
    ctx.db.query("events").collect(),
    ctx.db.query("races").collect(),
    ctx.db.query("reports").collect(),
    ctx.db.query("reviews").collect(),
    ctx.db.query("driverSeriesPenalties").collect(),
    ctx.db.query("raceBanReviews").collect(),
  ]);
  return [
    ...series.map((d): ScenarioEntity => ({
      table: "series", id: d._id, references: [], job: d.scheduledImportJobId,
    })),
    ...classes.map((d): ScenarioEntity => ({
      table: "driverClasses", id: d._id, parent: d.seriesId, references: [d.seriesId],
    })),
    ...drivers.map((d): ScenarioEntity => ({
      table: "drivers", id: d._id, parent: d.championshipId, references: [d.championshipId, d.driverClassId],
    })),
    ...penalties.map((d): ScenarioEntity => ({
      table: "penalties", id: d._id, parent: d.seriesId, references: [d.seriesId],
    })),
    ...seriesPenalties.map((d): ScenarioEntity => ({
      table: "seriesPenalties", id: d._id, parent: d.seriesId, references: [d.seriesId],
    })),
    ...thresholds.map((d): ScenarioEntity => ({
      table: "seriesPenaltyThresholds", id: d._id, parent: d.seriesPenaltyId,
      references: [d.seriesPenaltyId, ...d.driverClassIds],
    })),
    ...events.map((d): ScenarioEntity => ({
      table: "events", id: d._id, parent: d.seriesId, references: [d.seriesId],
    })),
    ...races.map((d): ScenarioEntity => ({
      table: "races", id: d._id, parent: d.eventId, references: [d.eventId],
    })),
    ...reports.map((d): ScenarioEntity => ({
      table: "reports", id: d._id, parent: d.eventId,
      references: [
        d.eventId, d.raceId, d.reportedDriverId, d.reportingDriverId, d.atFaultDriverId,
        d.appliedPenalty === undefined ? undefined : ctx.db.normalizeId("penalties", d.appliedPenalty) ?? undefined,
      ],
    })),
    ...reviews.map((d): ScenarioEntity => ({
      table: "reviews", id: d._id, parent: d.reportId,
      references: [
        d.reportId, d.linkedReviewId, d.atFaultDriverId, d.assessedReportedDriverId,
        d.recommendedPenalty === undefined ? undefined : ctx.db.normalizeId("penalties", d.recommendedPenalty) ?? undefined,
      ],
    })),
    ...assignments.map((d): ScenarioEntity => ({
      table: "driverSeriesPenalties", id: d._id, parent: d.seriesId,
      references: [d.seriesId, d.driverId, d.seriesPenaltyId, d.seriesPenaltyThresholdId, d.raceBanReviewId],
    })),
    ...requests.map((d): ScenarioEntity => ({
      table: "raceBanReviews", id: d._id, parent: d.seriesId,
      references: [d.seriesId, d.driverId, d.seriesPenaltyId, d.seriesPenaltyThresholdId, d.driverSeriesPenaltyId],
      job: d.meetingReminderJobId,
    })),
  ];
}

async function deleteEntityHistory(ctx: MutationCtx, table: string, id: string) {
  const history = await ctx.db.query("changeHistory")
    .withIndex("by_entity", (q) => q.eq("tableName", table).eq("documentId", id))
    .collect();
  for (const change of history) await ctx.db.delete(change._id);
  return history.length;
}

async function resetScenarios(ctx: MutationCtx, ownership: Doc<"testModeOwnership">[]) {
  const deletedByTable: Partial<Record<TableNames, number>> = {};
  if (ownership.length === 0) return deletedByTable;

  const selectedScenarios = new Set(ownership.map(({ scenarioId }) => scenarioId));
  const allOwners = await ctx.db.query("testModeOwnership").collect();
  const external = new Set(allOwners
    .filter(({ scenarioId }) => !selectedScenarios.has(scenarioId))
    .map(({ entityId }) => entityId));
  const owned = new Set(ownership.map(({ entityId }) => entityId));
  const toDelete = new Set<string>();
  const entities = await readScenarioEntities(ctx);

  for (const { id, parent } of entities) {
    if (!external.has(id) && (owned.has(id) || (parent && toDelete.has(parent)))) toDelete.add(id);
  }
  for (const { table, id, references } of entities) {
    if (toDelete.has(id)) continue;
    const conflict = references.find((ref) => ref !== undefined && toDelete.has(ref));
    if (conflict) {
      throw new UserFacingError(`Cannot reset scenario: surviving ${table} row "${id}" references fixture "${conflict}"`);
    }
  }

  for (const { table, id, job } of entities.reverse()) {
    if (!toDelete.has(id)) continue;
    if (job) {
      const scheduled = await ctx.db.system.get("_scheduled_functions", job);
      if (scheduled?.state.kind === "pending" || scheduled?.state.kind === "inProgress") {
        await ctx.scheduler.cancel(job);
      }
    }
    const historyDeleted = await deleteEntityHistory(ctx, table, id);
    if (historyDeleted) deletedByTable.changeHistory = (deletedByTable.changeHistory ?? 0) + historyDeleted;
    await ctx.db.delete(id);
    deletedByTable[table] = (deletedByTable[table] ?? 0) + 1;
  }
  for (const row of ownership) await ctx.db.delete(row._id);
  deletedByTable.testModeOwnership = ownership.length;
  return deletedByTable;
}

async function remainingUserReferences(ctx: QueryCtx, userId: Id<"users">): Promise<string[]> {
  const candidates = await Promise.all([
    ctx.db.query("reports").withIndex("by_reporting_user", (q) => q.eq("reportingUserId", userId)).first(),
    ctx.db.query("reports").filter((q) => q.or(
      q.eq(q.field("finalizedBy"), userId), q.eq(q.field("editedBy"), userId),
    )).first(),
    ctx.db.query("reviews").withIndex("by_user", (q) => q.eq("userId", userId)).first(),
    ctx.db.query("drivers").withIndex("by_user_id", (q) => q.eq("userId", userId)).first(),
    ctx.db.query("driverSeriesPenalties").filter((q) => q.eq(q.field("servedBy"), userId)).first(),
    ctx.db.query("raceBanReviews").filter((q) => q.or(
      q.eq(q.field("userId"), userId), q.eq(q.field("scheduledBy"), userId),
      q.eq(q.field("completedBy"), userId), q.eq(q.field("notesUpdatedBy"), userId),
    )).first(),
    ctx.db.query("steamUserMappings").withIndex("by_user_id", (q) => q.eq("userId", userId)).first(),
    ctx.db.query("changeHistory").withIndex("by_changed_by", (q) => q.eq("changedByUserId", userId)).first(),
  ]);
  const tables = ["reports", "reports", "reviews", "drivers", "driverSeriesPenalties", "raceBanReviews", "steamUserMappings", "changeHistory"];
  return [...new Set(tables.filter((_table, index) => candidates[index] !== null))];
}

export const reset = mutation({
  args: { scenarioId: v.optional(v.string()), allScenarios: v.optional(v.boolean()), includeUsers: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    assertTestModeEnabled();
    const scenarioId = validateScenarioId(args.scenarioId ?? DEFAULT_SCENARIO);
    const allOwnership = await ctx.db.query("testModeOwnership").collect();
    const scenarioOwnership = allOwnership.filter(({ scenarioId: owner }) => owner !== USERS_SCENARIO);
    const selected = args.allScenarios
      ? scenarioOwnership
      : scenarioOwnership.filter(({ scenarioId: owner }) => owner === scenarioId);
    const deletedByTable = await resetScenarios(ctx, selected);

    const deletedUserIds: Id<"users">[] = [];
    const revokedUserIds = new Set<Id<"users">>();
    const skippedUsers: Array<{ userId: Id<"users">; reasons: string[] }> = [];
    if (args.includeUsers && selected.length === scenarioOwnership.length) {
      for (const session of await ctx.db.query("testModeSessions").collect()) {
        await ctx.db.delete(session._id);
        revokedUserIds.add(session.userId);
        deletedByTable.testModeSessions = (deletedByTable.testModeSessions ?? 0) + 1;
      }
      for (const row of allOwnership.filter(({ scenarioId: owner }) => owner === USERS_SCENARIO)) {
        const userId = row.entityTable === "users" ? ctx.db.normalizeId("users", row.entityId) : null;
        if (!userId) continue;
        const reasons = await remainingUserReferences(ctx, userId);
        if (reasons.length > 0) {
          skippedUsers.push({ userId, reasons });
          continue;
        }

        if (await ctx.db.get(userId)) {
          const historyDeleted = await deleteEntityHistory(ctx, "users", userId);
          if (historyDeleted) deletedByTable.changeHistory = (deletedByTable.changeHistory ?? 0) + historyDeleted;
          await ctx.db.delete(userId);
          deletedUserIds.push(userId);
          deletedByTable.users = (deletedByTable.users ?? 0) + 1;
        }
        await ctx.db.delete(row._id);
        deletedByTable.testModeOwnership = (deletedByTable.testModeOwnership ?? 0) + 1;
      }
    }
    return { deletedByTable, deletedUserIds, revokedUserIds: [...revokedUserIds], skippedUsers };
  },
});
