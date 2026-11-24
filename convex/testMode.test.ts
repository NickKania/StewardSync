import { afterEach, beforeEach, expect, it, spyOn } from "bun:test";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { create, getPendingForReview, getReadyForFinalization, updateFinalizedDetailsVerified } from "./reports";
import { getDriverRequirement, listPendingRequests } from "./raceBanReviews";
import { recalculateSeriesLicensePoints } from "./lib/penalties";
import { reportCounter } from "./reportCounter";
import {
  authenticateAs, ensureTestUsers, getState, getStatus, listTestUsers, reset, resolveTestSession, stageCustom, stageScenario,
} from "./testMode";

type Row = { _id: string; _creationTime: number } & Record<string, unknown>;
type Predicate = (row: Row) => boolean;

function fixture() {
  let nextId = 0;
  let reportNumber = 0;
  const rows = new Map<string, Row>();
  const tableOf = (id: string) => id.split(":")[0];
  const get = async (id: string) => rows.get(id) ?? null;
  const insert = async (table: string, data: Record<string, unknown>) => {
    const _creationTime = ++nextId;
    const _id = `${table}:${nextId}`;
    rows.set(_id, { ...data, _id, _creationTime });
    return _id;
  };
  const patch = async (id: string, changes: Record<string, unknown>) => { Object.assign(rows.get(id)!, changes); };
  const remove = spyOn({ run: async (id: string) => { rows.delete(id); } }, "run");
  const cancel = spyOn({ run: async (_id: string) => {} }, "run");
  const query = (table: string) => {
    const predicates: Predicate[] = [];
    let direction = "asc";
    const current = () => {
      const matching = Array.from(rows.values()).filter(
        (row) => tableOf(row._id) === table && predicates.every((predicate) => predicate(row)),
      );
      return direction === "desc" ? matching.reverse() : matching;
    };
    const selection = {
      withIndex(_index: string, configure: (index: unknown) => void) {
        const index = {
          eq(field: string, value: unknown) {
            predicates.push((row) => row[field] === value);
            return index;
          },
        };
        configure(index);
        return selection;
      },
      filter(configure: (filter: unknown) => Predicate) {
        predicates.push(configure({
          field: (key: string) => (row: Row) => row[key],
          eq: (field: (row: Row) => unknown, value: unknown) => (row: Row) => field(row) === value,
          lte: (field: (row: Row) => number, value: number) => (row: Row) => field(row) <= value,
          or: (...options: Predicate[]) => (row: Row) => options.some((predicate) => predicate(row)),
        }));
        return selection;
      },
      order(sort: string) { direction = sort; return selection; },
      collect: async () => current(),
      first: async () => current()[0] ?? null,
      unique: async () => {
        const matches = current();
        if (matches.length > 1) throw new Error("Expected unique index");
        return matches[0] ?? null;
      },
    };
    return selection;
  };
  const ctx = {
    db: {
      get, insert, patch, delete: remove, query,
      normalizeId: (table: string, id: string) => tableOf(id) === table ? id : null,
      system: { get: (_table: string, id: string) => get(id) },
    },
    scheduler: { cancel },
  } as unknown as MutationCtx;
  spyOn(reportCounter, "inc").mockImplementation(async () => { reportNumber++; });
  spyOn(reportCounter, "count").mockImplementation(async () => reportNumber);
  return {
    ctx, rows, patch, remove, cancel,
    get: get as <Table extends TableNames>(id: Id<Table>) => Promise<Doc<Table> | null>,
    insert: insert as <Table extends TableNames>(table: Table, data: Omit<Doc<Table>, "_id" | "_creationTime">) => Promise<Id<Table>>,
    query,
  };
}

const originalTestMode = process.env["STEWARDSYNC_TEST_MODE"];
beforeEach(() => { process.env["STEWARDSYNC_TEST_MODE"] = "true"; });
afterEach(() => {
  if (originalTestMode === undefined) delete process.env["STEWARDSYNC_TEST_MODE"];
  else process.env["STEWARDSYNC_TEST_MODE"] = originalTestMode;
  spyOn(reportCounter, "inc").mockRestore();
  spyOn(reportCounter, "count").mockRestore();
});

