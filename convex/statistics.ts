import { cacheQueryDocuments } from "./lib/queryCache";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getDriverDisplayName } from "./lib/formatting";
import { getEffectiveLicensePoints } from "./lib/penalties";
import { latestReviewForCurrentTarget } from "./lib/reports";

interface EventRundownRow {
  reportId: number | null;
  driverId: string | null;
  carNumber: number | null;
  driverName: string | null;
  driverClass: string | null;
  lap: string | null;
  turn: string | null;
  incidentDescription: string;
  adjustedReason?: string;
  penaltyName: string | null;
  penaltyAllowsNoDriverAtFault: boolean;
  timePenaltySeconds: number;
  licensePoints: number | null;
  isSelfReport: boolean;
  hasTimePenaltyAdjustment: boolean;
  hasLicensePointAdjustment: boolean;
  isFinalized: boolean;
}

interface DriverTimePenaltyRow {
  driverId: string;
  carNumber: number | null;
  driverName: string;
  driverClass: string;
  totalTimePenaltySeconds: number;
}

interface RaceTimePenaltySummary {
  raceId: string;
  raceNumber: number;
  raceName: string;
  driverPenalties: DriverTimePenaltyRow[];
}

function resolveSessionName(race: { sessionName?: string; raceNumber?: number }): string {
  const explicit = race.sessionName?.trim();
  if (explicit) return explicit;
  if (typeof race.raceNumber === "number") return `Race ${race.raceNumber}`;
  return "Session";
}

function raceSortValue(race: { raceNumber?: number; sessionName?: string }): number {
  if (typeof race.raceNumber === "number" && Number.isFinite(race.raceNumber)) {
    return race.raceNumber;
  }
  return Number.MAX_SAFE_INTEGER;
}

async function getEventReportsByRace(ctx: QueryCtx, eventId: Id<"events">) {
  const reports = await ctx.db.query("reports")
    .withIndex("by_event", (q) => q.eq("eventId", eventId))
    .collect();
  const byRace = new Map<Id<"races">, Doc<"reports">[]>();
  for (const report of reports) {
    const raceReports = byRace.get(report.raceId);
    if (raceReports) raceReports.push(report);
    else byRace.set(report.raceId, [report]);
  }
  return byRace;
}

async function getSeriesPoints(
  ctx: QueryCtx,
  seriesId: Id<"series">,
  drivers: Doc<"drivers">[],
  get: ReturnType<typeof cacheQueryDocuments>,
) {
  const driverIds = new Set(drivers.map((driver) => driver._id));
  const events = await ctx.db.query("events")
    .withIndex("by_series", (q) => q.eq("seriesId", seriesId))
    .collect();
  const reportsByEvent = await Promise.all(events.map((event) =>
    ctx.db.query("reports")
      .withIndex("by_event_and_status", (q) =>
        q.eq("eventId", event._id).eq("status", "finalized"))
      .collect(),
  ));

  const points = new Map<Id<"drivers">, number>();
  for (const report of reportsByEvent.flat()) {
    const driverId = report.atFaultDriverId;
    if (report.isNoDriverAtFault || !driverId || !driverIds.has(driverId)) continue;
    const penalty = report.appliedPenalty
      ? await get(report.appliedPenalty as Id<"penalties">)
      : null;
    const earned = getEffectiveLicensePoints(penalty, report.isSelfReport);
    points.set(driverId, (points.get(driverId) ?? 0) + earned);
  }
  return points;
}

