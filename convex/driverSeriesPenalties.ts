import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { UserFacingError } from "./lib/errors";
import { getCurrentUserRole } from "./lib/auth";
import { getEffectiveLicensePoints } from "./lib/penalties";

const getLinkedRaceBanReview = async (ctx: any, dsp: any) => {
  if (dsp.raceBanReviewId) {
    const linkedById = await ctx.db.get(dsp.raceBanReviewId);
    if (linkedById) {
      return linkedById;
    }
  }

  const linkedByPenalty = await ctx.db
    .query("raceBanReviews")
    .withIndex("by_driver_series_penalty", (q: any) =>
      q.eq("driverSeriesPenaltyId", dsp._id),
    )
    .first();

  return linkedByPenalty;
};

const isPenaltyStillActive = (dsp: any, linkedReview: any): boolean => {
  if (!dsp.isServed) {
    return true;
  }

  const requiresReview = dsp.requiresReview ?? false;
  if (!requiresReview) {
    return false;
  }

  return linkedReview?.status !== "completed";
};

const getThresholdValue = (threshold: any): number =>
  typeof threshold?.threshold === "number" ? threshold.threshold : 0;

const comparePenaltySeverity = (
  left: { thresholdValue: number; assignedAt?: number },
  right: { thresholdValue: number; assignedAt?: number },
): number => {
  if (left.thresholdValue !== right.thresholdValue) {
    return right.thresholdValue - left.thresholdValue;
  }
  return (right.assignedAt ?? 0) - (left.assignedAt ?? 0);
};

export const assignPenalty = mutation({
  args: {
    driverId: v.id("drivers"),
    seriesId: v.id("series"),
    seriesPenaltyId: v.id("seriesPenalties"),
    seriesPenaltyThresholdId: v.id("seriesPenaltyThresholds"),
    pointsAtAssignment: v.number(),
  },
  handler: async (ctx, args) => {
    const threshold = await ctx.db.get(args.seriesPenaltyThresholdId);
    if (!threshold) {
      throw new UserFacingError("Series penalty threshold not found");
    }

    const existingPenalties = await ctx.db
      .query("driverSeriesPenalties")
      .withIndex("by_driver_and_series", (q) =>
        q.eq("driverId", args.driverId).eq("seriesId", args.seriesId),
      )
      .collect();

    const existingForSeriesPenalty = existingPenalties
      .filter(
        (dsp) =>
          dsp.seriesPenaltyId.toString() === args.seriesPenaltyId.toString(),
      )
      .sort((a, b) => {
        if (a.isServed !== b.isServed) {
          return a.isServed ? 1 : -1;
        }
        return b.assignedAt - a.assignedAt;
      });

    if (existingForSeriesPenalty.length > 0) {
      const penaltyToUpdate = existingForSeriesPenalty[0];
      if (penaltyToUpdate.isServed) {
        return penaltyToUpdate._id;
      }
      await ctx.db.patch(penaltyToUpdate._id, {
        seriesPenaltyId: args.seriesPenaltyId,
        seriesPenaltyThresholdId: args.seriesPenaltyThresholdId,
        requiresReview: threshold.requiresReview ?? false,
        pointsAtAssignment: args.pointsAtAssignment,
        assignedAt: Date.now(),
      });
      return penaltyToUpdate._id;
    }

    const driverSeriesPenaltyId = await ctx.db.insert("driverSeriesPenalties", {
      driverId: args.driverId,
      seriesId: args.seriesId,
      seriesPenaltyId: args.seriesPenaltyId,
      seriesPenaltyThresholdId: args.seriesPenaltyThresholdId,
      isServed: false,
      requiresReview: threshold.requiresReview ?? false,
      pointsAtAssignment: args.pointsAtAssignment,
      assignedAt: Date.now(),
    });
    return driverSeriesPenaltyId;
  },
});

export const markAsServed = mutation({
  args: {
    id: v.id("driverSeriesPenalties"),
    servedBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const role = await getCurrentUserRole(ctx, args.servedBy);
    if (role !== "head_steward" && role !== "league_manager") {
      throw new UserFacingError(
        "Only head stewards and league managers can mark penalties as served",
      );
    }

    await ctx.db.patch(args.id, {
      isServed: true,
      servedAt: Date.now(),
      servedBy: args.servedBy,
    });
    return args.id;
  },
});

