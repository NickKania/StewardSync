import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { checkUserDriverConflict } from "./lib/reports";
import { UserFacingError } from "./lib/errors";
import { Result, success, failure } from "./lib/result";
import { requireRole } from "./lib/auth";
import { reportCounter } from "./reportCounter";

export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("reviewed"),
        v.literal("finalized"),
        v.literal("rejected"),
      ),
    ),
    eventId: v.optional(v.id("events")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let reports = await ctx.db.query("reports").order("desc").collect();

    if (args.status) {
      reports = reports.filter((r) => r.status === args.status);
    }

    if (args.eventId) {
      reports = reports.filter((r) => r.eventId === args.eventId);
    }

    if (args.limit) {
      reports = reports.slice(0, args.limit);
    }

    const populatedReports = await Promise.all(
      reports.map(async (report) => {
        const reportingDriver = report.reportingDriverId
          ? await ctx.db.get(report.reportingDriverId)
          : null;
        const reportingUser = report.reportingUserId
          ? await ctx.db.get(report.reportingUserId)
          : null;
        const reportedDriver = report.reportedDriverId
          ? await ctx.db.get(report.reportedDriverId)
          : null;
        const event = report.eventId ? await ctx.db.get(report.eventId) : null;
        const race = report.raceId ? await ctx.db.get(report.raceId) : null;

        const reviews = await ctx.db
          .query("reviews")
          .withIndex("by_report", (q) => q.eq("reportId", report._id))
          .collect();

        let atFaultDriver = report.atFaultDriverId
          ? await ctx.db.get(report.atFaultDriverId)
          : null;

        if (!atFaultDriver && reviews.length > 0) {
          const latestReview = reviews.reduce((latest, current) => {
            const latestDate = latest.reviewDate || latest.createdAt || 0;
            const currentDate = current.reviewDate || current.createdAt || 0;
            return currentDate > latestDate ? current : latest;
          });

          if (latestReview.atFaultDriverId) {
            atFaultDriver = await ctx.db.get(latestReview.atFaultDriverId);
          }
        }

        return {
          ...report,
          reportingDriver,
          reportingUser,
          reportedDriver,
          atFaultDriver,
          event,
          race,
        };
      }),
    );

    return populatedReports;
  },
});

export const getById = query({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) return null;

    const reportingDriver = report.reportingDriverId
      ? await ctx.db.get(report.reportingDriverId)
      : null;
    const reportingUser = report.reportingUserId
      ? await ctx.db.get(report.reportingUserId)
      : null;
    const finalizedByUser = report.finalizedBy
      ? await ctx.db.get(report.finalizedBy)
      : null;
    const editedByUser = report.editedBy
      ? await ctx.db.get(report.editedBy)
      : null;
    const reportedDriver = report.reportedDriverId
      ? await ctx.db.get(report.reportedDriverId)
      : null;

    const reportReviews = await ctx.db
      .query("reviews")
      .withIndex("by_report", (q) => q.eq("reportId", args.reportId))
      .collect();

    let atFaultDriver = report.atFaultDriverId
      ? await ctx.db.get(report.atFaultDriverId)
      : null;

    if (!atFaultDriver && reportReviews.length > 0) {
      const latestReview = reportReviews.reduce((latest, current) => {
        const latestDate = latest.reviewDate || latest.createdAt || 0;
        const currentDate = current.reviewDate || current.createdAt || 0;
        return currentDate > latestDate ? current : latest;
      });

      if (latestReview.atFaultDriverId) {
        atFaultDriver = await ctx.db.get(latestReview.atFaultDriverId);
      }
    }

    const event = report.eventId ? await ctx.db.get(report.eventId) : null;
    const race = report.raceId ? await ctx.db.get(report.raceId) : null;

    let eventWithSeries: any = event;
    if (event) {
      const series = await ctx.db.get(event.seriesId);
      eventWithSeries = { ...event, series };
    }

    let appliedPenaltyObj = null;
    if (report.appliedPenalty) {
      appliedPenaltyObj = await ctx.db.get(report.appliedPenalty as any);
    }

    const reviewsWithUsers = await Promise.all(
      reportReviews.map(async (review) => {
        const [user, secondSteward, linkedReview] = await Promise.all([
          ctx.db.get(review.userId),
          (review as any).secondStewardId
            ? ctx.db.get((review as any).secondStewardId)
            : null,
          review.linkedReviewId ? ctx.db.get(review.linkedReviewId) : null,
        ]);

        const linkedReviewWithReviewer = linkedReview
          ? {
              ...linkedReview,
              reviewer: linkedReview.userId
                ? await ctx.db.get(linkedReview.userId)
                : null,
            }
          : null;

        let recommendedPenaltyObj = null;
        if (review.recommendedPenalty) {
          recommendedPenaltyObj = await ctx.db.get(
            review.recommendedPenalty as any,
          );
        }

        return {
          ...review,
          reviewer: user,
          recommendedPenaltyObj,
          secondSteward,
          linkedReview: linkedReviewWithReviewer,
        };
      }),
    );

    return {
      ...report,
      reportingDriver,
      reportingUser,
      finalizedByUser,
      editedByUser,
      reportedDriver,
      atFaultDriver,
      event: eventWithSeries,
      race,
      appliedPenaltyObj,
      reviews: reviewsWithUsers,
    };
  },
});