export const getEventRundown = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const get = cacheQueryDocuments(ctx.db);
    const event = await get(args.eventId);
    if (!event) {
      return [];
    }

    const races = await ctx.db
      .query("races")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    races.sort((a, b) => raceSortValue(a) - raceSortValue(b));

    const reportsByRace = await getEventReportsByRace(ctx, args.eventId);
    const rundown = await Promise.all(
      races.map(async (race) => {
        const raceReports = reportsByRace.get(race._id) ?? [];

        const eventRundownRows = await Promise.all(
          raceReports.map(async (report) => {
            if (report.status !== "finalized" && report.status !== "reviewed") {
              return null;
            }

            let review: Doc<"reviews"> | null | undefined = null;
            if (report.status === "reviewed") {
              const reviews = await ctx.db
                .query("reviews")
                .withIndex("by_report", (q) => q.eq("reportId", report._id))
                .collect();

              review = latestReviewForCurrentTarget(reviews, report);

              if (!review?.recommendedPenalty) {
                return null;
              }
            }

            const isNoDriverAtFault =
              report.status === "reviewed"
                ? Boolean(review?.isNoDriverAtFault)
                : Boolean(report.isNoDriverAtFault);

            const atFaultDriverId = isNoDriverAtFault
              ? null
              : report.atFaultDriverId;
            const reportedDriver = atFaultDriverId
              ? await get(atFaultDriverId)
              : null;

            // Skip reports where the driver doesn't belong to this event's series
            // This includes cases where:
            // 1. Driver doesn't exist
            // 2. Driver has no championship assigned
            // 3. Driver belongs to a different series than the event
            if (
              reportedDriver &&
              (!reportedDriver.championshipId ||
                reportedDriver.championshipId !== event.seriesId)
            ) {
              return null;
            }

            // Get display name with priority: user.officialName > driver.officialName > driver.driverName
            let userOfficialName: string | undefined;
            if (reportedDriver?.userId) {
              const user = await get(reportedDriver.userId);
              userOfficialName = user?.officialName;
            }
            const displayName = reportedDriver
              ? getDriverDisplayName(
                  { driverName: reportedDriver.driverName, officialName: reportedDriver.officialName },
                  userOfficialName ? { officialName: userOfficialName } : undefined
                )
              : null;

            let appliedPenalty: Doc<"penalties"> | null = null;
            let recommendedPenaltyObj: Doc<"penalties"> | null = null;

            if (report.status === "finalized" && report.appliedPenalty) {
              appliedPenalty = await get(report.appliedPenalty as Id<"penalties">);
            }

            if (report.status === "reviewed" && review?.recommendedPenalty) {
              recommendedPenaltyObj = await get(
                review.recommendedPenalty as Id<"penalties">,
              );
            }

            let penaltyName: string | null = null;
            let timePenaltySeconds = 0;
            let licensePoints: number | null = null;
            let hasTimePenaltyAdjustment = false;
            let hasLicensePointAdjustment = false;

            const lapNumber = parseInt(report.lap || "0", 10);
            const isLap1 = !isNaN(lapNumber) && lapNumber === 1;

            if (report.status === "finalized") {
              penaltyName = appliedPenalty?.name ?? null;
              const baseTimePenalty = isLap1
                ? (appliedPenalty?.timePenaltyLap1 ?? appliedPenalty?.timePenalty ?? 0)
                : (appliedPenalty?.timePenalty ?? 0);
              const selfReportReduction =
                appliedPenalty?.selfReportReduction ?? 0;
              const selfReportLicensePointReduction =
                appliedPenalty?.selfReportLicensePointReduction ?? 0;
              hasTimePenaltyAdjustment =
                Boolean(report.isSelfReport) && selfReportReduction > 0;
              hasLicensePointAdjustment =
                Boolean(report.isSelfReport) &&
                selfReportLicensePointReduction > 0;
              timePenaltySeconds =
                appliedPenalty && hasTimePenaltyAdjustment
                  ? Math.max(0, baseTimePenalty - selfReportReduction)
                  : baseTimePenalty;
              licensePoints = appliedPenalty
                ? getEffectiveLicensePoints(appliedPenalty, report.isSelfReport)
                : null;
            } else {
              penaltyName = recommendedPenaltyObj?.name ?? null;
              const baseTimePenalty = isLap1
                ? (recommendedPenaltyObj?.timePenaltyLap1 ?? recommendedPenaltyObj?.timePenalty ?? 0)
                : (recommendedPenaltyObj?.timePenalty ?? 0);
              const selfReportReduction =
                recommendedPenaltyObj?.selfReportReduction ?? 0;
              const selfReportLicensePointReduction =
                recommendedPenaltyObj?.selfReportLicensePointReduction ?? 0;
              hasTimePenaltyAdjustment =
                Boolean(report.isSelfReport) && selfReportReduction > 0;
              hasLicensePointAdjustment =
                Boolean(report.isSelfReport) &&
                selfReportLicensePointReduction > 0;
              timePenaltySeconds =
                recommendedPenaltyObj && hasTimePenaltyAdjustment
                  ? Math.max(0, baseTimePenalty - selfReportReduction)
                  : baseTimePenalty;
              licensePoints = recommendedPenaltyObj
                ? getEffectiveLicensePoints(
                  recommendedPenaltyObj,
                  report.isSelfReport,
                )
                : null;
            }

            let incidentDescription: string;
            if (report.status === "finalized") {
              incidentDescription = report.finalDecision ?? "";
            } else {
              incidentDescription = review?.incidentDescription ?? "";
            }

            // Get driver class display name
            let driverClassDisplayName: string | null = null;
            if (reportedDriver?.driverClassId) {
              const driverClass = await get(reportedDriver.driverClassId);
              driverClassDisplayName = driverClass?.displayName ?? null;
            }

            return {
              reportId: report.reportId || null,
              driverId: atFaultDriverId ?? null,
              carNumber: reportedDriver?.driverNumber ?? null,
              driverName: displayName,
              driverClass: driverClassDisplayName,
              lap: report.lap ?? null,
              turn: report.turn ?? null,
              incidentDescription,
              adjustedReason: review?.isAdjusted ? review.adjustedReason : undefined,
              penaltyName,
              penaltyAllowsNoDriverAtFault:
                report.status === "finalized"
                  ? Boolean(appliedPenalty?.allowNoDriverAtFault)
                  : Boolean(recommendedPenaltyObj?.allowNoDriverAtFault),
              timePenaltySeconds,
              licensePoints,
              isSelfReport: report.isSelfReport ?? false,
              hasTimePenaltyAdjustment,
              hasLicensePointAdjustment,
              isFinalized: report.status === "finalized",
            };
          }),
        );

        const validRows = eventRundownRows.filter((row) => row !== null);

        return {
          raceId: race._id,
          raceNumber: raceSortValue(race),
          raceName: resolveSessionName(race),
          reports: validRows as EventRundownRow[],
        };
      }),
    );

    return rundown;
  },
});