export const checkAndAssignThresholds = mutation({
  args: { seriesId: v.id("series") },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("events")
      .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId))
      .collect();

    const drivers = await ctx.db
      .query("drivers")
      .withIndex("by_championship", (q) =>
        q.eq("championshipId", args.seriesId),
      )
      .collect();

    const penaltyAccumulator: Record<string, number> = {};

    for (const event of events) {
      const reports = await ctx.db
        .query("reports")
        .withIndex("by_event", (q) => q.eq("eventId", event._id))
        .collect();

      const finalizedReports = reports.filter((r) => r.status === "finalized");

      for (const report of finalizedReports) {
        if (report.isNoDriverAtFault) {
          continue;
        }

        let penalty: any = null;
        if (report.appliedPenalty) {
          penalty = await ctx.db.get(report.appliedPenalty as any);
        }

        const points = getEffectiveLicensePoints(penalty, report.isSelfReport);
        const driverId =
          report.atFaultDriverId?.toString() ||
          report.reportedDriverId.toString();

        if (penaltyAccumulator[driverId]) {
          penaltyAccumulator[driverId] += points;
        } else {
          penaltyAccumulator[driverId] = points;
        }
      }
    }

    const seriesPenalties = await ctx.db
      .query("seriesPenalties")
      .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId))
      .collect();

    const assignedPenalties: any[] = [];

    for (const driver of drivers) {
      const driverId = driver._id.toString();
      const totalPoints = penaltyAccumulator[driverId] ?? 0;

      // Get driver's class information
      const driverClass = driver.driverClassId
        ? await ctx.db.get(driver.driverClassId)
        : null;
      const driverClassId = driverClass?._id;

      const existingDriverSeriesPenalties = await ctx.db
        .query("driverSeriesPenalties")
        .withIndex("by_driver_and_series", (q) =>
          q.eq("driverId", driver._id).eq("seriesId", args.seriesId),
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
          .withIndex("by_series_penalty", (q) =>
            q.eq("seriesPenaltyId", seriesPenalty._id),
          )
          .collect();

        const matchedThresholds = thresholds
          .filter((threshold) => {
            const appliesToDriver = driverClassId
              ? threshold.driverClassIds.includes(driverClassId)
              : false;
            return appliesToDriver && totalPoints >= threshold.threshold;
          })
          .sort((a, b) =>
            comparePenaltySeverity(
              { thresholdValue: getThresholdValue(a) },
              { thresholdValue: getThresholdValue(b) },
            ),
          );

        if (matchedThresholds.length === 0) {
          continue;
        }

        // Keep one row per seriesPenalty; when multiple thresholds are matched,
        // retain the strongest threshold for that penalty.
        const strongestMatchedThreshold = matchedThresholds[0];
        const existingPenalty = existingBySeriesPenalty.get(
          seriesPenalty._id.toString(),
        );
        const assignmentTimestamp = Date.now();

        if (!existingPenalty) {
          const driverSeriesPenaltyId = await ctx.db.insert(
            "driverSeriesPenalties",
            {
              driverId: driver._id,
              seriesId: args.seriesId,
              seriesPenaltyId: seriesPenalty._id,
              seriesPenaltyThresholdId: strongestMatchedThreshold._id,
              isServed: false,
              requiresReview: strongestMatchedThreshold.requiresReview ?? false,
              pointsAtAssignment: totalPoints,
              assignedAt: assignmentTimestamp,
            },
          );

          assignedPenalties.push({
            driverSeriesPenaltyId,
            driverName: driver.driverName,
            driverClass: driverClass?.displayName || "",
            penaltyName: seriesPenalty.penaltyName,
            threshold: strongestMatchedThreshold.threshold,
            pointsAtAssignment: totalPoints,
          });
          continue;
        }

        if (existingPenalty.isServed) {
          continue;
        }

        const isDifferentThreshold =
          existingPenalty.seriesPenaltyThresholdId.toString() !==
          strongestMatchedThreshold._id.toString();
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

    return assignedPenalties;
  },
});