export const getPendingForReview = query({
  args: {},
  handler: async (ctx) => {
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .collect();

    const populatedReports = await Promise.all(
      reports.map(async (report) => {
        const reportingDriver = report.reportingDriverId
          ? await ctx.db.get(report.reportingDriverId)
          : null;
        const reportingUser = report.reportingUserId
          ? await ctx.db.get(report.reportingUserId)
          : null;
        const reportedDriver = report.reportedDriverId
          ? await ctx.db.get(report.reportedDriverId)
          : null;
        const event = report.eventId ? await ctx.db.get(report.eventId) : null;
        const race = report.raceId ? await ctx.db.get(report.raceId) : null;

        const reviews = await ctx.db
          .query("reviews")
          .withIndex("by_report", (q) => q.eq("reportId", report._id))
          .collect();

        const reviewCount = reviews.length;

        let atFaultDriver = report.atFaultDriverId
          ? await ctx.db.get(report.atFaultDriverId)
          : null;

        if (!atFaultDriver && reviews.length > 0) {
          const latestReview = reviews.reduce((latest, current) => {
            const latestDate = latest.reviewDate || latest.createdAt || 0;
            const currentDate = current.reviewDate || current.createdAt || 0;
            return currentDate > latestDate ? current : latest;
          });

          if (latestReview.atFaultDriverId) {
            atFaultDriver = await ctx.db.get(latestReview.atFaultDriverId);
          }
        }

        return {
          ...report,
          reportingDriver,
          reportingUser,
          reportedDriver,
          atFaultDriver,
          event,
          race,
          reviewCount,
        };
      }),
    );

    return populatedReports;
  },
});

export const getReadyForFinalization = query({
  args: {},
  handler: async (ctx) => {
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_status")
      .filter((q) => q.eq(q.field("status"), "reviewed"))
      .order("desc")
      .collect();

    const populatedReports = await Promise.all(
      reports.map(async (report) => {
        const reportingDriver = report.reportingDriverId
          ? await ctx.db.get(report.reportingDriverId)
          : null;
        const reportingUser = report.reportingUserId
          ? await ctx.db.get(report.reportingUserId)
          : null;
        const reportedDriver = report.reportedDriverId
          ? await ctx.db.get(report.reportedDriverId)
          : null;

        const reviews = await ctx.db
          .query("reviews")
          .withIndex("by_report", (q) => q.eq("reportId", report._id))
          .collect();

        const reviewCount = reviews.length;

        // Get atFaultDriverId from latest review if not set on report
        let atFaultDriver = report.atFaultDriverId
          ? await ctx.db.get(report.atFaultDriverId)
          : null;

        if (!atFaultDriver && reviews.length > 0) {
          const latestReview = reviews.reduce((latest, current) => {
            const latestDate = latest.reviewDate || latest.createdAt || 0;
            const currentDate = current.reviewDate || current.createdAt || 0;
            return currentDate > latestDate ? current : latest;
          });

          if (latestReview.atFaultDriverId) {
            atFaultDriver = await ctx.db.get(latestReview.atFaultDriverId);
          }
        }

        const event = report.eventId ? await ctx.db.get(report.eventId) : null;
        const race = report.raceId ? await ctx.db.get(report.raceId) : null;

        return {
          ...report,
          reportingDriver,
          reportingUser,
          reportedDriver,
          atFaultDriver,
          event,
          race,
          reviewCount,
        };
      }),
    );

    return populatedReports;
  },
});

