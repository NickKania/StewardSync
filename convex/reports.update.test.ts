import { describe, expect, it } from "bun:test";
import { markAsReviewed, update } from "./reports";

const handler = (update as any)._handler as (
  ctx: any,
  args: any,
) => Promise<any>;

const markReviewedHandler = (markAsReviewed as any)._handler as (
  ctx: any,
  args: any,
) => Promise<any>;

const baseDocs = (): Record<string, any> => ({
  owner: { _id: "owner", roleId: "roleDriver" },
  stewardUser: { _id: "stewardUser", roleId: "roleSteward" },
  otherDriver: { _id: "otherDriver", roleId: "roleDriver" },
  reviewerUser: { _id: "reviewerUser", roleId: "roleSteward" },
  roleDriver: { _id: "roleDriver", name: "driver" },
  roleSteward: { _id: "roleSteward", name: "steward" },
  s1: { _id: "s1" },
  s2: { _id: "s2" },
  e1: { _id: "e1", seriesId: "s1" },
  e2: { _id: "e2", seriesId: "s2" },
  r1: { _id: "r1", eventId: "e1" },
  r2: { _id: "r2", eventId: "e2" },
  dOld: { _id: "dOld", championshipId: "s1" },
  dNew: { _id: "dNew", championshipId: "s1" },
  dOtherSeries: { _id: "dOtherSeries", championshipId: "s2" },
  dLegacy: { _id: "dLegacy" },
  rep1: {
    _id: "rep1",
    reportingUserId: "owner",
    reportedDriverId: "dOld",
    eventId: "e1",
    raceId: "r1",
    isFinalized: false,
    status: "pending",
    description: "original description",
  },
});

const createCtx = (
  overrides: Record<string, any> = {},
  reviews: any[] = [],
) => {
  const docs: Record<string, any> = { ...baseDocs(), ...overrides };
  for (const review of reviews) {
    docs[review._id] = review;
  }
  const inserts: { table: string; doc: any }[] = [];
  const ctx = {
    db: {
      get: async (id: string) => docs[id] ?? null,
      patch: async (id: string, fields: any) => {
        docs[id] = { ...docs[id], ...fields };
      },
      insert: async (table: string, doc: any) => {
        inserts.push({ table, doc });
        return `${table}-${inserts.length}`;
      },
      query: (_table: string) => ({
        withIndex: (_name: string, _fn: any) => ({
          collect: async () => reviews.map((review) => docs[review._id]),
        }),
      }),
    },
  };
  return { ctx, docs, inserts };
};