export const getByDriverAndSeries = query({
  args: {
    driverId: v.id("drivers"),
    seriesId: v.id("series"),
  },
  handler: async (ctx, args) => {
    const driverSeriesPenalties = await ctx.db
      .query("driverSeriesPenalties")
      .withIndex("by_driver_and_series", (q) =>
        q.eq("driverId", args.driverId).eq("seriesId", args.seriesId),
      )
      .collect();

    const driverSeriesPenaltiesWithDetails = await Promise.all(
      driverSeriesPenalties.map(async (dsp: any) => {
        const driver = await ctx.db.get(dsp.driverId);
        const series = await ctx.db.get(dsp.seriesId);
        const seriesPenalty = await ctx.db.get(dsp.seriesPenaltyId);
        const seriesPenaltyThreshold = await ctx.db.get(
          dsp.seriesPenaltyThresholdId,
        );
        const raceBanReview = await getLinkedRaceBanReview(ctx, dsp);
        const servedByUser = dsp.servedBy
          ? await ctx.db.get(dsp.servedBy)
          : null;

        return {
          ...dsp,
          requiresReview:
            dsp.requiresReview ??
            (seriesPenaltyThreshold as any)?.requiresReview ??
            false,
          raceBanReview,
          driver,
          series,
          seriesPenalty,
          seriesPenaltyThreshold,
          servedByUser,
        };
      }),
    );

    return driverSeriesPenaltiesWithDetails;
  },
});

export const getBySeries = query({
  args: { seriesId: v.id("series") },
  handler: async (ctx, args) => {
    const driverSeriesPenalties = await ctx.db
      .query("driverSeriesPenalties")
      .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId))
      .collect();

    const driverSeriesPenaltiesWithDetails = await Promise.all(
      driverSeriesPenalties.map(async (dsp: any) => {
        const driver = await ctx.db.get(dsp.driverId);
        const series = await ctx.db.get(dsp.seriesId);
        const seriesPenalty = await ctx.db.get(dsp.seriesPenaltyId);
        const seriesPenaltyThreshold = await ctx.db.get(
          dsp.seriesPenaltyThresholdId,
        );
        const raceBanReview = await getLinkedRaceBanReview(ctx, dsp);
        const servedByUser = dsp.servedBy
          ? await ctx.db.get(dsp.servedBy)
          : null;

        return {
          ...dsp,
          requiresReview:
            dsp.requiresReview ??
            (seriesPenaltyThreshold as any)?.requiresReview ??
            false,
          raceBanReview,
          driver,
          series,
          seriesPenalty,
          seriesPenaltyThreshold,
          servedByUser,
        };
      }),
    );

    return driverSeriesPenaltiesWithDetails;
  },
});