export const create = mutation({
  args: {
    reportingUserId: v.optional(v.id("users")),
    reportingDriverId: v.optional(v.id("drivers")),
    reportedDriverId: v.id("drivers"),
    eventId: v.id("events"),
    raceId: v.id("races"),
    lap: v.string(),
    turn: v.string(),
    description: v.string(),
    videoTimestamp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate that reporting and reported drivers are different if reportingDriverId is provided
    if (
      args.reportingDriverId &&
      args.reportingDriverId === args.reportedDriverId
    ) {
      throw new Error("Reporting and reported driver cannot be the same");
    }

    // Validate reporting driver exists if provided
    if (args.reportingDriverId) {
      const reportingDriver = await ctx.db.get(args.reportingDriverId);
      if (!reportingDriver) throw new Error("Reporting driver not found");
    }

    // Validate all referenced entities exist
    const [reportedDriver, event, race] = await Promise.all([
      ctx.db.get(args.reportedDriverId),
      ctx.db.get(args.eventId),
      ctx.db.get(args.raceId),
    ]);

    if (!reportedDriver) throw new Error("Reported driver not found");
    if (!event) throw new Error("Event not found");
    if (!race) throw new Error("Race not found");

    // Validate race belongs to event
    if (race.eventId !== args.eventId) {
      throw new Error("Race does not belong to the selected event");
    }

    // Check if series is locked
    const series = await ctx.db.get(event.seriesId);
    if (series && series.isReportingLocked === true) {
      throw new UserFacingError("Reports have been locked for this series");
    }

    // Generate next reportId using sharded counter
    await reportCounter.inc(ctx, "reportId");
    const nextReportId = await reportCounter.count(ctx, "reportId");

    const now = Date.now();
    const reportId = await ctx.db.insert("reports", {
      reportingUserId: args.reportingUserId,
      reportingDriverId: args.reportingDriverId,
      reportedDriverId: args.reportedDriverId,
      eventId: args.eventId,
      raceId: args.raceId,
      lap: args.lap,
      turn: args.turn,
      description: args.description,
      videoTimestamp: args.videoTimestamp,
      reportDate: now,
      status: "pending",
      isFinalized: false,
      reportId: nextReportId,
      createdAt: now,
      updatedAt: now,
    });

    return reportId;
  },
});

export const update = mutation({
  args: {
    reportId: v.id("reports"),
    lap: v.optional(v.string()),
    turn: v.optional(v.string()),
    description: v.optional(v.string()),
    videoTimestamp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { reportId, ...updates } = args;

    const report = await ctx.db.get(reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    if (report.isFinalized) {
      throw new UserFacingError("Cannot edit a finalized report");
    }

    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined),
    );

    await ctx.db.patch(reportId, {
      ...cleanUpdates,
      updatedAt: Date.now(),
    });

    return reportId;
  },
});

export const markAsReviewed = mutation({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    // Check if there's at least one review
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_report", (q) => q.eq("reportId", args.reportId))
      .collect();

    if (reviews.length === 0) {
      throw new UserFacingError(
        "Report must have at least one review before marking as reviewed",
      );
    }

    await ctx.db.patch(args.reportId, {
      status: "reviewed",
      updatedAt: Date.now(),
    });

    return args.reportId;
  },
});

