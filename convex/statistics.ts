import { query } from "./_generated/server";
import { v } from "convex/values";
import { getDriverDisplayName } from "./lib/formatting";

interface EventRundownRow {
  reportId: number | null;
  driverId: string;
  carNumber: number | null;
  driverName: string | null;
  driverClass: string | null;
  lap: string | null;
  turn: string | null;
  incidentDescription: string;
  adjustedReason?: string;
  penaltyName: string | null;
  timePenaltySeconds: number;
  licensePoints: number | null;
  isSelfReport: boolean;
  isFinalized: boolean;
}

export const getEventRundown = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) {
      return [];
    }

    const races = await ctx.db
      .query("races")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    races.sort((a, b) => a.raceNumber - b.raceNumber);

    const rundown = await Promise.all(
      races.map(async (race) => {
        const reports = await ctx.db
          .query("reports")
          .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
          .collect();

        const raceReports = reports.filter((r) => r.raceId === race._id);

        const eventRundownRows = await Promise.all(
          raceReports.map(async (report) => {
            if (report.status !== "finalized" && report.status !== "reviewed") {
              return null;
            }

            let review: any = null;
            if (report.status === "reviewed") {
              const reviews = await ctx.db
                .query("reviews")
                .withIndex("by_report", (q) => q.eq("reportId", report._id))
                .collect();

              if (reviews.length > 0) {
                review = reviews.reduce((latest, current) => {
                  const latestDate = latest.reviewDate || latest.createdAt || 0;
                  const currentDate = current.reviewDate || current.createdAt || 0;
                  return currentDate > latestDate ? current : latest;
                });
              }

              if (!review?.recommendedPenalty) {
                return null;
              }
            }

            const atFaultDriverId = report.atFaultDriverId || report.reportedDriverId;
            const reportedDriver = await ctx.db.get(atFaultDriverId);

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
              const user = await ctx.db.get(reportedDriver.userId);
              userOfficialName = user?.officialName;
            }
            const displayName = reportedDriver
              ? getDriverDisplayName(
                  { driverName: reportedDriver.driverName, officialName: reportedDriver.officialName },
                  userOfficialName ? { officialName: userOfficialName } : undefined
                )
              : null;

            let appliedPenalty: any = null;
            let recommendedPenaltyObj: any = null;

            if (report.status === "finalized" && report.appliedPenalty) {
              appliedPenalty = await ctx.db.get(report.appliedPenalty as any);
            }

            if (report.status === "reviewed" && review?.recommendedPenalty) {
              recommendedPenaltyObj = await ctx.db.get(
                review.recommendedPenalty as any,
              );
            }

            let penaltyName: string | null = null;
            let timePenaltySeconds = 0;
            let licensePoints: number | null = null;

            const lapNumber = parseInt(report.lap || "0", 10);
            const isLap1 = !isNaN(lapNumber) && lapNumber === 1;

            if (report.status === "finalized") {
              penaltyName = appliedPenalty?.name ?? null;
              const baseTimePenalty = isLap1
                ? (appliedPenalty?.timePenaltyLap1 ?? appliedPenalty?.timePenalty ?? 0)
                : (appliedPenalty?.timePenalty ?? 0);
              const selfReportReduction =
                appliedPenalty?.selfReportReduction ?? 0;
              timePenaltySeconds =
                appliedPenalty && report.isSelfReport
                  ? Math.max(0, baseTimePenalty - selfReportReduction)
                  : baseTimePenalty;
              licensePoints = appliedPenalty?.licensePoints ?? null;
            } else {
              penaltyName = recommendedPenaltyObj?.name ?? null;
              const baseTimePenalty = isLap1
                ? (recommendedPenaltyObj?.timePenaltyLap1 ?? recommendedPenaltyObj?.timePenalty ?? 0)
                : (recommendedPenaltyObj?.timePenalty ?? 0);
              const selfReportReduction =
                recommendedPenaltyObj?.selfReportReduction ?? 0;
              timePenaltySeconds =
                recommendedPenaltyObj && report.isSelfReport
                  ? Math.max(0, baseTimePenalty - selfReportReduction)
                  : baseTimePenalty;
              licensePoints = recommendedPenaltyObj?.licensePoints ?? null;
            }

            let incidentDescription: string;
            if (report.status === "finalized") {
              incidentDescription = report.finalDecision ?? "";
            } else {
              incidentDescription = review?.incidentDescription ?? "";
            }

            return {
              reportId: report.reportId || null,
              driverId: atFaultDriverId,
              carNumber: reportedDriver?.driverNumber ?? null,
              driverName: displayName,
              driverClass: reportedDriver?.driverClass ?? null,
              lap: report.lap ?? null,
              turn: report.turn ?? null,
              incidentDescription,
              adjustedReason: review?.isAdjusted ? review.adjustedReason : undefined,
              penaltyName,
              timePenaltySeconds,
              licensePoints,
              isSelfReport: report.isSelfReport ?? false,
              isFinalized: report.status === "finalized",
            };
          }),
        );

        const validRows = eventRundownRows.filter((row) => row !== null);

        return {
          raceId: race._id,
          raceNumber: race.raceNumber,
          raceName: `Race ${race.raceNumber}`,
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
    const event = await ctx.db.get(args.eventId);
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

    for (const race of races) {
      const reports = await ctx.db
        .query("reports")
        .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
        .collect();

      const raceReports = reports.filter((r) => r.raceId === race._id);

      for (const report of raceReports) {
        if (report.status !== "finalized" && report.status !== "reviewed") {
          continue;
        }

        const atFaultDriverId = report.atFaultDriverId || report.reportedDriverId;
        const driver = await ctx.db.get(atFaultDriverId);

        if (!driver) {
          continue;
        }

        const isMismatch = driver.championshipId !== eventSeriesId;

        const entry = {
          reportId: report._id.toString(),
          reportStatus: report.status,
          driverId: driver._id.toString(),
          driverName: driver.driverName,
          driverClass: driver.driverClass,
          driverChampionshipId: driver.championshipId?.toString() || "None",
          eventSeriesId: eventSeriesId.toString(),
          eventId: args.eventId.toString(),
          eventSeriesName: (await ctx.db.get(eventSeriesId))
            ? (await ctx.db.get(eventSeriesId))?.name
            : "Unknown",
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

    return {
      eventId: args.eventId.toString(),
      eventName: event.trackName,
      eventSeriesId: eventSeriesId.toString(),
      driversInSeries: driversInSeries.map((d) => ({
        driverId: d._id.toString(),
        driverName: d.driverName,
        driverClass: d.driverClass,
        championshipId: d.championshipId?.toString() || "None",
      })),
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
    const drivers = await ctx.db
      .query("drivers")
      .withIndex("by_championship", (q) =>
        q.eq("championshipId", args.seriesId),
      )
      .collect();

    const events = await ctx.db
      .query("events")
      .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId))
      .collect();

    const penaltyAccumulator: Record<string, number> = {};

    for (const event of events) {
      const reports = await ctx.db
        .query("reports")
        .withIndex("by_event", (q) => q.eq("eventId", event._id))
        .collect();

      const finalizedReports = reports.filter((r) => r.status === "finalized");

      for (const report of finalizedReports) {
        let penalty: any = null;
        if (report.appliedPenalty) {
          penalty = await ctx.db.get(report.appliedPenalty as any);
        }

        const points = penalty?.licensePoints ?? 0;
        const driverId = report.atFaultDriverId?.toString() || report.reportedDriverId.toString();

        // Verify the driver belongs to this series before accumulating points
        const driver = await ctx.db.get(
          report.atFaultDriverId || report.reportedDriverId,
        );

        // Only accumulate points if the driver's championship matches the current series
        if (driver && driver.championshipId === args.seriesId) {
          if (penaltyAccumulator[driverId]) {
            penaltyAccumulator[driverId] += points;
          } else {
            penaltyAccumulator[driverId] = points;
          }
        }
      }
    }

    const driverPoints = await Promise.all(
      drivers.map(async (driver) => {
        // Get display name with priority: user.officialName > driver.officialName > driver.driverName
        let userOfficialName: string | undefined;
        if (driver.userId) {
          const user = await ctx.db.get(driver.userId);
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
          totalLicensePoints: penaltyAccumulator[driver._id.toString()] ?? 0,
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
    const drivers = await ctx.db
      .query("drivers")
      .withIndex("by_championship", (q) =>
        q.eq("championshipId", args.seriesId),
      )
      .collect();

    const events = await ctx.db
      .query("events")
      .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId))
      .collect();

    const penaltyAccumulator: Record<string, number> = {};

    for (const event of events) {
      const reports = await ctx.db
        .query("reports")
        .withIndex("by_event", (q) => q.eq("eventId", event._id))
        .collect();

      const finalizedReports = reports.filter((r) => r.status === "finalized");

      for (const report of finalizedReports) {
        let penalty: any = null;
        if (report.appliedPenalty) {
          penalty = await ctx.db.get(report.appliedPenalty as any);
        }

        const points = penalty?.licensePoints ?? 0;
        const driverId = report.atFaultDriverId?.toString() || report.reportedDriverId.toString();

        // Verify the driver belongs to this series before accumulating points
        const driver = await ctx.db.get(
          report.atFaultDriverId || report.reportedDriverId,
        );

        // Only accumulate points if the driver's championship matches the current series
        if (driver && driver.championshipId === args.seriesId) {
          if (penaltyAccumulator[driverId]) {
            penaltyAccumulator[driverId] += points;
          } else {
            penaltyAccumulator[driverId] = points;
          }
        }
      }
    }

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

    const driverPointsWithPenalties = await Promise.all(
      drivers.map(async (driver) => {
        const driverId = driver._id.toString();
        const totalPoints = penaltyAccumulator[driverId] ?? 0;

        // Get display name with priority: user.officialName > driver.officialName > driver.driverName
        let userOfficialName: string | undefined;
        if (driver.userId) {
          const user = await ctx.db.get(driver.userId);
          userOfficialName = user?.officialName;
        }
        const displayName = getDriverDisplayName(
          { driverName: driver.driverName, officialName: driver.officialName },
          userOfficialName ? { officialName: userOfficialName } : undefined
        );

        const allDriverSeriesPenalties = await ctx.db
          .query("driverSeriesPenalties")
          .withIndex("by_driver_and_series", (q) =>
            q.eq("driverId", driver._id).eq("seriesId", args.seriesId),
          )
          .collect();

        // DEBUG: Log mismatch if found
        if (allDriverSeriesPenalties.length > 0) {
          const mismatchedPenalties = allDriverSeriesPenalties.filter(
            (dsp) => {
              const driverInDb = drivers.find((d) => d._id === dsp.driverId);
              return !driverInDb || driverInDb.championshipId !== args.seriesId;
            },
          );

          if (mismatchedPenalties.length > 0) {
            console.error("Mismatched driverSeriesPenalties found:", {
              querySeriesId: args.seriesId.toString(),
              driverId: driver._id.toString(),
              driverName: driver.driverName,
              driverClass: driver.driverClass,
              driverChampionshipId: driver.championshipId?.toString() || "none",
              mismatchedPenalties: mismatchedPenalties.map((dsp) => ({
                driverSeriesPenaltyId: dsp._id.toString(),
                seriesId: dsp.seriesId.toString(),
                isServed: dsp.isServed,
              })),
            });
          }
        }

        const driverSeriesPenaltiesWithDetails = await Promise.all(
          allDriverSeriesPenalties.map(async (dsp) => {
            const seriesPenalty = await ctx.db.get(dsp.seriesPenaltyId);
            const seriesPenaltyThreshold = await ctx.db.get(
              dsp.seriesPenaltyThresholdId,
            );
            const servedByUser = dsp.servedBy
              ? await ctx.db.get(dsp.servedBy)
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
            const appliesToDriver = threshold.driverClasses.includes(
              driver.driverClass,
            );

            if (appliesToDriver && totalPoints >= threshold.threshold) {
              const alreadyAssigned = allDriverSeriesPenalties.some(
                (dsp) =>
                  dsp.seriesPenaltyId === sp._id &&
                  dsp.seriesPenaltyThresholdId === threshold._id,
              );

              if (!alreadyAssigned) {
                eligibleSeriesPenalties.push({
                  seriesPenaltyId: sp._id,
                  penaltyName: sp.penaltyName,
                  penaltyDescription: sp.penaltyDescription,
                  driverClasses: threshold.driverClasses,
                  threshold: threshold.threshold,
                  seriesPenaltyThresholdId: threshold._id,
                  isAssigned: false,
                });
              }
            }
          }
        }

        return {
          driverId: driver._id,
          driverNumber: driver.driverNumber,
          driverName: displayName,
          driverClass: driver.driverClass,
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
      const driver = await ctx.db.get(dsp.driverId);
      const seriesPenalty = await ctx.db.get(dsp.seriesPenaltyId);

      const isMismatch = !driver || driver.championshipId !== args.seriesId;

      const entry = {
        driverSeriesPenaltyId: dsp._id.toString(),
        driverId: dsp.driverId.toString(),
        driverName: driver?.driverName || "Driver not found",
        driverClass: driver?.driverClass || "N/A",
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

    return {
      querySeriesId: args.seriesId.toString(),
      driversInSeries: drivers.map((d) => ({
        driverId: d._id.toString(),
        driverName: d.driverName,
        driverClass: d.driverClass,
        championshipId: d.championshipId?.toString() || "None",
      })),
      mismatches,
      correct,
      totalDriverSeriesPenalties: allDriverSeriesPenalties.length,
      mismatchCount: mismatches.length,
      correctCount: correct.length,
    };
  },
});