/**
 * Debug function to identify driver mismatches in Event Rundown.
 *
 * Use this to investigate cases where a driver appears to be
 * pulling in data from the wrong event/series.
 */
export const debugEventRundownDriverMismatches = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const get = cacheQueryDocuments(ctx.db);
    const event = await get(args.eventId);
    if (!event) {
      return { error: "Event not found" };
    }

    const races = await ctx.db
      .query("races")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    const eventSeriesId = event.seriesId;
    const driversInSeries = await ctx.db
      .query("drivers")
      .withIndex("by_championship", (q) => q.eq("championshipId", eventSeriesId))
      .collect();

    const mismatches: any[] = [];
    const correct: any[] = [];

    const reportsByRace = await getEventReportsByRace(ctx, args.eventId);
    for (const race of races) {
      const raceReports = reportsByRace.get(race._id) ?? [];

      for (const report of raceReports) {
        if (report.status !== "finalized" && report.status !== "reviewed") {
          continue;
        }

        const atFaultDriverId = report.atFaultDriverId;
        if (!atFaultDriverId) {
          continue;
        }
        const driver = await get(atFaultDriverId);

        if (!driver) {
          continue;
        }

        const isMismatch = driver.championshipId !== eventSeriesId;

        // Get driver class display name for debug
        let driverClassDisplayName = "N/A";
        if (driver.driverClassId) {
          const driverClass = await get(driver.driverClassId);
          driverClassDisplayName = driverClass?.displayName || "N/A";
        }

        const entry = {
          reportId: report._id.toString(),
          reportStatus: report.status,
          driverId: driver._id.toString(),
          driverName: driver.driverName,
          driverClass: driverClassDisplayName,
          driverChampionshipId: driver.championshipId?.toString() || "None",
          eventSeriesId: eventSeriesId.toString(),
          eventId: args.eventId.toString(),
          eventSeriesName: (await get(eventSeriesId))?.name ?? "Unknown",
          raceNumber: race.raceNumber,
          reason: isMismatch
            ? "Driver belongs to different series than event"
            : "Correct",
        };

        if (isMismatch) {
          mismatches.push(entry);
        } else {
          correct.push(entry);
        }
      }
    }

    // Build drivers in series with class display names
    const driversInSeriesWithClass = await Promise.all(
      driversInSeries.map(async (d) => {
        const driverClass = d.driverClassId ? await get(d.driverClassId) : null;
        return {
          driverId: d._id.toString(),
          driverName: d.driverName,
          driverClass: driverClass?.displayName || "N/A",
          championshipId: d.championshipId?.toString() || "None",
        };
      })
    );

    return {
      eventId: args.eventId.toString(),
      eventName: event.trackName,
      eventSeriesId: eventSeriesId.toString(),
      driversInSeries: driversInSeriesWithClass,
      mismatches,
      correct,
      totalReportsInEvent: correct.length + mismatches.length,
      mismatchCount: mismatches.length,
      correctCount: correct.length,
    };
  },
});