export const finalize = mutation({
  args: {
    reportId: v.id("reports"),
    userId: v.id("users"),
    finalDecision: v.string(),
    appliedPenalty: v.string(),
    atFaultDriverId: v.optional(v.id("drivers")),
    officialNotes: v.string(),
    isSelfReport: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    if (report.isFinalized) {
      return failure("Report is already finalized");
    }

    // Check if finalizing user has driver conflict
    const finalizerConflict = await checkUserDriverConflict(
      ctx,
      args.userId,
      report,
    );
    if (finalizerConflict.hasConflict) {
      const getConflictTypeText = (type: string) => {
        if (type === "reporting_user") return "reporting user";
        if (type === "reporting_driver") return "reporting driver";
        return "reported driver";
      };
      return failure(
        `You cannot finalize this report because you are involved as the ${getConflictTypeText(finalizerConflict.conflictType!)}${finalizerConflict.driverName ? ` (${finalizerConflict.driverName})` : ""}.`,
      );
    }

    const now = Date.now();
    await ctx.db.patch(args.reportId, {
      status: "finalized",
      isFinalized: true,
      finalDecision: args.finalDecision,
      appliedPenalty: args.appliedPenalty,
      atFaultDriverId: args.atFaultDriverId,
      officialNotes: args.officialNotes,
      isSelfReport: args.isSelfReport,
      finalizedBy: args.userId,
      finalizedAt: now,
      updatedAt: now,
    });

    const event = await ctx.db.get(report.eventId);
    if (event) {
      const events = await ctx.db
        .query("events")
        .withIndex("by_series", (q) => q.eq("seriesId", event.seriesId))
        .collect();

      const drivers = await ctx.db
        .query("drivers")
        .withIndex("by_championship", (q) =>
          q.eq("championshipId", event.seriesId),
        )
        .collect();

      const penaltyAccumulator: Record<string, number> = {};

      for (const evt of events) {
        const evtReports = await ctx.db
          .query("reports")
          .withIndex("by_event", (q) => q.eq("eventId", evt._id))
          .collect();

        const finalizedReports = evtReports.filter(
          (r) => r.status === "finalized",
        );

        for (const finalizedReport of finalizedReports) {
          let penalty: any = null;
          if (finalizedReport.appliedPenalty) {
            penalty = await ctx.db.get(finalizedReport.appliedPenalty as any);
          }

          const points = penalty?.licensePoints ?? 0;
          const driverId =
            finalizedReport.atFaultDriverId?.toString() ||
            finalizedReport.reportedDriverId.toString();

          if (penaltyAccumulator[driverId]) {
            penaltyAccumulator[driverId] += points;
          } else {
            penaltyAccumulator[driverId] = points;
          }
        }
      }

      const seriesPenalties = await ctx.db
        .query("seriesPenalties")
        .withIndex("by_series", (q) => q.eq("seriesId", event.seriesId))
        .collect();

      for (const driver of drivers) {
        const driverId = driver._id.toString();
        const totalPoints = penaltyAccumulator[driverId] ?? 0;
        const driverClassId = driver.driverClassId || null;

        console.log(`[FINALIZE] Checking driver ${driver.driverNumber} (${driverId}): totalPoints=${totalPoints}, driverClassId=${driverClassId}`);

        const existingDriverSeriesPenalties = await ctx.db
          .query("driverSeriesPenalties")
          .withIndex("by_driver_and_series", (q) =>
            q.eq("driverId", driver._id).eq("seriesId", event.seriesId),
          )
          .collect();

        const assignedThresholds = existingDriverSeriesPenalties
          .filter((dsp: any) => !dsp.isServed)
          .map((dsp: any) => dsp.seriesPenaltyThresholdId.toString());

        console.log(`[FINALIZE] Driver ${driver.driverNumber} has ${existingDriverSeriesPenalties.length} existing penalties, ${assignedThresholds.length} unserved`);

        for (const seriesPenalty of seriesPenalties) {
          const thresholds = await ctx.db
            .query("seriesPenaltyThresholds")
            .withIndex("by_series_penalty", (q) =>
              q.eq("seriesPenaltyId", seriesPenalty._id),
            )
            .collect();

          for (const threshold of thresholds) {
            const appliesToDriver = driverClassId && threshold.driverClassIds && threshold.driverClassIds.includes(driverClassId as any);
            const thresholdMet = totalPoints >= threshold.threshold;
            const alreadyAssigned = assignedThresholds.includes(threshold._id.toString());

            console.log(`[FINALIZE] Checking threshold for ${seriesPenalty.penaltyName}: applies=${appliesToDriver}, threshold=${threshold.threshold}, met=${thresholdMet}, alreadyAssigned=${alreadyAssigned}`);

            if (appliesToDriver && thresholdMet && !alreadyAssigned) {
              console.log(`[FINALIZE] >>> ASSIGNING penalty ${seriesPenalty.penaltyName} to driver ${driver.driverNumber}`);
              const insertedId = await ctx.db.insert("driverSeriesPenalties", {
                driverId: driver._id,
                seriesId: event.seriesId,
                seriesPenaltyId: seriesPenalty._id,
                seriesPenaltyThresholdId: threshold._id,
                isServed: false,
                pointsAtAssignment: totalPoints,
                assignedAt: Date.now(),
              });
              console.log(`[FINALIZE] >>> ASSIGNED with ID: ${insertedId}`);
            }
          }
        }
      }
    }

    return success(args.reportId);
  },
});

