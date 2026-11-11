import { describe, expect, it } from "bun:test";
import {
  validateAtFaultDriverForReport,
  validateReportedDriverForReport,
} from "./reportValidation";

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

describe("validateReportedDriverForReport", () => {
  it("allows omitting the reported driver (no change)", async () => {
    const ctx = createCtx({});

    await expect(
      validateReportedDriverForReport(
        ctx,
        { eventId: "event1" as any, reportingDriverId: undefined },
        undefined,
      ),
    ).resolves.toBeNull();
  });

  it("allows drivers from the report event series", async () => {
    const ctx = createCtx({
      event1: { _id: "event1", seriesId: "series1" },
      driver1: { _id: "driver1", championshipId: "series1" },
    });

    await expect(
      validateReportedDriverForReport(
        ctx,
        { eventId: "event1" as any, reportingDriverId: "driver2" as any },
        "driver1" as any,
      ),
    ).resolves.toBeNull();
  });

  it("rejects unknown drivers", async () => {
    const ctx = createCtx({
      event1: { _id: "event1", seriesId: "series1" },
    });

    await expect(
      validateReportedDriverForReport(
        ctx,
        { eventId: "event1" as any, reportingDriverId: undefined },
        "missing" as any,
      ),
    ).resolves.toBe("Reported driver not found");
  });

  it("rejects the reporting driver as the reported driver", async () => {
    const ctx = createCtx({
      event1: { _id: "event1", seriesId: "series1" },
      driver1: { _id: "driver1", championshipId: "series1" },
    });

    await expect(
      validateReportedDriverForReport(
        ctx,
        { eventId: "event1" as any, reportingDriverId: "driver1" as any },
        "driver1" as any,
      ),
    ).resolves.toBe("Reporting and reported driver cannot be the same");
  });

  it("rejects drivers from another series", async () => {
    const ctx = createCtx({
      event1: { _id: "event1", seriesId: "series1" },
      driver1: { _id: "driver1", championshipId: "series2" },
    });

    await expect(
      validateReportedDriverForReport(
        ctx,
        { eventId: "event1" as any, reportingDriverId: undefined },
        "driver1" as any,
      ),
    ).resolves.toBe("Reported driver must belong to the report event's series");
  });
});
