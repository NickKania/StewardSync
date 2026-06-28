export const getEffectiveLicensePoints = (
  penalty: { licensePoints?: number; selfReportLicensePointReduction?: number } | null | undefined,
  isSelfReport: boolean | null | undefined,
): number => {
  const basePoints = penalty?.licensePoints ?? 0;
  const reduction = isSelfReport
    ? (penalty?.selfReportLicensePointReduction ?? 0)
    : 0;

  return Math.max(0, basePoints - reduction);
};

const comparePenaltySeverity = (
  left: { threshold: number; assignedAt?: number },
  right: { threshold: number; assignedAt?: number },
): number => {
  if (left.threshold !== right.threshold) {
    return right.threshold - left.threshold;
  }
  return (right.assignedAt ?? 0) - (left.assignedAt ?? 0);
};

const sameId = (left: unknown, right: unknown): boolean =>
  left != null && right != null && String(left) === String(right);

export const isSeriesPenaltyThresholdMet = (
  totalPoints: number,
  threshold: number,
): boolean => totalPoints >= threshold;

export const recalculateSeriesLicensePoints = async (
  ctx: any,
  seriesId: unknown,
): Promise<void> => {
  const events = await ctx.db
    .query("events")
    .withIndex("by_series", (q: any) => q.eq("seriesId", seriesId))
    .collect();

  const drivers = await ctx.db
    .query("drivers")
    .withIndex("by_championship", (q: any) =>
      q.eq("championshipId", seriesId),
    )
    .collect();

  const penaltyAccumulator: Record<string, number> = {};

  for (const event of events) {
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_event", (q: any) => q.eq("eventId", event._id))
      .collect();

    const finalizedReports = reports.filter(
      (report: any) => report.status === "finalized",
    );

    for (const report of finalizedReports) {
      if (report.isNoDriverAtFault) {
        continue;
      }

      const driverId = report.atFaultDriverId || report.reportedDriverId;
      if (!driverId) {
        continue;
      }

      const driver = await ctx.db.get(driverId);
      if (!driver || !sameId(driver.championshipId, seriesId)) {
        continue;
      }

      const penalty = report.appliedPenalty
        ? await ctx.db.get(report.appliedPenalty)
        : null;
      const points = getEffectiveLicensePoints(penalty, report.isSelfReport);
      const driverKey = driverId.toString();
      penaltyAccumulator[driverKey] =
        (penaltyAccumulator[driverKey] ?? 0) + points;
    }
  }

  const seriesPenalties = await ctx.db
    .query("seriesPenalties")
    .withIndex("by_series", (q: any) => q.eq("seriesId", seriesId))
    .collect();

  for (const driver of drivers) {
    const calculatedReportPoints =
      penaltyAccumulator[driver._id.toString()] ?? 0;
    const totalPoints =
      driver.accumulatedLicensePoints ?? calculatedReportPoints;

    const existingDriverSeriesPenalties = await ctx.db
      .query("driverSeriesPenalties")
      .withIndex("by_driver_and_series", (q: any) =>
        q.eq("driverId", driver._id).eq("seriesId", seriesId),
      )
      .collect();

    const existingBySeriesPenalty = new Map<string, any>();
    for (const dsp of existingDriverSeriesPenalties) {
      const key = dsp.seriesPenaltyId.toString();
      const existing = existingBySeriesPenalty.get(key);
      if (!existing) {
        existingBySeriesPenalty.set(key, dsp);
        continue;
      }

      if (existing.isServed !== dsp.isServed) {
        if (!dsp.isServed) {
          existingBySeriesPenalty.set(key, dsp);
        }
        continue;
      }

      if (dsp.assignedAt > existing.assignedAt) {
        existingBySeriesPenalty.set(key, dsp);
      }
    }

    for (const seriesPenalty of seriesPenalties) {
      const thresholds = await ctx.db
        .query("seriesPenaltyThresholds")
        .withIndex("by_series_penalty", (q: any) =>
          q.eq("seriesPenaltyId", seriesPenalty._id),
        )
        .collect();

      const matchedThresholds = thresholds
        .filter((threshold: any) => {
          const appliesToDriver =
            driver.driverClassId &&
            threshold.driverClassIds?.some((driverClassId: unknown) =>
              sameId(driverClassId, driver.driverClassId),
            );
          return (
            appliesToDriver &&
            isSeriesPenaltyThresholdMet(totalPoints, threshold.threshold)
          );
        })
        .sort((a: any, b: any) =>
          comparePenaltySeverity(
            { threshold: a.threshold },
            { threshold: b.threshold },
          ),
        );

      const existingPenalty = existingBySeriesPenalty.get(
        seriesPenalty._id.toString(),
      );

      if (matchedThresholds.length === 0) {
        if (
          existingPenalty &&
          !existingPenalty.isServed &&
          !existingPenalty.raceBanReviewId
        ) {
          await ctx.db.delete(existingPenalty._id);
        }
        continue;
      }

      const strongestMatchedThreshold = matchedThresholds[0];
      const assignmentTimestamp = Date.now();

      if (!existingPenalty) {
        await ctx.db.insert("driverSeriesPenalties", {
          driverId: driver._id,
          seriesId,
          seriesPenaltyId: seriesPenalty._id,
          seriesPenaltyThresholdId: strongestMatchedThreshold._id,
          isServed: false,
          requiresReview: strongestMatchedThreshold.requiresReview ?? false,
          pointsAtAssignment: totalPoints,
          assignedAt: assignmentTimestamp,
        });
        continue;
      }

      if (existingPenalty.isServed) {
        continue;
      }

      const isDifferentThreshold =
        !sameId(
          existingPenalty.seriesPenaltyThresholdId,
          strongestMatchedThreshold._id,
        );
      const isDifferentPoints =
        existingPenalty.pointsAtAssignment !== totalPoints;

      if (!isDifferentThreshold && !isDifferentPoints) {
        continue;
      }

      await ctx.db.patch(existingPenalty._id, {
        seriesPenaltyThresholdId: strongestMatchedThreshold._id,
        requiresReview: strongestMatchedThreshold.requiresReview ?? false,
        pointsAtAssignment: totalPoints,
        assignedAt: assignmentTimestamp,
      });
    }
  }
};