export const updateFinalizedDecision = mutation({
  args: {
    reportId: v.id("reports"),
    userId: v.id("users"),
    finalDecision: v.string(),
    appliedPenalty: v.string(),
    atFaultDriverId: v.optional(v.id("drivers")),
    officialNotes: v.string(),
    isSelfReport: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    if (!report.isFinalized) {
      throw new UserFacingError(
        "Cannot edit a report that has not been finalized",
      );
    }

    await requireRole(ctx, args.userId, ["head_steward", "league_manager"]);

    const now = Date.now();
    await ctx.db.patch(args.reportId, {
      finalDecision: args.finalDecision,
      appliedPenalty: args.appliedPenalty,
      atFaultDriverId: args.atFaultDriverId,
      officialNotes: args.officialNotes,
      isSelfReport: args.isSelfReport,
      isEdited: true,
      editedBy: args.userId,
      editedAt: now,
      updatedAt: now,
    });

    return success(args.reportId);
  },
});

export const createBySteward = mutation({
  args: {
    reportingUserId: v.id("users"),
    reportedDriverId: v.id("drivers"),
    eventId: v.id("events"),
    raceId: v.id("races"),
    lap: v.string(),
    turn: v.string(),
    description: v.string(),
    incidentDescription: v.string(),
    reviewNotes: v.optional(v.string()),
    recommendedPenalty: v.string(),
    atFaultDriverId: v.optional(v.id("drivers")),
    videoTimestamp: v.optional(v.string()),
    secondStewardId: v.optional(v.id("users")),
    isSelfReport: v.optional(v.boolean()),
    isAdjusted: v.optional(v.boolean()),
    candidateForStandardization: v.optional(v.boolean()),
    adjustedReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if series is locked
    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found");
    }
    const series = await ctx.db.get(event.seriesId);
    if (series && series.isReportingLocked === true) {
      throw new UserFacingError("Reports have been locked for this series");
    }

    // Get all drivers linked to reporting user
    const reportingUserDrivers = await ctx.db
      .query("drivers")
      .withIndex("by_user_id", (q: any) => q.eq("userId", args.reportingUserId))
      .collect();

    const reportingUserDriverIds = reportingUserDrivers.map((d: any) => d._id);

    // Check if reporting steward is the reported driver
    if (
      reportingUserDriverIds.some((id: any) => id === args.reportedDriverId)
    ) {
      const conflictDriver = reportingUserDrivers.find(
        (d: any) => d._id === args.reportedDriverId,
      );
      return failure(
        `You cannot create a steward incident for yourself. You are the reported driver (${conflictDriver?.driverName}).`,
      );
    }

    // Check if second steward has driver conflict
    if (args.secondStewardId) {
      const secondStewardDrivers = await ctx.db
        .query("drivers")
        .withIndex("by_user_id", (q: any) =>
          q.eq("userId", args.secondStewardId),
        )
        .collect();

      const secondStewardDriverIds = secondStewardDrivers.map(
        (d: any) => d._id,
      );

      if (
        secondStewardDriverIds.some((id: any) => id === args.reportedDriverId)
      ) {
        const conflictDriver = secondStewardDrivers.find(
          (d: any) => d._id === args.reportedDriverId,
        );
        const secondSteward = await ctx.db.get(args.secondStewardId);
        return failure(
          `${secondSteward?.name || "The second steward"} cannot review this report because they are the reported driver (${conflictDriver?.driverName}).`,
        );
      }
    }

    // Generate next reportId using sharded counter
    await reportCounter.inc(ctx, "reportId");
    const nextReportId = await reportCounter.count(ctx, "reportId");

    const reportId = await ctx.db.insert("reports", {
      reportingUserId: args.reportingUserId,
      reportedDriverId: args.reportedDriverId,
      eventId: args.eventId,
      raceId: args.raceId,
      lap: args.lap,
      turn: args.turn,
      description: args.description,
      videoTimestamp: args.videoTimestamp,
      reportDate: now,
      status: "pending",
      isFinalized: false,
      reportId: nextReportId,
      isSelfReport: args.isSelfReport,
      isStewardReported: true,
      createdAt: now,
      updatedAt: now,
    });

    const reviewData = {
      userId: args.reportingUserId,
      reportId: reportId,
      incidentDescription: args.incidentDescription,
      reviewNotes: args.reviewNotes || "",
      recommendedPenalty: args.recommendedPenalty,
      atFaultDriverId: args.atFaultDriverId,
      videoTimestamp: args.videoTimestamp,
      isSelfReport: args.isSelfReport,
      isAdjusted: args.isAdjusted,
      candidateForStandardization: args.candidateForStandardization,
      adjustedReason: args.adjustedReason,
      reviewDate: now,
      createdAt: now,
      updatedAt: now,
    };

    const primaryReviewId = await ctx.db.insert("reviews", reviewData);

    if (args.secondStewardId) {
      const secondReviewId = await ctx.db.insert("reviews", {
        ...reviewData,
        userId: args.secondStewardId,
        linkedReviewId: primaryReviewId,
      });

      await ctx.db.patch(primaryReviewId, { linkedReviewId: secondReviewId });

      await ctx.db.patch(reportId, {
        status: "reviewed",
        updatedAt: now,
      });
    }

    return success(reportId);
  },
});