it("fails closed on every endpoint with the flag absent or different from true", async () => {
  const ctx = new Proxy({}, {
    get() { throw new Error("Unexpected database access"); },
  }) as MutationCtx;
  for (const value of [undefined, "false", "TRUE", "true "]) {
    if (value === undefined) delete process.env["STEWARDSYNC_TEST_MODE"];
    else process.env["STEWARDSYNC_TEST_MODE"] = value;
    const publicEndpoints = [
      () => getStatus._handler(ctx, {}),
      () => listTestUsers._handler(ctx, {}),
      () => ensureTestUsers._handler(ctx, {}),
      () => authenticateAs._handler(ctx, { roleOrKey: "driver" }),
      () => stageScenario._handler(ctx, { scenario: "baseline" }),
      () => stageCustom._handler(ctx, {}),
      () => getState._handler(ctx, {}),
      () => reset._handler(ctx, {}),
    ];
    for (const invoke of publicEndpoints) await expect(invoke()).rejects.toThrow("Test mode is disabled");
    expect(await resolveTestSession._handler(ctx, { token: "test-mode-session:invalid" })).toBeNull();
  }
});

async function ordinarySeries(state: ReturnType<typeof fixture>) {
  const now = Date.now();
  const seriesId = await state.insert("series", { name: "[TEST] Legacy", isActive: true, createdAt: now });
  const eventId = await state.insert("events", { seriesId, eventNumber: 1, trackName: "Spa", eventDate: now, createdAt: now });
  const raceId = await state.insert("races", { eventId, raceNumber: 1, createdAt: now });
  const driverId = await state.insert("drivers", { championshipId: seriesId, driverName: "Legacy Driver", createdAt: now });
  return { seriesId, eventId, raceId, driverId };
}

it("stages and operates on real workflows, then resets only the selected scenario and its audit rows", async () => {
  const state = fixture();
  const legacy = await ordinarySeries(state);
  const { users } = await ensureTestUsers._handler(state.ctx, {});
  const staff = await authenticateAs._handler(state.ctx, { roleOrKey: "league_manager" });
  const ordinaryReport = await create._handler(state.ctx, {
    reportingUserId: users.league_manager.id, reportedDriverId: legacy.driverId,
    eventId: legacy.eventId, raceId: legacy.raceId, lap: "1", turn: "2", description: "Ordinary report of an incident.",
  });
  await state.patch(ordinaryReport, { status: "finalized", isFinalized: true });
  const audit = await state.insert("changeHistory", {
    tableName: "reports", documentId: ordinaryReport, changedByUserId: users.league_manager.id,
    fieldName: "status", source: "manual", changedAt: Date.now(),
  });

  const demo = await stageScenario._handler(state.ctx, { scenario: "race_ban_review", scenarioId: "agent-a" });
  const other = await stageScenario._handler(state.ctx, { scenario: "review_workflow", scenarioId: "other-agent" });
  await state.patch(demo.seriesId, { name: "Renamed series" });
  expect((await getState._handler(state.ctx, {})).scenarios.map(({ scenarioId }) => scenarioId))
    .toEqual(["agent-a", "other-agent"]);
  expect(await getStatus._handler(state.ctx, {})).toEqual({ enabled: true });

  const created = await create._handler(state.ctx, {
    reportingUserId: users.driver.id, reportingDriverId: demo.driverIds.driver1,
    reportedDriverId: demo.driverIds.driver2, eventId: demo.eventIds.round1, raceId: demo.raceIds.round1Race1,
    lap: "2", turn: "3", description: "A new ordinary report inside the staged series.",
  });
  const requestable = demo.driverSeriesPenalties.find((assignment) =>
    assignment.driverId === demo.driverIds.driver2 && assignment.requiresReview)!;
  expect(await getDriverRequirement._handler(state.ctx, {
    userId: users.driver_2.id, driverSeriesPenaltyId: requestable.id,
  })).toMatchObject({ existingRequest: null, threshold: { threshold: 6, requiresReview: true } });
  const open = demo.raceBanReviews.openRaceBanReview;
  expect(await getDriverRequirement._handler(state.ctx, {
    userId: users.driver.id, driverSeriesPenaltyId: open.driverSeriesPenaltyId,
  })).toMatchObject({ existingRequest: { _id: open.id, status: "open" } });
  expect(await listPendingRequests._handler(state.ctx, { seriesId: demo.seriesId, userId: users.head_steward.id }))
    .toHaveLength(1);
  expect((await getPendingForReview._handler(state.ctx, {})).find(({ _id }) => _id === other.reports.singleReviewReport.id))
    .toMatchObject({ reviewCount: 1 });
  expect((await getReadyForFinalization._handler(state.ctx, {})).find(({ _id }) => _id === other.reports.readyToFinalizeReport.id))
    .toMatchObject({ reviewCount: 2 });

  const ownedReport = demo.reports.driver2FinalizedReport1.id;
  const correction = {
    currentUserId: staff.user._id, testSessionToken: staff.sessionToken, lap: "3", turn: "4",
    description: "Corrected detail after reviewing the replay.", videoLink: "", videoTimestamp: "",
  };
  expect(await updateFinalizedDetailsVerified._handler(state.ctx, { ...correction, reportId: ownedReport })).toBe(ownedReport);
  await expect(updateFinalizedDetailsVerified._handler(state.ctx, { ...correction, reportId: ordinaryReport }))
    .rejects.toThrow("only correct fixture reports");
  const wrongTableHistory = await state.insert("changeHistory", {
    tableName: "events", documentId: ownedReport, fieldName: "name", source: "manual", changedAt: Date.now(),
  });

  const previousNumber = (await state.get(created))!.reportId!;
  const result = await reset._handler(state.ctx, { scenarioId: demo.scenarioId, includeUsers: true });
  expect(result.deletedByTable.reports).toBe(5);
  expect(result.deletedByTable.changeHistory).toBeGreaterThan(0);
  expect(result.revokedUserIds).toEqual([]);
  expect(await state.get(created)).toBeNull();
  expect(await state.get(demo.seriesId)).toBeNull();
  expect(await state.get(open.id)).toBeNull();
  expect(await state.get(legacy.seriesId)).toMatchObject({ name: "[TEST] Legacy" });
  expect(await state.get(audit)).not.toBeNull();
  expect(await state.get(wrongTableHistory)).not.toBeNull();
  expect(await state.get(ordinaryReport)).not.toBeNull();
  expect(await state.get(other.seriesId)).not.toBeNull();
  expect(await resolveTestSession._handler(state.ctx, { token: staff.sessionToken })).toBe(staff.user._id);

  const next = await create._handler(state.ctx, {
    reportingUserId: users.driver.id, reportedDriverId: legacy.driverId,
    eventId: legacy.eventId, raceId: legacy.raceId, lap: "2", turn: "3", description: "Another ordinary report.",
  });
  expect((await state.get(next))?.reportId).toBe(previousNumber + 1);
});