export const getDriverPenaltyDetails = query({
  args: {
    driverId: v.id("drivers"),
    seriesId: v.optional(v.id("series")),
  },
  handler: async (ctx, args) => {
    let driverSeriesPenalties: any[] = [];

    if (args.seriesId) {
      driverSeriesPenalties = await ctx.db
        .query("driverSeriesPenalties")
        .withIndex("by_driver_and_series", (q) =>
          q.eq("driverId", args.driverId).eq("seriesId", args.seriesId as any),
        )
        .collect();
    } else {
      driverSeriesPenalties = await ctx.db
        .query("driverSeriesPenalties")
        .filter((q) => q.eq(q.field("driverId"), args.driverId))
        .collect();
    }

    const now = Date.now();
    const eventCache = new Map<string, any[]>();

    const getSeriesEvents = async (seriesId: any) => {
      const key = seriesId.toString();
      if (!eventCache.has(key)) {
        const events = await ctx.db
          .query("events")
          .withIndex("by_series", (q) => q.eq("seriesId", seriesId))
          .collect();

        events.sort((a, b) => a.eventDate - b.eventDate);
        eventCache.set(key, events);
      }
      return eventCache.get(key) ?? [];
    };

    const driverSeriesPenaltiesWithDetails = await Promise.all(
      driverSeriesPenalties.map(async (dsp: any) => {
        const series = await ctx.db.get(dsp.seriesId);
        const seriesPenalty = await ctx.db.get(dsp.seriesPenaltyId);
        const seriesPenaltyThreshold = await ctx.db.get(
          dsp.seriesPenaltyThresholdId,
        );
        const raceBanReview = await getLinkedRaceBanReview(ctx, dsp);
        const servedByUser = dsp.servedBy
          ? await ctx.db.get(dsp.servedBy)
          : null;
        const requiresReview =
          dsp.requiresReview ??
          (seriesPenaltyThreshold as any)?.requiresReview ??
          false;
        const reviewStatus = !requiresReview
          ? "not_required"
          : raceBanReview
            ? raceBanReview.status
            : "required_no_request";
        const isServedButPendingReview =
          dsp.isServed && requiresReview && reviewStatus !== "completed";

        return {
          _id: dsp._id,
          driverId: dsp.driverId,
          seriesId: dsp.seriesId,
          seriesName: (series as any)?.name ?? null,
          seriesPenaltyId: dsp.seriesPenaltyId,
          seriesPenaltyThresholdId: dsp.seriesPenaltyThresholdId,
          penaltyName: (seriesPenalty as any)?.penaltyName ?? null,
          penaltyDescription:
            (seriesPenalty as any)?.penaltyDescription ?? null,
          threshold: (seriesPenaltyThreshold as any)?.threshold ?? null,
          isServed: dsp.isServed,
          requiresReview,
          reviewStatus,
          raceBanReviewId: raceBanReview?._id ?? null,
          pointsAtAssignment: dsp.pointsAtAssignment,
          assignedAt: dsp.assignedAt,
          expectedServeDate: null,
          servedAt: dsp.servedAt,
          servedBy: dsp.servedBy,
          servedByUserName: (servedByUser as any)?.name ?? null,
          status: isServedButPendingReview
            ? "served_pending_review"
            : dsp.isServed
              ? "served"
              : "active",
        };
      }),
    );

    const penaltiesBySeries = new Map<string, typeof driverSeriesPenaltiesWithDetails>();
    for (const penalty of driverSeriesPenaltiesWithDetails) {
      const key = penalty.seriesId.toString();
      if (!penaltiesBySeries.has(key)) {
        penaltiesBySeries.set(key, []);
      }
      penaltiesBySeries.get(key)!.push(penalty);
    }

    for (const penalties of penaltiesBySeries.values()) {
      const seriesId = penalties[0]?.seriesId;
      if (!seriesId) {
        continue;
      }

      const seriesEvents = await getSeriesEvents(seriesId);
      const upcomingEvents = seriesEvents.filter((event) => event.eventDate >= now);

      const unservedBySeverity = penalties
        .filter((penalty) => !penalty.isServed)
        .sort((a, b) => {
          if (a.threshold !== b.threshold) {
            return (b.threshold ?? 0) - (a.threshold ?? 0);
          }
          return a.assignedAt - b.assignedAt;
        });

      unservedBySeverity.forEach((penalty, index) => {
        penalty.expectedServeDate = upcomingEvents[index]?.eventDate ?? null;
      });
    }

    return driverSeriesPenaltiesWithDetails.sort(
      (a, b) => b.assignedAt - a.assignedAt,
    );
  },
});

