import { describe, expect, it } from "bun:test";
import { create, update, updateWithSecondSteward } from "./reviews";

const createHandler = (create as any)._handler as (
  ctx: any,
  args: any,
) => Promise<any>;
const updateHandler = (update as any)._handler as (
  ctx: any,
  args: any,
) => Promise<any>;
const updateSecondHandler = (updateWithSecondSteward as any)._handler as (
  ctx: any,
  args: any,
) => Promise<any>;

const makeDb = (seed: Record<string, any[]>) => {
  const tables: Record<string, any[]> = {
    reports: [],
    reviews: [],
    drivers: [],
    events: [],
    changeHistory: [],
    ...seed,
  };
  const byId = new Map<string, any>();
  for (const rows of Object.values(tables)) {
    for (const row of rows) byId.set(row._id, row);
  }
  let seq = 0;

  const evalConstraint = (doc: any, c: any) =>
    String(doc[c.field]) === String(c.value);

  const query = (table: string) => {
    let rows = [...(tables[table] ?? [])];
    const builder: any = {
      withIndex: (_name: string, fn: any) => {
        const constraints: any[] = [];
        const q: any = {
          eq: (field: any, value: any) => {
            constraints.push({
              field: typeof field === "string" ? field : field.__field,
              value,
            });
            return q;
          },
          field: (name: string) => ({ __field: name }),
        };
        fn(q);
        rows = rows.filter((doc) =>
          constraints.every((c) => evalConstraint(doc, c)),
        );
        return builder;
      },
      filter: (fn: any) => {
        const q: any = {
          field: (name: string) => ({ __field: name }),
          eq: (a: any, b: any) => ({ __eq: [a, b] }),
        };
        const expr = fn(q);
        rows = rows.filter((doc) => {
          const [a, b] = expr.__eq;
          const left = a?.__field ? doc[a.__field] : a;
          const right = b?.__field ? doc[b.__field] : b;
          return String(left) === String(right);
        });
        return builder;
      },
      order: () => builder,
      collect: async () => rows,
      first: async () => rows[0] ?? null,
    };
    return builder;
  };

  const db = {
    get: async (id: string) => byId.get(id) ?? null,
    patch: async (id: string, fields: any) => {
      const doc = byId.get(id);
      if (!doc) throw new Error(`patch missing ${id}`);
      for (const [k, v] of Object.entries(fields)) {
        if (v === undefined) delete doc[k];
        else doc[k] = v;
      }
    },
    insert: async (table: string, doc: any) => {
      const id = `${table}-${++seq}`;
      const row = { _id: id, ...doc };
      (tables[table] ??= []).push(row);
      byId.set(id, row);
      return id;
    },
    delete: async (id: string) => {
      byId.delete(id);
    },
    query,
  };
  return { ctx: { db }, tables, byId };
};

const baseReport = {
  _id: "rep1",
  reportingUserId: "reporter",
  reportedDriverId: "dNew",
  eventId: "e1",
  raceId: "r1",
  isFinalized: false,
  status: "pending",
};

const seedBase = (reviews: any[]) => ({
  reports: [{ ...baseReport }],
  reviews,
  drivers: [
    { _id: "dOld", championshipId: "s1" },
    { _id: "dNew", championshipId: "s1" },
  ],
  events: [{ _id: "e1", seriesId: "s1" }],
});