it("revokes all sessions and preserves a fixture user whose only surviving reference is changeHistory", async () => {
  const state = fixture();
  const { users } = await stageScenario._handler(state.ctx, { scenario: "baseline" });
  const steward = await authenticateAs._handler(state.ctx, { roleOrKey: "steward" });
  const manager = await authenticateAs._handler(state.ctx, { roleOrKey: "league_manager" });
  const series = await ordinarySeries(state);
  const history = await state.insert("changeHistory", {
    tableName: "series", documentId: series.seriesId, fieldName: "name", source: "manual",
    changedAt: Date.now(), changedByUserId: manager.user._id,
  });
  const result = await reset._handler(state.ctx, { allScenarios: true, includeUsers: true });
  expect(result.skippedUsers).toEqual([{ userId: manager.user._id, reasons: ["changeHistory"] }]);
  expect(result.deletedUserIds).toHaveLength(6);
  expect(result.revokedUserIds).toEqual([steward.user._id, manager.user._id]);
  expect(await state.get(history)).not.toBeNull();
  expect(await state.get(users.league_manager.id)).not.toBeNull();
  expect(await state.query("roles").collect()).toHaveLength(5);
  expect(await listTestUsers._handler(state.ctx, {})).toEqual([
    { key: "league_manager", user: manager.user },
  ]);
  expect(await resolveTestSession._handler(state.ctx, { token: manager.sessionToken })).toBeNull();
  expect(await resolveTestSession._handler(state.ctx, { token: steward.sessionToken })).toBeNull();
});