export const getUnservedPenaltiesBySeries = query({
  args: {
    seriesId: v.optional(v.id("series")),
  },
  handler: async (ctx, args) => {
    let driverSeriesPenalties: any[] = [];

    if (args.seriesId) {
      driverSeriesPenalties = await ctx.db
        .query("driverSeriesPenalties")
        .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId as any))
        .filter((q) => q.eq(q.field("isServed"), false))
        .collect();
    } else {
      driverSeriesPenalties = await ctx.db
        .query("driverSeriesPenalties")
        .filter((q) => q.eq(q.field("isServed"), false))
        .collect();
    }

    const penaltiesWithDetails = await Promise.all(
      driverSeriesPenalties.map(async (dsp: any) => {
        const driver = await ctx.db.get(dsp.driverId);
        const series = await ctx.db.get(dsp.seriesId);
        const seriesPenalty = await ctx.db.get(dsp.seriesPenaltyId);
        const seriesPenaltyThreshold = await ctx.db.get(
          dsp.seriesPenaltyThresholdId,
        );
        const servedByUser = dsp.servedBy
          ? await ctx.db.get(dsp.servedBy)
          : null;

        return {
          _id: dsp._id,
          driverId: dsp.driverId,
          seriesId: dsp.seriesId,
          seriesPenaltyId: dsp.seriesPenaltyId,
          seriesPenaltyThresholdId: dsp.seriesPenaltyThresholdId,
          driver,
          series,
          seriesPenalty,
          seriesPenaltyThreshold,
          servedByUser,
          isServed: dsp.isServed,
          pointsAtAssignment: dsp.pointsAtAssignment,
          assignedAt: dsp.assignedAt,
          servedAt: dsp.servedAt,
          servedBy: dsp.servedBy,
          servedByUserName: (servedByUser as any)?.name ?? null,
        };
      }),
    );

    const penaltiesBySeries: Record<string, any[]> = {};

    for (const penalty of penaltiesWithDetails) {
      const seriesId = penalty.seriesId?.toString();
      if (!seriesId) continue;
      if (!penaltiesBySeries[seriesId]) {
        penaltiesBySeries[seriesId] = [];
      }
      penaltiesBySeries[seriesId].push(penalty);
    }

    const result: any[] = [];

    for (const [seriesId, penalties] of Object.entries(penaltiesBySeries)) {
      const penaltiesByDriver: Record<string, any[]> = {};

      for (const penalty of penalties) {
        const driverId = penalty.driverId?.toString();
        if (!driverId) continue;
        if (!penaltiesByDriver[driverId]) {
          penaltiesByDriver[driverId] = [];
        }
        penaltiesByDriver[driverId].push(penalty);
      }

      const sortedPenalties = Object.values(penaltiesByDriver)
        .map((driverPenalties) => {
          driverPenalties.sort(
            (a, b) =>
              (b.seriesPenaltyThreshold?.threshold ?? 0) -
              (a.seriesPenaltyThreshold?.threshold ?? 0),
          );
          return driverPenalties[0];
        })
        .sort((a, b) => {
          const driverNameA = a.driver?.driverName ?? "";
          const driverNameB = b.driver?.driverName ?? "";
          return driverNameA.localeCompare(driverNameB);
        });

      result.push({
        seriesId,
        seriesName: penalties[0].series?.name ?? null,
        penalties: sortedPenalties,
      });
    }

    result.sort((a, b) =>
      (a.seriesName ?? "").localeCompare(b.seriesName ?? ""),
    );

    return result;
  },
});

