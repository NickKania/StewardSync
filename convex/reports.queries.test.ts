import { expect, it, mock } from "bun:test";
import { getQueueCounts, list } from "./reports";
import { getEventRundown } from "./statistics";

const report = { _id: "report", eventId: "event", raceId: "race", status: "pending",
  reportingDriverId: "driver", reportedDriverId: "driver", atFaultDriverId: "driver" };

it("uses the compound index and limits reports before hydrating shared documents", async () => {
  const range = { eq: mock((_field: string, _value: string) => range) };
  const take = mock(async () => [report, { ...report, _id: "report2" }]);
  const withIndex = mock((index: string, bound: (q: typeof range) => unknown) => {
    bound(range);
    return { order: () => ({ take }) };
  });
  const get = mock(async (id: string) => id === "driver" ? { _id: id } : null);
  const query = mock((_table: string) => ({ withIndex }));
  const result = await (list as any)._handler({ db: { query, get } }, {
    eventId: "event", status: "pending", limit: 2,
  });

  expect(withIndex.mock.calls[0][0]).toBe("by_event_and_status");
  expect(range.eq.mock.calls).toEqual([["eventId", "event"], ["status", "pending"]]);
  expect(take).toHaveBeenCalledWith(2);
  expect(query.mock.calls).toEqual([["reports"]]);
  expect(get.mock.calls).toEqual([["driver"], ["event"], ["race"]]);
  expect(result).toHaveLength(2);
});

it("counts each queue using a status index range", async () => {
  const eq = mock((_field: string, status: string) => status);
  const withIndex = mock((_index: string, bound: (q: { eq: typeof eq }) => unknown) => ({
    collect: async () => bound({ eq }) === "pending" ? [report, report] : [report],
  }));
  const result = await (getQueueCounts as any)._handler({
    db: { query: () => ({ withIndex }) },
  }, {});

  expect(withIndex.mock.calls.map(([index]) => index)).toEqual(["by_status", "by_status"]);
  expect(eq.mock.calls).toEqual([["status", "pending"], ["status", "reviewed"]]);
  expect(result).toEqual({ pending: 2, readyForFinalization: 1 });
});

it("reads event reports once and keeps each rundown row with its race", async () => {
  const query = mock((table: string) => ({
    withIndex: () => ({
      collect: async () => table === "races"
        ? [{ _id: "otherRace", raceNumber: 2 }, { _id: "race", raceNumber: 1 }]
        : [{ ...report, status: "finalized", isNoDriverAtFault: true, reportId: 7 }],
    }),
  }));
  const result = await (getEventRundown as any)._handler({
    db: { get: async () => ({ _id: "event" }), query },
  }, { eventId: "event" });

  expect(query.mock.calls).toEqual([["races"], ["reports"]]);
  expect(result.map((race: { reports: { reportId: number }[] }) =>
    race.reports.map((row) => row.reportId))).toEqual([[7], []]);
});