for (const dependency of ["report", "threshold"] as const) {
  it(`detects an external ${dependency} dependency before deleting any record`, async () => {
    const state = fixture();
    const demo = await stageScenario._handler(state.ctx, { scenario: "baseline" });
    const legacy = await ordinarySeries(state);
    const now = Date.now();
    let externalId: string;
    if (dependency === "report") {
      externalId = await create._handler(state.ctx, {
        reportingUserId: demo.users.driver.id, reportedDriverId: demo.driverIds.driver2,
        eventId: legacy.eventId, raceId: legacy.raceId, lap: "1", turn: "1", description: "An external reference.",
      });
    } else {
      const penalty = await state.insert("seriesPenalties", {
        seriesId: legacy.seriesId, penaltyName: "Ordinary penalty", createdAt: now,
      });
      const externalClass = await state.insert("driverClasses", {
        seriesId: legacy.seriesId, className: "pro", displayName: "Pro", createdAt: now,
      });
      externalId = await state.insert("seriesPenaltyThresholds", {
        seriesPenaltyId: penalty, threshold: 5, driverClassIds: [externalClass, demo.driverClassIds.pro], createdAt: now,
      });
    }
    const originalIds = [...state.rows.keys()];
    await expect(reset._handler(state.ctx, {})).rejects.toThrow(`surviving ${dependency === "report" ? "reports" : "seriesPenaltyThresholds"} row`);
    expect(state.remove).not.toHaveBeenCalled();
    expect([...state.rows.keys()]).toEqual(originalIds);
    expect(state.rows.has(externalId)).toBe(true);
    expect(await state.get(demo.seriesId)).not.toBeNull();
  });
}

for (const scenario of ["review_workflow", "race_ban_review"] as const) {
  it(`recalculates license points and assignments idempotently for ${scenario}`, async () => {
    const state = fixture();
    const demo = await stageScenario._handler(state.ctx, { scenario });
    const points = scenario === "review_workflow" ? 2 : 6;
    const orderedNumbers = Object.values(demo.reports).map(({ reportNumber }) => reportNumber);
    expect(orderedNumbers).toEqual(orderedNumbers.map((_, index) => index + 1));
    const before = await state.query("driverSeriesPenalties").collect();
    await recalculateSeriesLicensePoints(state.ctx, demo.seriesId);
    expect(await state.query("driverSeriesPenalties").collect()).toEqual(before);
    expect((await state.get(demo.driverIds.driver2))?.accumulatedLicensePoints).toBe(points);
    if (scenario === "review_workflow") {
      expect(before).toEqual([]);
      return;
    }
    expect((await state.get(demo.driverIds.driver1))?.accumulatedLicensePoints).toBe(points);
    expect(before).toHaveLength(4);
    for (const driverId of [demo.driverIds.driver1, demo.driverIds.driver2]) {
      expect(before.filter((row) => row.driverId === driverId).map((row) => row.seriesPenaltyId).sort())
        .toEqual([demo.seriesPenaltyIds.qualifyingBan, demo.seriesPenaltyIds.raceBan].sort());
    }
    const entities = (await getState._handler(state.ctx, {})).scenarios[0].entities;
    expect(entities.filter(({ entityTable }) => entityTable === "driverSeriesPenalties")).toHaveLength(4);
    const { id, driverSeriesPenaltyId } = demo.raceBanReviews.openRaceBanReview;
    expect(await state.get(id)).toMatchObject({ driverSeriesPenaltyId });
    expect(await state.get(driverSeriesPenaltyId)).toMatchObject({ raceBanReviewId: id });
  });
}

it("rejects reserved scenario IDs and duplicate scenarios across caller endpoints", async () => {
  const { ctx } = fixture();
  const scenarioId = "__users__";
  await expect(stageScenario._handler(ctx, { scenario: "baseline", scenarioId })).rejects.toThrow("cannot be __users__");
  await expect(stageCustom._handler(ctx, { scenarioId })).rejects.toThrow("cannot be __users__");
  await expect(getState._handler(ctx, { scenarioId })).rejects.toThrow("cannot be __users__");
  await expect(reset._handler(ctx, { scenarioId, allScenarios: true })).rejects.toThrow("cannot be __users__");
  await expect(stageScenario._handler(ctx, { scenario: "baseline", scenarioId: " padded " })).rejects.toThrow("Scenario ID");
  const existing = await stageScenario._handler(ctx, { scenario: "baseline" });
  await expect(stageScenario._handler(ctx, { scenario: "baseline", resetScenario: false })).rejects.toThrow("already exists");
  expect((await getState._handler(ctx, {})).scenarios[0].entities.some((entity) => entity.entityId === existing.seriesId)).toBe(true);
});

