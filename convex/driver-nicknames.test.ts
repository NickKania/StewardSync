import { describe, expect, it } from "bun:test";
import { getForSeries, recordNicknameChanges } from "./driverNicknames";
import type { DriverNicknameTargets } from "./lib/discordNicknames";

interface TestDocument {
  _id: string;
  [key: string]: unknown;
}

const series: TestDocument[] = [
  { _id: "series-1", isActive: true },
  { _id: "series-2" }, // Legacy series default to active.
  { _id: "series-3", isActive: false },
];
const user: TestDocument = {
  _id: "user-1", discordId: "discord-1", officialName: "Jane Marie Smith",
};
const driver: TestDocument = {
  _id: "driver-1", userId: "user-1", championshipId: "series-1",
  driverName: "Imported Name", officialName: "I. Name", driverNumber: 34,
};

async function getTargets(drivers: TestDocument[], users = [user]): Promise<DriverNicknameTargets> {
  const tables: Record<string, TestDocument[]> = { drivers, users, series };
  const ctx = {
    db: {
      get: async (id: string) => Object.values(tables).flat().find((row) => row._id === id) ?? null,
      query: (table: string) => ({
        collect: async () => tables[table],
        withIndex: (_name: string, filter: (q: {
          eq: (field: string, value: unknown) => { field: string; value: unknown };
        }) => { field: string; value: unknown }) => {
          const { field, value } = filter({ eq: (field, value) => ({ field, value }) });
          return { collect: async () => tables[table].filter((row) => row[field] === value) };
        },
      }),
    },
  };
  const query = getForSeries as unknown as {
    _handler: (context: typeof ctx, args: { championshipId: string }) => Promise<DriverNicknameTargets>;
  };
  return query._handler(ctx, { championshipId: "series-1" });
}

describe("Driver nickname roster", () => {
  it("uses the user's official name and unique numbers across active series", async () => {
    const result = await getTargets([
      driver,
      { ...driver, _id: "driver-2", championshipId: "series-2", driverNumber: 12 },
      { ...driver, _id: "driver-3", championshipId: "series-1", driverNumber: 34 },
      { ...driver, _id: "driver-4", championshipId: "series-3", driverNumber: 90 },
      { ...driver, _id: "driver-5", championshipId: "series-2", driverNumber: 91, isActive: false },
      { ...driver, _id: "driver-6", championshipId: undefined, driverNumber: 92 },
      { ...driver, _id: "driver-7", championshipId: "missing-series", driverNumber: 93 },
      { ...driver, _id: "driver-8", userId: "other-user", championshipId: "series-2", driverNumber: 94 },
    ]);

    expect(result).toEqual({
      targets: [{ userId: "user-1", discordId: "discord-1", officialName: "Jane Marie Smith", driverNumbers: [12, 34] }],
      skipped: 0,
    });
  });

  it("includes withdrawn users who are still participating in another active series", async () => {
    const result = await getTargets([
      { ...driver, isActive: false },
      { ...driver, _id: "driver-2", championshipId: "series-2", driverNumber: 12 },
    ]);
    expect(result.targets[0].driverNumbers).toEqual([12]);
  });

  it("skips users with no remaining active registration", async () => {
    expect(await getTargets([{ ...driver, isActive: false }])).toEqual({ targets: [], skipped: 1 });
    expect(await getTargets([
      { ...driver, isActive: false },
      { ...driver, _id: "driver-2", championshipId: "series-3" },
    ])).toEqual({ targets: [], skipped: 1 });
  });

  it("skips unlinked drivers and missing Discord identities", async () => {
    expect(await getTargets([{ ...driver, userId: undefined }])).toEqual({ targets: [], skipped: 1 });
    expect(await getTargets([driver], [{ ...user, discordId: undefined }])).toEqual({ targets: [], skipped: 1 });
    expect(await getTargets([driver], [])).toEqual({ targets: [], skipped: 1 });
  });

  it("falls back to StewardSync's driver display name for users without an official name", async () => {
    expect((await getTargets([driver], [{ ...user, officialName: undefined }])).targets[0].officialName)
      .toBe("Imported Name");
    expect((await getTargets([{ ...driver, officialName: undefined }], [{ ...user, officialName: undefined }]))
      .targets[0].officialName).toBe("Imported Name");
  });

  it("handles numberless drivers and car number zero", async () => {
    expect((await getTargets([{ ...driver, driverNumber: undefined }])).targets[0].driverNumbers).toEqual([]);
    expect((await getTargets([{ ...driver, driverNumber: 0 }])).targets[0].driverNumbers).toEqual([0]);
  });
});

describe("Driver nickname audit records", () => {
  it("writes one changeHistory row per rename against the user", async () => {
    const rows: Array<{ table: string; doc: Record<string, unknown> }> = [];
    const ctx = {
      db: {
        insert: async (table: string, doc: Record<string, unknown>) => {
          rows.push({ table, doc });
          return `change-${rows.length}`;
        },
      },
    };
    const mutation = recordNicknameChanges as unknown as {
      _handler: (context: typeof ctx, args: unknown) => Promise<null>;
    };
    await mutation._handler(ctx, {
      changedByUserId: "manager-1",
      changes: [
        { userId: "user-1", fromNickname: "Old Nick", toNickname: "Jane Marie Smith #12" },
        { userId: "user-2", toNickname: "John Smith #34" },
      ],
    });

    expect(rows.map((row) => row.table)).toEqual(["changeHistory", "changeHistory"]);
    expect(rows[0].doc).toMatchObject({
      tableName: "users",
      documentId: "user-1",
      fieldName: "discordNickname",
      fromValue: "Old Nick",
      toValue: "Jane Marie Smith #12",
      changedByUserId: "manager-1",
      source: "simgrid",
    });
    expect(typeof rows[0].doc["changedAt"]).toBe("number");
    expect(rows[1].doc).toMatchObject({
      documentId: "user-2",
      toValue: "John Smith #34",
    });
    expect(rows[1].doc["fromValue"]).toBeUndefined();
  });

  it("keeps renames internal-only", () => {
    expect((recordNicknameChanges as unknown as { isInternal: boolean }).isInternal).toBe(true);
  });
});
