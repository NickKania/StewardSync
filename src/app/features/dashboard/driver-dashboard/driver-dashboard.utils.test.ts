import { describe, expect, it } from "bun:test";
import {
  extractSeasonNumber,
  getLatestEventDate,
  getSeriesCreatedTimestamp,
  sortDriverDashboardSeriesGroups,
} from "./driver-dashboard.utils";

describe("driver dashboard series ordering", () => {
  it("orders newest seasons first and oldest seasons at the bottom by latest event date", () => {
    const groups = [
      {
        seriesId: "s12",
        seriesName: "Season 12",
        seriesLastEventDate: 1_700_000_000_000,
        seriesCreatedAt: 1_699_000_000_000,
      },
      {
        seriesId: "s13",
        seriesName: "S13",
        seriesLastEventDate: 1_710_000_000_000,
        seriesCreatedAt: 1_709_000_000_000,
      },
      {
        seriesId: "s14",
        seriesName: "S14",
        seriesLastEventDate: 1_720_000_000_000,
        seriesCreatedAt: 1_719_000_000_000,
      },
    ];

    const sorted = sortDriverDashboardSeriesGroups(groups);

    expect(sorted.map((g) => g.seriesName)).toEqual([
      "S14",
      "S13",
      "Season 12",
    ]);
  });

  it("keeps newer seasons above a backfilled older season even if the older season was created later", () => {
    const groups = [
      {
        seriesId: "s12",
        seriesName: "Season 12",
        seriesLastEventDate: 1_700_000_000_000,
        seriesCreatedAt: 1_750_000_000_000,
      },
      {
        seriesId: "s14",
        seriesName: "S14",
        seriesLastEventDate: 1_720_000_000_000,
        seriesCreatedAt: 1_715_000_000_000,
      },
    ];

    const sorted = sortDriverDashboardSeriesGroups(groups);

    expect(sorted.map((g) => g.seriesName)).toEqual(["S14", "Season 12"]);
  });

  it("falls back to createdAt for upcoming seasons with no events yet", () => {
    const groups = [
      {
        seriesId: "s13",
        seriesName: "S13",
        seriesLastEventDate: 1_710_000_000_000,
        seriesCreatedAt: 1_709_000_000_000,
      },
      {
        seriesId: "s14",
        seriesName: "S14",
        seriesLastEventDate: 1_720_000_000_000,
        seriesCreatedAt: 1_719_000_000_000,
      },
      {
        seriesId: "s15",
        seriesName: "S15",
        seriesLastEventDate: null,
        seriesCreatedAt: 1_730_000_000_000,
      },
    ];

    const sorted = sortDriverDashboardSeriesGroups(groups);

    expect(sorted.map((g) => g.seriesName)).toEqual(["S15", "S14", "S13"]);
  });

  it("places unknown or missing series at the bottom", () => {
    const groups = [
      {
        seriesId: null,
        seriesName: "Unknown Series",
        seriesLastEventDate: null,
        seriesCreatedAt: null,
      },
      {
        seriesId: "s12",
        seriesName: "Season 12",
        seriesLastEventDate: 1_700_000_000_000,
        seriesCreatedAt: 1_699_000_000_000,
      },
      {
        seriesId: "missing",
        seriesName: "Unknown Series",
        seriesLastEventDate: null,
        seriesCreatedAt: null,
      },
      {
        seriesId: "s14",
        seriesName: "Season 14",
        seriesLastEventDate: 1_720_000_000_000,
        seriesCreatedAt: 1_719_000_000_000,
      },
    ];

    const sorted = sortDriverDashboardSeriesGroups(groups);

    expect(sorted.map((g) => g.seriesId)).toEqual([
      "s14",
      "s12",
      "missing",
      null,
    ]);
  });

  it("breaks equal timestamp ties using normalized season numbers for mixed labels", () => {
    const sameTimestamp = 1_720_000_000_000;
    const groups = [
      {
        seriesId: "s12",
        seriesName: "Season 12",
        seriesLastEventDate: sameTimestamp,
        seriesCreatedAt: sameTimestamp,
      },
      {
        seriesId: "s13",
        seriesName: "S13",
        seriesLastEventDate: sameTimestamp,
        seriesCreatedAt: sameTimestamp,
      },
      {
        seriesId: "s14",
        seriesName: "S14",
        seriesLastEventDate: sameTimestamp,
        seriesCreatedAt: sameTimestamp,
      },
      {
        seriesId: "s9",
        seriesName: "Season 9",
        seriesLastEventDate: sameTimestamp,
        seriesCreatedAt: sameTimestamp,
      },
      {
        seriesId: "s10",
        seriesName: "Season 10",
        seriesLastEventDate: sameTimestamp,
        seriesCreatedAt: sameTimestamp,
      },
    ];

    const sorted = sortDriverDashboardSeriesGroups(groups);

    expect(sorted.map((g) => g.seriesName)).toEqual([
      "S14",
      "S13",
      "Season 12",
      "Season 10",
      "Season 9",
    ]);
  });

  it("orders numbered and unnumbered series consistently across all permutations when timestamps tie", () => {
    const sameTimestamp = 1_720_000_000_000;
    const s10 = {
      seriesId: "s10",
      seriesName: "S10",
      seriesLastEventDate: sameTimestamp,
      seriesCreatedAt: sameTimestamp,
    };
    const season2 = {
      seriesId: "s2",
      seriesName: "Season 2",
      seriesLastEventDate: sameTimestamp,
      seriesCreatedAt: sameTimestamp,
    };
    const scCup = {
      seriesId: "sc",
      seriesName: "SC Cup",
      seriesLastEventDate: sameTimestamp,
      seriesCreatedAt: sameTimestamp,
    };

    const permutations = [
      [s10, season2, scCup],
      [s10, scCup, season2],
      [season2, s10, scCup],
      [season2, scCup, s10],
      [scCup, s10, season2],
      [scCup, season2, s10],
    ];

    for (const input of permutations) {
      expect(
        sortDriverDashboardSeriesGroups(input).map((g) => g.seriesName),
      ).toEqual(["S10", "Season 2", "SC Cup"]);
    }
  });

  it("deterministically breaks ties by seriesId when timestamps and names match", () => {
    const groupsA = [
      {
        seriesId: "series_b",
        seriesName: "Unknown Series",
        seriesLastEventDate: null,
        seriesCreatedAt: null,
      },
      {
        seriesId: "series_a",
        seriesName: "Unknown Series",
        seriesLastEventDate: null,
        seriesCreatedAt: null,
      },
    ];
    const groupsB = [groupsA[1], groupsA[0]];

    expect(sortDriverDashboardSeriesGroups(groupsA).map((g) => g.seriesId)).toEqual([
      "series_a",
      "series_b",
    ]);
    expect(sortDriverDashboardSeriesGroups(groupsB).map((g) => g.seriesId)).toEqual([
      "series_a",
      "series_b",
    ]);
  });

  it("handles empty and single-element arrays without mutating input", () => {
    expect(sortDriverDashboardSeriesGroups([])).toEqual([]);

    const single = [
      {
        seriesId: "s14",
        seriesName: "S14",
        seriesLastEventDate: 300,
        seriesCreatedAt: 200,
      },
    ];
    expect(sortDriverDashboardSeriesGroups(single)).toEqual(single);

    const groups = [
      {
        seriesId: "s12",
        seriesName: "Season 12",
        seriesLastEventDate: 100,
        seriesCreatedAt: 100,
      },
      {
        seriesId: "s14",
        seriesName: "Season 14",
        seriesLastEventDate: 300,
        seriesCreatedAt: 300,
      },
    ];

    const sorted = sortDriverDashboardSeriesGroups(groups);

    expect(groups.map((g) => g.seriesId)).toEqual(["s12", "s14"]);
    expect(sorted.map((g) => g.seriesId)).toEqual(["s14", "s12"]);
  });

  it("extracts createdAt with fallback to _creationTime and rejects non-finite values", () => {
    expect(
      getSeriesCreatedTimestamp({ createdAt: 200, _creationTime: 100 }),
    ).toBe(200);
    expect(
      getSeriesCreatedTimestamp({ createdAt: Number.NaN, _creationTime: 150 }),
    ).toBe(150);
    expect(
      getSeriesCreatedTimestamp({
        createdAt: Number.POSITIVE_INFINITY,
        _creationTime: 175,
      }),
    ).toBe(175);
    expect(getSeriesCreatedTimestamp({ createdAt: 0 })).toBe(0);
    expect(getSeriesCreatedTimestamp({ _creationTime: 150 })).toBe(150);
    expect(getSeriesCreatedTimestamp(null)).toBeNull();
    expect(getSeriesCreatedTimestamp(undefined)).toBeNull();
    expect(getSeriesCreatedTimestamp({})).toBeNull();
  });

  it("extracts the latest finite event date from series events", () => {
    expect(getLatestEventDate([])).toBeNull();
    expect(getLatestEventDate(null)).toBeNull();
    expect(getLatestEventDate([{ eventDate: Number.NaN }])).toBeNull();
    expect(
      getLatestEventDate([
        { eventDate: 100 },
        { eventDate: 300 },
        { eventDate: 200 },
        { eventDate: Number.POSITIVE_INFINITY },
      ]),
    ).toBe(300);
  });

  it("extracts season numbers from Season N and SN formats", () => {
    expect(extractSeasonNumber("Season 12")).toBe(12);
    expect(extractSeasonNumber("GT3 S14")).toBe(14);
    expect(extractSeasonNumber("ACC Season 9 Sprint")).toBe(9);
    expect(extractSeasonNumber("Endurance Cup")).toBeNull();
  });
});