it("refuses to adopt an unowned account with a canonical test Discord ID", async () => {
  const state = fixture();
  const roleId = await state.insert("roles", { name: "driver", displayName: "Driver" });
  const ordinary = await state.insert("users", { name: "Ordinary Driver", discordId: "test-mode-driver", roleId, createdAt: Date.now() });
  await expect(ensureTestUsers._handler(state.ctx, {})).rejects.toThrow("unowned Discord ID");
  expect(await state.get(ordinary)).toMatchObject({ name: "Ordinary Driver", roleId });
  expect(await listTestUsers._handler(state.ctx, {})).toEqual([]);
});

it("issues and prunes expiring credentials per user", async () => {
  const state = fixture();
  const driver = await authenticateAs._handler(state.ctx, { roleOrKey: "driver", ttlSeconds: 1 });
  expect(driver).toMatchObject({ user: { role: { name: "driver" } }, expiresInSeconds: 1 });
  const steward = await authenticateAs._handler(state.ctx, { roleOrKey: "steward_2" });
  expect(steward.expiresInSeconds).toBe(900);
  const sessions = await state.query("testModeSessions").collect();
  for (const session of sessions) await state.patch(session._id, { expiresAt: Date.now() });
  const current = await authenticateAs._handler(state.ctx, { roleOrKey: "driver", ttlSeconds: 3600 });
  expect(current.sessionToken).not.toEqual(driver.sessionToken);
  expect(current.expiresInSeconds).toBe(3600);
  expect(await state.query("testModeSessions").collect()).toHaveLength(2);
  expect(await resolveTestSession._handler(state.ctx, { token: current.sessionToken })).toBe(driver.user._id);
  expect(await resolveTestSession._handler(state.ctx, { token: driver.sessionToken })).toBeNull();
  expect(await resolveTestSession._handler(state.ctx, { token: steward.sessionToken })).toBeNull();
  await expect(authenticateAs._handler(state.ctx, { roleOrKey: "driver", ttlSeconds: 3601 })).rejects.toThrow("Session duration");
});

const customReport = {
  fixtureKey: "customReport", eventId: "round1", raceId: "round1Race1",
  reportedDriverId: "driver2", reportingDriverId: "driver1",
  lap: "2", turn: "3", description: "Custom report describing an incident.",
};
const customReview = {
  fixtureKey: "customReview1", reportId: "customReport", stewardKey: "steward",
  incidentDescription: "Avoidable contact", reviewNotes: "Replay checked", recommendedPenalty: "tenSec",
};

it("creates and extends a custom series with owned records, reciprocal reviews, and recalculated assignments", async () => {
  const state = fixture();
  const custom = await stageCustom._handler(state.ctx, {
    scenarioId: "custom",
    series: { fixtureKey: "series", name: "Custom Championship" },
    driverClasses: [{ fixtureKey: "pro", className: "pro", displayName: "Pro" }],
    drivers: [
      { fixtureKey: "driver1", driverName: "Driver 1", driverClassId: "pro", userKey: "driver" },
      { fixtureKey: "driver2", driverName: "Driver 2", driverClassId: "pro", userKey: "driver_2" },
    ],
    penalties: [{ fixtureKey: "tenSec", name: "10s Time Penalty", licensePoints: 3, timePenalty: 10 }],
    seriesPenalties: [{ fixtureKey: "qualifyingBan", penaltyName: "Qualifying Ban" }],
    seriesPenaltyThresholds: [{
      fixtureKey: "threshold", seriesPenaltyId: "qualifyingBan", threshold: 3, driverClassIds: ["pro"],
    }],
    events: [{ fixtureKey: "round1", eventNumber: 1, trackName: "Spa" }],
    races: [{ fixtureKey: "round1Race1", eventId: "round1", raceNumber: 1 }],
    reports: [{ ...customReport, status: "finalized", appliedPenalty: "tenSec" }],
  });
  const driver2Id = custom.fixtures.driver2.entityId;
  expect(state.rows.get(driver2Id)?.accumulatedLicensePoints).toBe(3);
  expect(custom.driverSeriesPenalties).toEqual([
    expect.objectContaining({ driverId: driver2Id, seriesPenaltyId: custom.fixtures.qualifyingBan.entityId }),
  ]);
  expect(Object.values(custom.fixtures).some(({ entityTable }) => entityTable === "driverSeriesPenalties")).toBe(true);

  const extension = await stageCustom._handler(state.ctx, {
    scenarioId: "custom", seriesId: custom.seriesId,
    reviews: [
      { ...customReview, reportId: custom.reports.customReport.id, linkedReviewId: "customReview2" },
      { ...customReview, fixtureKey: "customReview2", stewardKey: "steward_2", linkedReviewId: "customReview1" },
    ],
  });
  const first = extension.reviews.customReview1.id;
  const second = extension.reviews.customReview2.id;
  expect(await state.get(first)).toMatchObject({ linkedReviewId: second, recommendedPenalty: custom.fixtures.tenSec.entityId });
  expect(await state.get(second)).toMatchObject({ linkedReviewId: first, assessedReportedDriverId: driver2Id });
  expect(extension.driverSeriesPenalties).toEqual(custom.driverSeriesPenalties);
  await expect(stageCustom._handler(state.ctx, {
    scenarioId: "custom", reviews: [customReview],
  })).rejects.toThrow('Fixture key "customReview1" already exists');
});