describe("reports.update reportedDriverId", () => {
  it("persists a changed reported driver for the reporting user", async () => {
    const { ctx, docs } = createCtx();

    await handler(ctx, {
      currentUserId: "owner",
      reportId: "rep1",
      reportedDriverId: "dNew",
    });

    expect(docs["rep1"].reportedDriverId).toBe("dNew");
  });

  it("persists a changed reported driver for a steward", async () => {
    const { ctx, docs } = createCtx();

    await handler(ctx, {
      currentUserId: "stewardUser",
      reportId: "rep1",
      reportedDriverId: "dNew",
    });

    expect(docs["rep1"].reportedDriverId).toBe("dNew");
  });

  it("rejects an unrelated driver changing the reported driver", async () => {
    const { ctx, docs } = createCtx();

    await expect(
      handler(ctx, {
        currentUserId: "otherDriver",
        reportId: "rep1",
        reportedDriverId: "dNew",
      }),
    ).rejects.toThrow("Unauthorized");

    expect(docs["rep1"].reportedDriverId).toBe("dOld");
  });

  it("rejects an unknown caller", async () => {
    const { ctx } = createCtx();

    await expect(
      handler(ctx, {
        currentUserId: "missingUser",
        reportId: "rep1",
        reportedDriverId: "dNew",
      }),
    ).rejects.toThrow("User not found");
  });

  it("allows an unrelated edit that resends an unchanged legacy driver", async () => {
    const { ctx, docs } = createCtx({
      rep1: {
        _id: "rep1",
        reportingUserId: "owner",
        reportedDriverId: "dLegacy",
        eventId: "e1",
        raceId: "r1",
        isFinalized: false,
        status: "pending",
        description: "original description",
      },
    });

    await handler(ctx, {
      currentUserId: "owner",
      reportId: "rep1",
      reportedDriverId: "dLegacy",
      description: "edited description",
    });

    expect(docs["rep1"].description).toBe("edited description");
    expect(docs["rep1"].reportedDriverId).toBe("dLegacy");
  });

  it("rejects changing to a driver from another series", async () => {
    const { ctx, docs } = createCtx();

    await expect(
      handler(ctx, {
        currentUserId: "owner",
        reportId: "rep1",
        reportedDriverId: "dOtherSeries",
      }),
    ).rejects.toThrow(
      "Reported driver must belong to the report event's series",
    );

    expect(docs["rep1"].reportedDriverId).toBe("dOld");
  });

  it("allows simultaneous event and driver change into the new series", async () => {
    const { ctx, docs } = createCtx();

    await handler(ctx, {
      currentUserId: "owner",
      reportId: "rep1",
      eventId: "e2",
      raceId: "r2",
      reportedDriverId: "dOtherSeries",
    });

    expect(docs["rep1"].reportedDriverId).toBe("dOtherSeries");
    expect(docs["rep1"].eventId).toBe("e2");
  });

  it("rejects moving to another series while keeping a driver from the old series", async () => {
    const { ctx } = createCtx();

    await expect(
      handler(ctx, {
        currentUserId: "owner",
        reportId: "rep1",
        eventId: "e2",
        raceId: "r2",
        reportedDriverId: "dOld",
      }),
    ).rejects.toThrow(
      "Reported driver must belong to the report event's series",
    );
  });

  it("resets a reviewed report to pending and audits a target change", async () => {
    const { ctx, docs, inserts } = createCtx({
      rep1: {
        _id: "rep1",
        reportingUserId: "owner",
        reportedDriverId: "dOld",
        eventId: "e1",
        raceId: "r1",
        isFinalized: false,
        status: "reviewed",
        description: "original description",
      },
    });

    await handler(ctx, {
      currentUserId: "stewardUser",
      reportId: "rep1",
      reportedDriverId: "dNew",
    });

    expect(docs["rep1"].status).toBe("pending");
    const audit = inserts.find((i) => i.table === "changeHistory");
    expect(audit?.doc.fieldName).toBe("reportedDriverId");
    expect(audit?.doc.fromValue).toBe("dOld");
    expect(audit?.doc.toValue).toBe("dNew");
    expect(audit?.doc.changedByUserId).toBe("stewardUser");
  });

  it("backfills legacy reviews with the previous driver on a target change", async () => {
    const { ctx, docs } = createCtx(
      {
        rep1: {
          _id: "rep1",
          reportingUserId: "owner",
          reportedDriverId: "dOld",
          eventId: "e1",
          raceId: "r1",
          isFinalized: false,
          status: "reviewed",
          description: "original description",
        },
      },
      [{ _id: "rev1", reportId: "rep1", userId: "reviewerUser" }],
    );

    await handler(ctx, {
      currentUserId: "stewardUser",
      reportId: "rep1",
      reportedDriverId: "dNew",
    });

    expect(docs["rep1"].status).toBe("pending");
    expect(docs["rev1"].assessedReportedDriverId).toBe("dOld");
  });

  it("markAsReviewed requires a review of the current reported driver", async () => {
    const { ctx, docs } = createCtx({}, [
      {
        _id: "rev1",
        reportId: "rep1",
        userId: "reviewerUser",
        assessedReportedDriverId: "dOtherSeries",
      },
    ]);

    await expect(
      markReviewedHandler(ctx, { reportId: "rep1" }),
    ).rejects.toThrow("current reported driver");
    expect(docs["rep1"].status).toBe("pending");

    docs["rev1"] = { ...docs["rev1"], assessedReportedDriverId: "dOld" };
    await markReviewedHandler(ctx, { reportId: "rep1" });
    expect(docs["rep1"].status).toBe("reviewed");
  });

  it("blocks a target change that would make an existing reviewer the reported driver", async () => {
    const { ctx, docs } = createCtx(
      {
        dNew: { _id: "dNew", championshipId: "s1", userId: "reviewerUser" },
      },
      [{ _id: "rev1", reportId: "rep1", userId: "reviewerUser" }],
    );

    await expect(
      handler(ctx, {
        currentUserId: "stewardUser",
        reportId: "rep1",
        reportedDriverId: "dNew",
      }),
    ).rejects.toThrow("existing review");

    expect(docs["rep1"].reportedDriverId).toBe("dOld");
  });
});