export const getSeriesLicensePoints = query({
  args: { seriesId: v.id("series") },
  handler: async (ctx, args) => {
    const get = cacheQueryDocuments(ctx.db);
    const drivers = await ctx.db
      .query("drivers")
      .withIndex("by_championship", (q) =>
        q.eq("championshipId", args.seriesId),
      )
      .collect();

    const pointsByDriver = await getSeriesPoints(ctx, args.seriesId, drivers, get);

    const driverPoints = await Promise.all(
      drivers.map(async (driver) => {
        // Get display name with priority: user.officialName > driver.officialName > driver.driverName
        let userOfficialName: string | undefined;
        if (driver.userId) {
          const user = await get(driver.userId);
          userOfficialName = user?.officialName;
        }
        const displayName = getDriverDisplayName(
          { driverName: driver.driverName, officialName: driver.officialName },
          userOfficialName ? { officialName: userOfficialName } : undefined
        );

        return {
          driverId: driver._id,
          driverNumber: driver.driverNumber,
          driverName: displayName,
          totalLicensePoints: pointsByDriver.get(driver._id) ?? 0,
        };
      })
    );

    driverPoints.sort((a, b) => b.totalLicensePoints - a.totalLicensePoints);

    return driverPoints;
  },
});

export const getSeriesLicensePointsWithPenalties = query({
  args: { seriesId: v.id("series") },
  handler: async (ctx, args) => {
    const get = cacheQueryDocuments(ctx.db);
    const drivers = await ctx.db
      .query("drivers")
      .withIndex("by_championship", (q) =>
        q.eq("championshipId", args.seriesId),
      )
      .collect();

    const pointsByDriver = await getSeriesPoints(ctx, args.seriesId, drivers, get);

    const allSeriesPenalties = await ctx.db
      .query("seriesPenalties")
      .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId))
      .collect();

    const seriesPenaltiesWithThresholds = await Promise.all(
      allSeriesPenalties.map(async (sp) => {
        const thresholds = await ctx.db
          .query("seriesPenaltyThresholds")
          .withIndex("by_series_penalty", (q) =>
            q.eq("seriesPenaltyId", sp._id),
          )
          .collect();

        return {
          ...sp,
          thresholds,
        };
      }),
    );

    const assignedPenalties = await ctx.db.query("driverSeriesPenalties")
      .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId))
      .collect();
    const penaltiesByDriver = new Map<Id<"drivers">, Doc<"driverSeriesPenalties">[]>();
    for (const penalty of assignedPenalties) {
      const assigned = penaltiesByDriver.get(penalty.driverId);
      if (assigned) assigned.push(penalty);
      else penaltiesByDriver.set(penalty.driverId, [penalty]);
    }

    const seriesPenaltiesById = new Map(allSeriesPenalties.map((penalty) => [penalty._id, penalty]));
    const thresholdsById = new Map(seriesPenaltiesWithThresholds
      .flatMap(({ thresholds }) => thresholds.map((threshold) => [threshold._id, threshold] as const)));

    const driverPointsWithPenalties = await Promise.all(
      drivers.map(async (driver) => {
        const totalPoints = pointsByDriver.get(driver._id) ?? 0;

        // Get display name with priority: user.officialName > driver.officialName > driver.driverName
        let userOfficialName: string | undefined;
        if (driver.userId) {
          const user = await get(driver.userId);
          userOfficialName = user?.officialName;
        }
        const displayName = getDriverDisplayName(
          { driverName: driver.driverName, officialName: driver.officialName },
          userOfficialName ? { officialName: userOfficialName } : undefined
        );

        const allDriverSeriesPenalties = penaltiesByDriver.get(driver._id) ?? [];

        const driverSeriesPenaltiesWithDetails = await Promise.all(
          allDriverSeriesPenalties.map(async (dsp) => {
            const seriesPenalty = seriesPenaltiesById.get(dsp.seriesPenaltyId) ?? await get(dsp.seriesPenaltyId);
            const seriesPenaltyThreshold = thresholdsById.get(dsp.seriesPenaltyThresholdId) ??
              await get(dsp.seriesPenaltyThresholdId);
            const servedByUser = dsp.servedBy
              ? await get(dsp.servedBy)
              : null;

            return {
              ...dsp,
              seriesPenalty,
              seriesPenaltyThreshold,
              servedByUser,
            };
          }),
        );

        const eligibleSeriesPenalties: any[] = [];

        for (const sp of seriesPenaltiesWithThresholds) {
          for (const threshold of sp.thresholds) {
            const appliesToDriver = driver.driverClassId && threshold.driverClassIds.includes(driver.driverClassId);

            if (appliesToDriver && totalPoints >= threshold.threshold) {
              const alreadyAssigned = allDriverSeriesPenalties.some(
                (dsp) =>
                  dsp.seriesPenaltyId === sp._id &&
                  dsp.seriesPenaltyThresholdId === threshold._id,
              );

              if (!alreadyAssigned) {
                // Look up driver class display names for the threshold
                const driverClassDisplayNames = await Promise.all(
                  threshold.driverClassIds.map(async (id) => {
                    const dc = await get(id);
                    return dc?.displayName || "Unknown";
                  })
                );
                eligibleSeriesPenalties.push({
                  seriesPenaltyId: sp._id,
                  penaltyName: sp.penaltyName,
                  penaltyDescription: sp.penaltyDescription,
                  driverClasses: driverClassDisplayNames,
                  threshold: threshold.threshold,
                  seriesPenaltyThresholdId: threshold._id,
                  isAssigned: false,
                });
              }
            }
          }
        }

        // Get driver class display name for the result
        const driverClassResult = driver.driverClassId ? await get(driver.driverClassId) : null;

        return {
          driverId: driver._id,
          driverNumber: driver.driverNumber,
          driverName: displayName,
          driverClass: driverClassResult?.displayName || "",
          totalLicensePoints: totalPoints,
          seriesPenalties: driverSeriesPenaltiesWithDetails,
          eligibleSeriesPenalties,
        };
      }),
    );

    driverPointsWithPenalties.sort(
      (a, b) => b.totalLicensePoints - a.totalLicensePoints,
    );

    return driverPointsWithPenalties;
  },
});

