import { describe, expect, it } from "bun:test";

import { importOrUpdateDriver, markInactiveDrivers } from "./drivers";

interface TestDriver {
  _id: string;
  championshipId?: string;
  driverNumber?: number;
  driverName: string;
  username?: string;
  steamId?: string;
  isActive?: boolean;
  [key: string]: unknown;
}

function createTestContext(initialDrivers: TestDriver[] = []) {
  const drivers = initialDrivers.map((driver) => ({ ...driver }));
  let nextId = drivers.length + 1;

  const db = {
    query(tableName: string) {
      const rows = tableName === "drivers" ? drivers : [];
      return {
        withIndex(
          _indexName: string,
          buildFilter: (query: {
            eq: (field: string, value: unknown) => {
              field: string;
              value: unknown;
            };
          }) => { field: string; value: unknown },
        ) {
          const filter = buildFilter({
            eq: (field, value) => ({ field, value }),
          });
          return {
            collect: async () =>
              rows.filter((row) => row[filter.field] === filter.value),
          };
        },
        collect: async () => rows,
      };
    },
    async insert(_tableName: string, value: Omit<TestDriver, "_id">) {
      const id = `driver-${nextId++}`;
      drivers.push({ _id: id, ...value });
      return id;
    },
    async patch(id: string, value: Partial<TestDriver>) {
      const driver = drivers.find((candidate) => candidate._id === id);
      if (!driver) throw new Error(`Driver ${id} not found`);
      Object.assign(driver, value);
    },
  };

  return { ctx: { db }, drivers };
}

describe("SimGrid driver imports", () => {
  it("creates a driver without a car number", async () => {
    const { ctx, drivers } = createTestContext();

    const result = await (importOrUpdateDriver as any)._handler(ctx, {
      championshipId: "series-1",
      driverName: "Shane Dodger",
      username: "sierraalpha91",
      steamId: "76561198068906627",
    });

    expect(result.action).toBe("created");
    expect(drivers).toHaveLength(1);
    expect(drivers[0].driverNumber).toBeUndefined();
  });

  it("matches by Steam ID and preserves a manually assigned number", async () => {
    const { ctx, drivers } = createTestContext([
      {
        _id: "driver-1",
        championshipId: "series-1",
        driverNumber: 91,
        driverName: "Old Name",
        steamId: "76561198068906627",
      },
    ]);

    const result = await (importOrUpdateDriver as any)._handler(ctx, {
      championshipId: "series-1",
      driverName: "Shane Dodger",
      username: "sierraalpha91",
      steamId: "76561198068906627",
    });

    expect(result).toEqual({ action: "updated", driverId: "driver-1" });
    expect(drivers).toHaveLength(1);
    expect(drivers[0].driverNumber).toBe(91);
    expect(drivers[0].driverName).toBe("Shane Dodger");
  });

  it("marks numberless drivers inactive by document ID", async () => {
    const { ctx, drivers } = createTestContext([
      {
        _id: "driver-1",
        championshipId: "series-1",
        driverName: "Active Driver",
        isActive: true,
      },
      {
        _id: "driver-2",
        championshipId: "series-1",
        driverName: "Withdrawn Driver",
        isActive: true,
      },
    ]);

    const result = await (markInactiveDrivers as any)._handler(ctx, {
      championshipId: "series-1",
      activeDriverIds: ["driver-1"],
    });

    expect(result).toEqual({ markedInactive: 1 });
    expect(drivers[0].isActive).toBe(true);
    expect(drivers[1].isActive).toBe(false);
  });
});
