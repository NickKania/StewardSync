import { getReportingWindow } from "./reporting-window";

describe("getReportingWindow", () => {
  it("uses the event UTC date instead of the viewer's local date", () => {
    const { openTime, closeTime } = getReportingWindow(
      "2026-03-10T00:30:00.000Z",
      "02:00",
      24,
    );

    expect(openTime.toISOString()).toBe("2026-03-10T02:00:00.000Z");
    expect(closeTime.toISOString()).toBe("2026-03-11T02:00:00.000Z");
  });

  it("adds the close duration as elapsed hours", () => {
    const { closeTime } = getReportingWindow(
      "2026-03-10T12:00:00.000Z",
      "14:00",
      24,
    );

    expect(closeTime.toISOString()).toBe("2026-03-11T14:00:00.000Z");
  });
});