export const getDashboardPenaltyGroups = query({
  args: {
    seriesId: v.optional(v.id("series")),
  },
  handler: async (ctx, args) => {
    const driverSeriesPenalties = args.seriesId
      ? await ctx.db
          .query("driverSeriesPenalties")
          .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId as any))
          .collect()
      : await ctx.db.query("driverSeriesPenalties").collect();

    const seriesCache = new Map<string, any>();
    const eventCache = new Map<string, any[]>();
    const driverCache = new Map<string, any>();
    const userCache = new Map<string, any>();
    const driverClassCache = new Map<string, any>();
    const seriesPenaltyCache = new Map<string, any>();
    const thresholdCache = new Map<string, any>();

    const getSeries = async (seriesId: any) => {
      const key = seriesId.toString();
      if (!seriesCache.has(key)) {
        seriesCache.set(key, await ctx.db.get(seriesId));
      }
      return seriesCache.get(key);
    };

    const getSeriesEvents = async (seriesId: any) => {
      const key = seriesId.toString();
      if (!eventCache.has(key)) {
        const events = await ctx.db
          .query("events")
          .withIndex("by_series", (q) => q.eq("seriesId", seriesId))
          .collect();

        events.sort((a, b) => a.eventDate - b.eventDate);
        eventCache.set(key, events);
      }
      return eventCache.get(key) ?? [];
    };

    const getDriver = async (driverId: any) => {
      const key = driverId.toString();
      if (!driverCache.has(key)) {
        driverCache.set(key, await ctx.db.get(driverId));
      }
      return driverCache.get(key);
    };

    const getDriverClass = async (driverClassId: any) => {
      const key = driverClassId.toString();
      if (!driverClassCache.has(key)) {
        driverClassCache.set(key, await ctx.db.get(driverClassId));
      }
      return driverClassCache.get(key);
    };

    const getUser = async (userId: any) => {
      const key = userId.toString();
      if (!userCache.has(key)) {
        userCache.set(key, await ctx.db.get(userId));
      }
      return userCache.get(key);
    };

    const getSeriesPenalty = async (seriesPenaltyId: any) => {
      const key = seriesPenaltyId.toString();
      if (!seriesPenaltyCache.has(key)) {
        seriesPenaltyCache.set(key, await ctx.db.get(seriesPenaltyId));
      }
      return seriesPenaltyCache.get(key);
    };

    const getThreshold = async (thresholdId: any) => {
      const key = thresholdId.toString();
      if (!thresholdCache.has(key)) {
        thresholdCache.set(key, await ctx.db.get(thresholdId));
      }
      return thresholdCache.get(key);
    };

    const penaltiesWithDetails = await Promise.all(
      driverSeriesPenalties.map(async (dsp: any) => {
        const [series, driver, seriesPenalty, threshold] = await Promise.all([
          getSeries(dsp.seriesId),
          getDriver(dsp.driverId),
          getSeriesPenalty(dsp.seriesPenaltyId),
          getThreshold(dsp.seriesPenaltyThresholdId),
        ]);
        const linkedReview = await getLinkedRaceBanReview(ctx, dsp);
        const requiresReview =
          dsp.requiresReview ?? threshold?.requiresReview ?? false;

        const driverUser = driver?.userId ? await getUser(driver.userId) : null;
        const driverClass = driver?.driverClassId
          ? await getDriverClass(driver.driverClassId)
          : null;

        const seriesEvents = await getSeriesEvents(dsp.seriesId);
        const expectedEvent = seriesEvents.find(
          (event) => event.eventDate >= dsp.assignedAt,
        );
        const isServedButPendingReview =
          dsp.isServed &&
          requiresReview &&
          linkedReview?.status !== "completed";

        if (!isPenaltyStillActive({ ...dsp, requiresReview }, linkedReview)) {
          return null;
        }

        return {
          _id: dsp._id,
          driverId: dsp.driverId,
          seriesId: dsp.seriesId,
          seriesPenaltyId: dsp.seriesPenaltyId,
          seriesName: series?.name ?? "Unknown Series",
          driverName:
            driverUser?.officialName || driver?.driverName || "Unknown Driver",
          discordUsername: driverUser?.discordUsername ?? null,
          driverNumber: driver?.driverNumber ?? null,
          driverClass: driverClass?.displayName ?? null,
          penaltyName: seriesPenalty?.penaltyName ?? "Unknown Penalty",
          penaltyDescription: seriesPenalty?.penaltyDescription ?? "",
          threshold: threshold?.threshold ?? null,
          pointsAtAssignment: dsp.pointsAtAssignment,
          assignedAt: dsp.assignedAt,
          expectedServeDate: expectedEvent?.eventDate ?? null,
          isServed: dsp.isServed,
          requiresReview,
          reviewStatus: !requiresReview
            ? "not_required"
            : linkedReview
              ? linkedReview.status
              : "required_no_request",
          reviewRequestId: linkedReview?._id ?? null,
          status: isServedButPendingReview
            ? "served_pending_review"
            : "active",
        };
      }),
    );
    const activePenalties = penaltiesWithDetails.filter(Boolean);

    // Enforce one displayed active penalty per driver/seriesPenalty.
    const strongestPenaltyBySeriesPenalty = new Map<string, any>();
    for (const penalty of activePenalties as any[]) {
      if (!penalty.seriesId || !penalty.driverId || !penalty.seriesPenaltyId) {
        continue;
      }
      const key = `${penalty.seriesId.toString()}:${penalty.driverId.toString()}:${penalty.seriesPenaltyId.toString()}`;
      const existing = strongestPenaltyBySeriesPenalty.get(key);
      if (!existing) {
        strongestPenaltyBySeriesPenalty.set(key, penalty);
        continue;
      }

      const existingSeverity = {
        thresholdValue: existing.threshold ?? 0,
        assignedAt: existing.assignedAt,
      };
      const candidateSeverity = {
        thresholdValue: penalty.threshold ?? 0,
        assignedAt: penalty.assignedAt,
      };
      if (comparePenaltySeverity(existingSeverity, candidateSeverity) > 0) {
        strongestPenaltyBySeriesPenalty.set(key, penalty);
      }
    }

    const dedupedActivePenalties = Array.from(
      strongestPenaltyBySeriesPenalty.values(),
    );

    const penaltiesByDriverInSeries = new Map<string, any[]>();
    for (const penalty of dedupedActivePenalties as any[]) {
      const key = `${penalty.seriesId.toString()}:${penalty.driverId.toString()}`;
      if (!penaltiesByDriverInSeries.has(key)) {
        penaltiesByDriverInSeries.set(key, []);
      }
      penaltiesByDriverInSeries.get(key)!.push(penalty);
    }

    const now = Date.now();
    for (const penalties of penaltiesByDriverInSeries.values()) {
      const seriesId = penalties[0]?.seriesId;
      if (!seriesId) {
        continue;
      }

      const seriesEvents = await getSeriesEvents(seriesId);
      const upcomingEvents = seriesEvents.filter((event) => event.eventDate >= now);
      const uniqueUpcomingEvents: any[] = [];
      const seenEventNumbers = new Set<number>();
      for (const event of upcomingEvents) {
        if (typeof event.eventNumber === "number") {
          if (seenEventNumbers.has(event.eventNumber)) {
            continue;
          }
          seenEventNumbers.add(event.eventNumber);
        }
        uniqueUpcomingEvents.push(event);
      }

      const unservedBySeverity = penalties
        .filter((penalty) => !penalty.isServed)
        .sort((a, b) =>
          comparePenaltySeverity(
            { thresholdValue: a.threshold ?? 0, assignedAt: a.assignedAt },
            { thresholdValue: b.threshold ?? 0, assignedAt: b.assignedAt },
          ),
        );

      unservedBySeverity.forEach((penalty, index) => {
        penalty.expectedServeDate = uniqueUpcomingEvents[index]?.eventDate ?? null;
      });
    }

    const grouped = new Map<
      string,
      { seriesId: any; seriesName: string; penalties: any[] }
    >();
    for (const penalty of dedupedActivePenalties as any[]) {
      const key = penalty.seriesId.toString();
      if (!grouped.has(key)) {
        grouped.set(key, {
          seriesId: penalty.seriesId,
          seriesName: penalty.seriesName,
          penalties: [],
        });
      }
      grouped.get(key)!.penalties.push(penalty);
    }

    const groups = Array.from(grouped.values());
    groups.sort((a, b) => a.seriesName.localeCompare(b.seriesName));
    for (const group of groups) {
      group.penalties.sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === "active" ? -1 : 1;
        }
        const driverNameSort = a.driverName.localeCompare(b.driverName);
        if (driverNameSort !== 0) {
          return driverNameSort;
        }
        if (a.pointsAtAssignment !== b.pointsAtAssignment) {
          return b.pointsAtAssignment - a.pointsAtAssignment;
        }
        if (a.threshold !== b.threshold) {
          return (b.threshold ?? 0) - (a.threshold ?? 0);
        }
        return a.assignedAt - b.assignedAt;
      });
    }

    return groups;
  },
});