it("recalculates assignments on threshold-only stageCustom extensions and rejects prototype keys", async () => {
  const state = fixture();
  const staged = await stageCustom._handler(state.ctx, {
    scenarioId: "threshold-ext",
    series: { fixtureKey: "series", name: "[TEST] Threshold Extension" },
    driverClasses: [{ fixtureKey: "pro", className: "pro", displayName: "Pro" }],
    drivers: [
      { fixtureKey: "driver1", driverName: "Test Driver 1", driverClassId: "pro", userKey: "driver" },
      { fixtureKey: "driver2", driverName: "Test Driver 2", driverClassId: "pro", userKey: "driver_2" },
    ],
    penalties: [{ fixtureKey: "tenSec", name: "10s", timePenalty: 10, licensePoints: 3 }],
    events: [{ fixtureKey: "round1", eventNumber: 1, trackName: "Spa" }],
    races: [{ fixtureKey: "round1Race1", eventId: "round1", raceNumber: 1 }],
    reports: [{ ...customReport, status: "finalized", appliedPenalty: "tenSec" }],
  });
  expect(staged.driverSeriesPenalties).toEqual([]);

  const extended = await stageCustom._handler(state.ctx, {
    scenarioId: "threshold-ext",
    seriesId: staged.seriesId,
    seriesPenalties: [{ fixtureKey: "lateBan", penaltyName: "Late Qualifying Ban" }],
    seriesPenaltyThresholds: [{
      fixtureKey: "lateBanThreshold",
      seriesPenaltyId: "lateBan",
      threshold: 3,
      driverClassIds: ["pro"],
      requiresReview: false,
    }],
  });
  const driver2Id = staged.fixtures.driver2.entityId;
  expect(extended.driverSeriesPenalties).toEqual([
    expect.objectContaining({
      driverId: driver2Id,
      seriesPenaltyId: extended.fixtures.lateBan.entityId,
    }),
  ]);
  expect(Object.values(extended.fixtures).some(({ entityTable }) => entityTable === "driverSeriesPenalties")).toBe(true);

  for (const key of ["__proto__", "constructor", "prototype"]) {
    await expect(stageCustom._handler(state.ctx, {
      scenarioId: "threshold-ext",
      seriesId: staged.seriesId,
      events: [{ fixtureKey: key, eventNumber: 2, trackName: "Monza" }],
    })).rejects.toThrow(`Invalid fixture key "${key}"`);
  }
});