export const reject = mutation({
  args: {
    reportId: v.id("reports"),
    officialNotes: v.string(),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    if (report.isFinalized) {
      return failure("Report is already finalized");
    }

    await ctx.db.patch(args.reportId, {
      status: "rejected",
      isFinalized: true,
      officialNotes: args.officialNotes,
      updatedAt: Date.now(),
    });

    return success(args.reportId);
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const reports = await ctx.db.query("reports").collect();

    return {
      total: reports.length,
      pending: reports.filter((r) => r.status === "pending").length,
      reviewed: reports.filter((r) => r.status === "reviewed").length,
      finalized: reports.filter((r) => r.status === "finalized").length,
      rejected: reports.filter((r) => r.status === "rejected").length,
    };
  },
});

export const getDriverFinalizedReports = query({
  args: {
    driverId: v.id("drivers"),
    limit: v.optional(v.number()),
    skip: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let reports = await ctx.db
      .query("reports")
      .withIndex("by_reporting_driver", (q) =>
        q.eq("reportingDriverId", args.driverId),
      )
      .filter((q) => q.eq(q.field("status"), "finalized"))
      .order("desc")
      .collect();

    const total = reports.length;

    if (args.skip) {
      reports = reports.slice(args.skip);
    }
    if (args.limit) {
      reports = reports.slice(0, args.limit);
    }

    const populatedReports = await Promise.all(
      reports.map(async (report) => {
        const reportingDriver = report.reportingDriverId
          ? await ctx.db.get(report.reportingDriverId)
          : null;
        const reportedDriver = report.reportedDriverId
          ? await ctx.db.get(report.reportedDriverId)
          : null;
        const event = report.eventId ? await ctx.db.get(report.eventId) : null;
        const race = report.raceId ? await ctx.db.get(report.raceId) : null;

        let appliedPenaltyObj = null;
        if (report.appliedPenalty) {
          appliedPenaltyObj = await ctx.db.get(report.appliedPenalty as any);
        }

        return {
          ...report,
          reportingDriver,
          reportedDriver,
          event,
          race,
          appliedPenalty: appliedPenaltyObj,
        };
      }),
    );

    return { reports: populatedReports, total };
  },
});

