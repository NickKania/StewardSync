import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { UserFacingError } from "./lib/errors";
import { getCurrentUserRole } from "./lib/auth";

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
        let penalty: any = null;
        if (report.appliedPenalty) {
          penalty = await ctx.db.get(report.appliedPenalty as any);
        }

        const points = penalty?.licensePoints ?? 0;
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

      const assignedThresholds: any[] = [];
      for (const dsp of existingDriverSeriesPenalties) {
        const linkedReview = await getLinkedRaceBanReview(ctx, dsp);
        const threshold = await ctx.db.get(dsp.seriesPenaltyThresholdId);
        const requiresReview =
          dsp.requiresReview ?? threshold?.requiresReview ?? false;
        if (isPenaltyStillActive({ ...dsp, requiresReview }, linkedReview)) {
          assignedThresholds.push(dsp.seriesPenaltyThresholdId);
        }
      }

      for (const seriesPenalty of seriesPenalties) {
        const thresholds = await ctx.db
          .query("seriesPenaltyThresholds")
          .withIndex("by_series_penalty", (q) =>
            q.eq("seriesPenaltyId", seriesPenalty._id),
          )
          .collect();

        for (const threshold of thresholds) {
          // Check if driver's class is in the threshold's driverClassIds
          const appliesToDriver = driverClassId
            ? threshold.driverClassIds.includes(driverClassId)
            : false;

          if (
            appliesToDriver &&
            totalPoints >= threshold.threshold &&
            !assignedThresholds.includes(threshold._id)
          ) {
            const driverSeriesPenaltyId = await ctx.db.insert(
              "driverSeriesPenalties",
              {
                driverId: driver._id,
                seriesId: args.seriesId,
                seriesPenaltyId: seriesPenalty._id,
                seriesPenaltyThresholdId: threshold._id,
                isServed: false,
                requiresReview: threshold.requiresReview ?? false,
                pointsAtAssignment: totalPoints,
                assignedAt: Date.now(),
              },
            );

            assignedPenalties.push({
              driverSeriesPenaltyId,
              driverName: driver.driverName,
              driverClass: driverClass?.displayName || "",
              penaltyName: seriesPenalty.penaltyName,
              threshold: threshold.threshold,
              pointsAtAssignment: totalPoints,
            });
          }
        }
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
          seriesId: dsp.seriesId,
          seriesName: series?.name ?? "Unknown Series",
          driverName: driver?.driverName ?? "Unknown Driver",
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

    const grouped = new Map<
      string,
      { seriesId: any; seriesName: string; penalties: any[] }
    >();
    for (const penalty of activePenalties as any[]) {
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
        return b.assignedAt - a.assignedAt;
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