/**
 * Debug function to identify driver series mismatches in statistics.
 *
 * Use this to investigate cases where a driver appears to be
 * pulling in data from the wrong series.
 */
export const debugSeriesDriverMismatches = query({
  args: { seriesId: v.id("series") },
  handler: async (ctx, args) => {
    const get = cacheQueryDocuments(ctx.db);
    const drivers = await ctx.db
      .query("drivers")
      .withIndex("by_championship", (q) =>
        q.eq("championshipId", args.seriesId),
      )
      .collect();

    const allDriverSeriesPenalties = await ctx.db
      .query("driverSeriesPenalties")
      .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId))
      .collect();

    const mismatches: any[] = [];
    const correct: any[] = [];

    for (const dsp of allDriverSeriesPenalties) {
      const driver = await get(dsp.driverId);
      const seriesPenalty = await get(dsp.seriesPenaltyId);

      const isMismatch = !driver || driver.championshipId !== args.seriesId;

      // Get driver class display name
      const driverClassDbg = driver?.driverClassId ? await get(driver.driverClassId) : null;

      const entry = {
        driverSeriesPenaltyId: dsp._id.toString(),
        driverId: dsp.driverId.toString(),
        driverName: driver?.driverName || "Driver not found",
        driverClass: driverClassDbg?.displayName || "N/A",
        driverChampionshipId: driver?.championshipId?.toString() || "None",
        seriesId: dsp.seriesId.toString(),
        penaltyName: seriesPenalty?.penaltyName || "Unknown",
        isServed: dsp.isServed,
        reason: isMismatch
          ? !driver
            ? "Driver not found"
            : "Driver championship does not match series"
          : "Correct",
      };

      if (isMismatch) {
        mismatches.push(entry);
      } else {
        correct.push(entry);
      }
    }

    // Build drivers in series with class display names
    const driversInSeriesWithClass = await Promise.all(
      drivers.map(async (d) => {
        const driverClass = d.driverClassId ? await get(d.driverClassId) : null;
        return {
          driverId: d._id.toString(),
          driverName: d.driverName,
          driverClass: driverClass?.displayName || "N/A",
          championshipId: d.championshipId?.toString() || "None",
        };
      })
    );

    return {
      querySeriesId: args.seriesId.toString(),
      driversInSeries: driversInSeriesWithClass,
      mismatches,
      correct,
      totalDriverSeriesPenalties: allDriverSeriesPenalties.length,
      mismatchCount: mismatches.length,
      correctCount: correct.length,
    };
  },
});