export const getDriverIndividualPenalties = query({
  args: { driverId: v.id("drivers") },
  handler: async (ctx, args) => {
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_reported_driver", (q) =>
        q.eq("reportedDriverId", args.driverId),
      )
      .filter((q) => q.eq(q.field("status"), "finalized"))
      .collect();

    const penalties = await Promise.all(
      reports.map(async (report) => {
        const [event, race, appliedPenalty] = await Promise.all([
          ctx.db.get(report.eventId),
          ctx.db.get(report.raceId),
          report.appliedPenalty
            ? await ctx.db.get(report.appliedPenalty as any)
            : null,
        ]);

        return {
          reportId: report.reportId || null,
          reportDate: report.reportDate,
          finalizedAt: report.finalizedAt ?? report.reportDate,
          event,
          race,
          lap: report.lap,
          turn: report.turn,
          appliedPenalty,
          finalDecision: report.finalDecision,
        };
      }),
    );

    const penaltiesWithPenalty = penalties.filter(
      (p) => p.appliedPenalty !== null,
    );

    return penaltiesWithPenalty.sort((a, b) => {
      const pointsA = (a.appliedPenalty as any)?.licensePoints ?? 0;
      const pointsB = (b.appliedPenalty as any)?.licensePoints ?? 0;

      if (pointsA !== pointsB) {
        return pointsB - pointsA;
      }

      return b.finalizedAt - a.finalizedAt;
    });
  },
});

// Debug queries
export const debugReportState = query({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    console.log(`[DEBUG] Getting debug state for report: ${args.reportId}`);

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      console.log(`[DEBUG] Report not found: ${args.reportId}`);
      return null;
    }

    console.log(`[DEBUG] Report fields:`, {
      reportingUserId: report.reportingUserId,
      reportingDriverId: report.reportingDriverId,
      reportedDriverId: report.reportedDriverId,
      status: report.status,
      isFinalized: report.isFinalized,
    });

    const [reportingDriver, reportedDriver, reportingUser, event, race] =
      await Promise.all([
        report.reportingDriverId ? ctx.db.get(report.reportingDriverId) : null,
        ctx.db.get(report.reportedDriverId),
        report.reportingUserId ? ctx.db.get(report.reportingUserId) : null,
        ctx.db.get(report.eventId),
        ctx.db.get(report.raceId),
      ]);

    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_report", (q) => q.eq("reportId", args.reportId))
      .collect();

    const reviewsWithUsers = await Promise.all(
      reviews.map(async (review) => {
        const user = await ctx.db.get(review.userId);
        return {
          ...review,
          user,
        };
      }),
    );

    return {
      report,
      reportingDriver: reportingDriver
        ? {
            driverId: reportingDriver._id,
            driverNumber: reportingDriver.driverNumber,
            driverName: reportingDriver.driverName,
            driverClass: reportingDriver.driverClass,
            username: reportingDriver.username,
            externalId: reportingDriver.externalId,
            userId: reportingDriver.userId,
          }
        : null,
      reportedDriver: reportedDriver
        ? {
            driverId: reportedDriver._id,
            driverNumber: reportedDriver.driverNumber,
            driverName: reportedDriver.driverName,
            driverClass: reportedDriver.driverClass,
            username: reportedDriver.username,
            externalId: reportedDriver.externalId,
            userId: reportedDriver.userId,
          }
        : null,
      reportingUser: reportingUser
        ? {
            userId: reportingUser._id,
            name: reportingUser.name,
            email: reportingUser.email,
            roleId: reportingUser.roleId,
            discordId: reportingUser.discordId,
            discordUsername: reportingUser.discordUsername,
          }
        : null,
      event,
      race,
      reviews: reviewsWithUsers,
    };
  },
});