export const cleanupOrphanedPenalties = internalMutation({
  args: {},
  handler: async (ctx: any) => {
    const driverSeriesPenalties = await ctx.db
      .query("driverSeriesPenalties")
      .collect();

    const toRemove: any[] = [];

    for (const dsp of driverSeriesPenalties) {
      const threshold = await ctx.db.get(dsp.seriesPenaltyThresholdId);

      if (!threshold) {
        toRemove.push({
          _id: dsp._id,
          seriesPenaltyThresholdId: dsp.seriesPenaltyThresholdId,
          seriesPenaltyId: dsp.seriesPenaltyId,
          driverId: dsp.driverId,
        });
      }
    }

    for (const dsp of toRemove) {
      try {
        await ctx.db.delete(dsp._id);
      } catch (error) {
        console.error(`Failed to delete orphaned penalty ${dsp._id}:`, error);
      }
    }

    return {
      totalPenalties: driverSeriesPenalties.length,
      orphanedCount: toRemove.length,
      removedCount: toRemove.length,
      removed: toRemove,
    };
  },
});

export const cleanupDuplicateSeriesPenalties = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
    seriesId: v.optional(v.id("series")),
  },
  handler: async (ctx: any, args) => {
    const dryRun = args.dryRun ?? true;
    const now = Date.now();

    const driverSeriesPenalties = args.seriesId
      ? await ctx.db
          .query("driverSeriesPenalties")
          .withIndex("by_series", (q: any) => q.eq("seriesId", args.seriesId))
          .collect()
      : await ctx.db.query("driverSeriesPenalties").collect();

    const groups = new Map<string, any[]>();
    for (const dsp of driverSeriesPenalties) {
      const key = `${dsp.driverId.toString()}:${dsp.seriesId.toString()}:${dsp.seriesPenaltyId.toString()}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(dsp);
    }

    const thresholdCache = new Map<string, number>();
    const getThreshold = async (thresholdId: any): Promise<number> => {
      const key = thresholdId.toString();
      if (!thresholdCache.has(key)) {
        const thresholdDoc = await ctx.db.get(thresholdId);
        thresholdCache.set(key, getThresholdValue(thresholdDoc));
      }
      return thresholdCache.get(key) ?? 0;
    };

    const summary = {
      dryRun,
      totalPenalties: driverSeriesPenalties.length,
      duplicateGroups: 0,
      penaltiesMarkedForRemoval: 0,
      penaltiesRemoved: 0,
      raceBanReviewsRelinked: 0,
      groups: [] as any[],
    };

    for (const [groupKey, entries] of groups.entries()) {
      if (entries.length <= 1) {
        continue;
      }

      summary.duplicateGroups += 1;

      const scored = await Promise.all(
        entries.map(async (dsp) => {
          const linkedReviews = await ctx.db
            .query("raceBanReviews")
            .withIndex("by_driver_series_penalty", (q: any) =>
              q.eq("driverSeriesPenaltyId", dsp._id),
            )
            .collect();
          const thresholdValue = await getThreshold(dsp.seriesPenaltyThresholdId);

          return {
            dsp,
            thresholdValue,
            linkedReviews,
          };
        }),
      );

      scored.sort((a, b) => {
        if (a.dsp.isServed !== b.dsp.isServed) {
          return a.dsp.isServed ? 1 : -1;
        }
        if (a.thresholdValue !== b.thresholdValue) {
          return b.thresholdValue - a.thresholdValue;
        }
        if (a.dsp.assignedAt !== b.dsp.assignedAt) {
          return b.dsp.assignedAt - a.dsp.assignedAt;
        }
        return b.linkedReviews.length - a.linkedReviews.length;
      });

      const keeper = scored[0];
      const duplicates = scored.slice(1);
      summary.penaltiesMarkedForRemoval += duplicates.length;

      const groupResult = {
        groupKey,
        keeperId: keeper.dsp._id,
        duplicateIds: duplicates.map((item) => item.dsp._id),
        relinkedReviewIds: [] as any[],
      };

      if (!dryRun) {
        for (const duplicate of duplicates) {
          for (const review of duplicate.linkedReviews) {
            await ctx.db.patch(review._id, {
              driverSeriesPenaltyId: keeper.dsp._id,
              updatedAt: now,
            });
            groupResult.relinkedReviewIds.push(review._id);
            summary.raceBanReviewsRelinked += 1;
          }

          if (
            duplicate.dsp.raceBanReviewId &&
            !groupResult.relinkedReviewIds.some(
              (id) => id.toString() === duplicate.dsp.raceBanReviewId.toString(),
            )
          ) {
            const reviewByField = await ctx.db.get(duplicate.dsp.raceBanReviewId);
            if (reviewByField) {
              await ctx.db.patch(reviewByField._id, {
                driverSeriesPenaltyId: keeper.dsp._id,
                updatedAt: now,
              });
              groupResult.relinkedReviewIds.push(reviewByField._id);
              summary.raceBanReviewsRelinked += 1;
            }
          }

          await ctx.db.delete(duplicate.dsp._id);
          summary.penaltiesRemoved += 1;
        }

        if (groupResult.relinkedReviewIds.length > 0) {
          await ctx.db.patch(keeper.dsp._id, {
            raceBanReviewId: groupResult.relinkedReviewIds[0],
          });
        }
      }

      summary.groups.push(groupResult);
    }

    return summary;
  },
});