export const getEventTimePenaltySummary = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const get = cacheQueryDocuments(ctx.db);
    const event = await get(args.eventId);
    if (!event) {
      return [];
    }

    const races = await ctx.db
      .query("races")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    races.sort((a, b) => raceSortValue(a) - raceSortValue(b));

    const reportsByRace = await getEventReportsByRace(ctx, args.eventId);
    const timePenaltySummary = await Promise.all(
      races.map(async (race) => {
        const raceReports = reportsByRace.get(race._id) ?? [];

        const finalizedReports = raceReports.filter((r) => r.status === "finalized");

        const driverPenaltyMap = new Map<string, {
          driverId: string;
          carNumber: number | null;
          driverName: string;
          driverClass: string;
          totalTimePenaltySeconds: number;
        }>();

        for (const report of finalizedReports) {
          if (report.isNoDriverAtFault) {
            continue;
          }

          const atFaultDriverId = report.atFaultDriverId;
          if (!atFaultDriverId) {
            continue;
          }
          const reportedDriver = await get(atFaultDriverId);

          if (
            reportedDriver &&
            (!reportedDriver.championshipId ||
              reportedDriver.championshipId !== event.seriesId)
          ) {
            continue;
          }

          let appliedPenalty: Doc<"penalties"> | null = null;
          if (report.appliedPenalty) {
            appliedPenalty = await get(report.appliedPenalty as Id<"penalties">);
          }

          if (!appliedPenalty) {
            continue;
          }

          const lapNumber = parseInt(report.lap || "0", 10);
          const isLap1 = !isNaN(lapNumber) && lapNumber === 1;

          const baseTimePenalty = isLap1
            ? (appliedPenalty.timePenaltyLap1 ?? appliedPenalty.timePenalty ?? 0)
            : (appliedPenalty.timePenalty ?? 0);
          const selfReportReduction = appliedPenalty.selfReportReduction ?? 0;
          const timePenaltySeconds =
            appliedPenalty && report.isSelfReport
              ? Math.max(0, baseTimePenalty - selfReportReduction)
              : baseTimePenalty;

          let userOfficialName: string | undefined;
          if (reportedDriver?.userId) {
            const user = await get(reportedDriver.userId);
            userOfficialName = user?.officialName;
          }
          const displayName = reportedDriver
            ? getDriverDisplayName(
                { driverName: reportedDriver.driverName, officialName: reportedDriver.officialName },
                userOfficialName ? { officialName: userOfficialName } : undefined
              )
            : null;

          let driverClassDisplayName: string | null = null;
          if (reportedDriver?.driverClassId) {
            const driverClass = await get(reportedDriver.driverClassId);
            driverClassDisplayName = driverClass?.displayName ?? null;
          }

          const driverId = atFaultDriverId.toString();
          const existing = driverPenaltyMap.get(driverId);

          if (existing) {
            existing.totalTimePenaltySeconds += timePenaltySeconds;
          } else {
            driverPenaltyMap.set(driverId, {
              driverId,
              carNumber: reportedDriver?.driverNumber ?? null,
              driverName: displayName || "",
              driverClass: driverClassDisplayName || "",
              totalTimePenaltySeconds: timePenaltySeconds,
            });
          }
        }

        const driverPenalties = Array.from(driverPenaltyMap.values()).filter(
          (driver) => driver.totalTimePenaltySeconds > 0,
        );

        driverPenalties.sort((a, b) => a.driverName.localeCompare(b.driverName));

        return {
          raceId: race._id,
          raceNumber: raceSortValue(race),
          raceName: resolveSessionName(race),
          driverPenalties,
        };
      }),
    );

    return timePenaltySummary;
  },
});
