import { describe, expect, it } from "bun:test";
import { validateAtFaultDriverForReport } from "./reportValidation";

const createCtx = (docs: Record<string, any>) => ({
  db: {
    get: async (id: string) => docs[id] ?? null,
  },
});

describe("validateAtFaultDriverForReport", () => {
  it("allows drivers from the report event series", async () => {
    const ctx = createCtx({
      event1: { _id: "event1", seriesId: "series1" },
      driver1: { _id: "driver1", championshipId: "series1" },
    });

    await expect(
      validateAtFaultDriverForReport(
        ctx,
        { eventId: "event1" as any },
        "driver1" as any,
      ),
    ).resolves.toBeNull();
  });

  it("rejects drivers from another series", async () => {
    const ctx = createCtx({
      event1: { _id: "event1", seriesId: "series1" },
      driver1: { _id: "driver1", championshipId: "series2" },
    });

    await expect(
      validateAtFaultDriverForReport(
        ctx,
        { eventId: "event1" as any },
        "driver1" as any,
      ),
    ).resolves.toBe("At-fault driver must belong to the report event's series");
  });
});