it("rejects custom cross-scenario and cross-parent references", async () => {
  const state = fixture();
  const demo = await stageScenario._handler(state.ctx, { scenario: "baseline", scenarioId: "custom" });
  const other = await stageScenario._handler(state.ctx, { scenario: "baseline", scenarioId: "external" });
  const scenarios = [
    [{ reports: [{ ...customReport, eventId: other.eventIds.round1 }] }, "events reference"],
    [{ reports: [{ ...customReport, raceId: "round2Race1" }] }, "Race does not belong"],
    [{ reports: [{ ...customReport, reportedDriverId: other.driverIds.driver2 }] }, "drivers reference"],
    [{ reports: [{ ...customReport, status: "finalized", appliedPenalty: other.penaltyIds.tenSec }] }, "penalties reference"],
    [{ drivers: [{ fixtureKey: "wrongClass", driverName: "Other", driverClassId: other.driverClassIds.pro }] }, "driverClasses reference"],
  ] as const;
  for (const [fields, error] of scenarios) {
    // Each entry throws before inserting the candidate fixture.
    const args = { scenarioId: demo.scenarioId, ...fields } as Parameters<typeof stageCustom._handler>[1];
    await expect(stageCustom._handler(state.ctx, args)).rejects.toThrow(error);
  }
  const extra = await stageCustom._handler(state.ctx, {
    scenarioId: demo.scenarioId, series: { fixtureKey: "second-series", name: "Second Series" },
    penalties: [{ fixtureKey: "foreignPenalty", name: "Foreign Penalty", timePenalty: 10, licensePoints: 3 }],
    driverClasses: [{ fixtureKey: "foreignClass", className: "pro", displayName: "Pro" }],
  });
  expect(extra.seriesId).not.toEqual(demo.seriesId);
  await expect(stageCustom._handler(state.ctx, {
    scenarioId: demo.scenarioId, seriesId: demo.seriesId,
    drivers: [{ fixtureKey: "badClass", driverName: "Wrong class", driverClassId: "foreignClass" }],
  })).rejects.toThrow("Driver class does not belong");
  const report = await stageCustom._handler(state.ctx, {
    scenarioId: demo.scenarioId, seriesId: demo.seriesId, reports: [customReport],
  });
  await expect(stageCustom._handler(state.ctx, {
    scenarioId: demo.scenarioId, seriesId: demo.seriesId,
    reviews: [{ ...customReview, reportId: report.reports.customReport.id, recommendedPenalty: "foreignPenalty" }],
  })).rejects.toThrow("Penalty does not belong");
});

for (const invalidity of ["ineligible role", "conflict", "duplicate authors", "one-way joint link"] as const) {
  it(`rejects custom reviews with ${invalidity}`, async () => {
    const state = fixture();
    const demo = await stageScenario._handler(state.ctx, { scenario: "baseline" });
    const report = invalidity === "conflict"
      ? { ...customReport, reportingDriverId: undefined, reportingUserKey: "steward" }
      : customReport;
    const first = invalidity === "ineligible role" ? { ...customReview, stewardKey: "driver" } : customReview;
    const reviews = invalidity === "duplicate authors"
      ? [first, { ...first, fixtureKey: "customReview2" }]
      : invalidity === "one-way joint link"
        ? [{ ...first, linkedReviewId: "customReview2" }, { ...first, fixtureKey: "customReview2", stewardKey: "steward_2" }]
        : [first];
    const expected = {
      "ineligible role": "Unauthorized",
      "conflict": "is involved in report",
      "duplicate authors": "must have distinct stewards",
      "one-way joint link": "must link to each other",
    };
    await expect(stageCustom._handler(state.ctx, {
      scenarioId: demo.scenarioId, reports: [report], reviews,
    })).rejects.toThrow(expected[invalidity]);
  });
}

it("cancels outstanding scenario jobs during reset and leaves terminal and external jobs alone", async () => {
  const state = fixture();
  const demo = await stageScenario._handler(state.ctx, { scenario: "race_ban_review" });
  const external = await ordinarySeries(state);
  const pendingImport = "_scheduled_functions:pending" as Id<"_scheduled_functions">;
  const terminalReminder = "_scheduled_functions:terminal" as Id<"_scheduled_functions">;
  const externalImport = "_scheduled_functions:external" as Id<"_scheduled_functions">;
  for (const [id, kind] of [[pendingImport, "pending"], [terminalReminder, "success"], [externalImport, "pending"]]) {
    state.rows.set(id, { _id: id, _creationTime: Date.now(), state: { kind } });
  }
  await state.patch(demo.seriesId, { scheduledImportJobId: pendingImport });
  await state.patch(external.seriesId, { scheduledImportJobId: externalImport });
  await state.patch(demo.raceBanReviews.openRaceBanReview.id, { meetingReminderJobId: terminalReminder });
  await reset._handler(state.ctx, {});
  expect(state.cancel).toHaveBeenCalledTimes(1);
  expect(state.cancel).toHaveBeenCalledWith(pendingImport);
});
