import { query } from "./_generated/server";
import { v } from "convex/values";

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

            // Get display name (officialName if user is linked, else driverName)
            let displayName = reportedDriver?.driverName ?? null;
            if (reportedDriver?.userId) {
              const user = await ctx.db.get(reportedDriver.userId);
              if (user?.officialName) displayName = user.officialName;
            }

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

        if (penaltyAccumulator[driverId]) {
          penaltyAccumulator[driverId] += points;
        } else {
          penaltyAccumulator[driverId] = points;
        }
      }
    }

    const driverPoints = await Promise.all(
      drivers.map(async (driver) => {
        // Get display name (officialName if user is linked, else driverName)
        let displayName = driver.driverName;
        if (driver.userId) {
          const user = await ctx.db.get(driver.userId);
          if (user?.officialName) displayName = user.officialName;
        }

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

        if (penaltyAccumulator[driverId]) {
          penaltyAccumulator[driverId] += points;
        } else {
          penaltyAccumulator[driverId] = points;
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

        // Get display name (officialName if user is linked, else driverName)
        let displayName = driver.driverName;
        if (driver.userId) {
          const user = await ctx.db.get(driver.userId);
          if (user?.officialName) displayName = user.officialName;
        }

        const allDriverSeriesPenalties = await ctx.db
          .query("driverSeriesPenalties")
          .withIndex("by_driver_and_series", (q) =>
            q.eq("driverId", driver._id).eq("seriesId", args.seriesId),
          )
          .collect();

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