describe("review provenance after a reported-driver change", () => {
  it("counts a previous-driver review toward reviewed on create", async () => {
    const { ctx, byId } = makeDb(
      seedBase([
        {
          _id: "revStale",
          reportId: "rep1",
          userId: "stewardA",
          atFaultDriverId: "dOld",
          assessedReportedDriverId: "dOld",
        },
      ]),
    );

    const result = await createHandler(ctx, {
      userId: "stewardB",
      reportId: "rep1",
      incidentDescription: "desc",
      reviewNotes: "notes",
      recommendedPenalty: "pen1",
      atFaultDriverId: "dNew",
    });

    expect(result.success).toBe(true);
    expect(byId.get("rep1").status).toBe("reviewed");
    expect(byId.get(result.data).assessedReportedDriverId).toBe("dNew");
  });

  it("marks reviewed when two reviews assess the current driver", async () => {
    const { ctx, byId } = makeDb(
      seedBase([
        {
          _id: "revFresh",
          reportId: "rep1",
          userId: "stewardA",
          atFaultDriverId: "dNew",
          assessedReportedDriverId: "dNew",
        },
      ]),
    );

    const result = await createHandler(ctx, {
      userId: "stewardB",
      reportId: "rep1",
      incidentDescription: "desc",
      reviewNotes: "notes",
      recommendedPenalty: "pen1",
      atFaultDriverId: "dNew",
    });

    expect(result.success).toBe(true);
    expect(byId.get("rep1").status).toBe("reviewed");
  });

  it("stamps resubmitted reviews with the current driver via update", async () => {
    const { ctx, byId } = makeDb(
      seedBase([
        {
          _id: "revA",
          reportId: "rep1",
          userId: "stewardA",
          atFaultDriverId: "dOld",
          assessedReportedDriverId: "dOld",
        },
        {
          _id: "revB",
          reportId: "rep1",
          userId: "stewardB",
          atFaultDriverId: "dOld",
          assessedReportedDriverId: "dOld",
        },
      ]),
    );

    await updateHandler(ctx, {
      reviewId: "revA",
      userId: "stewardA",
      atFaultDriverId: "dNew",
    });
    expect(byId.get("revA").assessedReportedDriverId).toBe("dNew");
    expect(byId.get("rep1").status).toBe("reviewed");

    await updateHandler(ctx, {
      reviewId: "revB",
      userId: "stewardB",
      atFaultDriverId: "dNew",
    });
    expect(byId.get("rep1").status).toBe("reviewed");
  });

  it("does not refresh provenance on metadata-only updates", async () => {
    const { ctx, byId } = makeDb(
      seedBase([
        {
          _id: "revA",
          reportId: "rep1",
          userId: "stewardA",
          atFaultDriverId: "dOld",
          assessedReportedDriverId: "dOld",
          reviewDate: 100,
        },
        {
          _id: "revB",
          reportId: "rep1",
          userId: "stewardB",
          atFaultDriverId: "dOld",
          assessedReportedDriverId: "dOld",
          reviewDate: 100,
        },
      ]),
    );

    for (const reviewId of ["revA", "revB"]) {
      await updateHandler(ctx, {
        reviewId,
        userId: "stewardA",
        candidateForStandardization: true,
        isAdjusted: false,
      });
    }

    expect(byId.get("revA").assessedReportedDriverId).toBe("dOld");
    expect(byId.get("revB").assessedReportedDriverId).toBe("dOld");
    expect(byId.get("revA").reviewDate).toBe(100);
  });

  it("copies the joint assessment to a linked second review on resubmission", async () => {
    const { ctx, byId } = makeDb(
      seedBase([
        {
          _id: "revA",
          reportId: "rep1",
          userId: "stewardA",
          atFaultDriverId: "dOld",
          assessedReportedDriverId: "dOld",
          linkedReviewId: "revB",
          reviewDate: 100,
        },
        {
          _id: "revB",
          reportId: "rep1",
          userId: "stewardB",
          atFaultDriverId: "dOld",
          assessedReportedDriverId: "dOld",
          linkedReviewId: "revA",
          reviewDate: 100,
        },
      ]),
    );

    await updateSecondHandler(ctx, {
      reviewId: "revA",
      userId: "stewardA",
      secondStewardId: "stewardB",
      incidentDescription: "reassessed",
      atFaultDriverId: "dNew",
    });

    expect(byId.get("revB").atFaultDriverId).toBe("dNew");
    expect(byId.get("revB").assessedReportedDriverId).toBe("dNew");
    expect(byId.get("revB").reviewDate).toBeGreaterThan(100);
    expect(byId.get("rep1").status).toBe("reviewed");
  });

});
