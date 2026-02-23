import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { checkUserDriverConflict } from "./lib/reports";
import { UserFacingError } from "./lib/errors";
import { Result, success, failure } from "./lib/result";
import { requireRole } from "./lib/auth";
import { reportCounter } from "./reportCounter";
import { recordChanges, compareAndBuildChanges } from "./lib/audit";

const REPORT_AUDIT_FIELDS = [
  "isSelfReport",
  "isAdjusted",
  "adjustedReason",
  "appliedPenalty",
  "atFaultDriverId",
  "finalDecision",
  "isNoDriverAtFault",
] as const;

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
    const populateDriverWithClass = async (
      driverId: Id<"drivers"> | null | undefined,
    ) => {
      if (!driverId) return null;
      const driver = await ctx.db.get(driverId);
      if (!driver) return null;

      const driverClass = driver.driverClassId
        ? await ctx.db.get(driver.driverClassId)
        : null;

      return {
        ...driver,
        driverClass: driverClass?.displayName ?? null,
        driverClassObj: driverClass,
      };
    };

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
        const reportedDriver = await populateDriverWithClass(
          report.reportedDriverId,
        );

        const reviews = await ctx.db
          .query("reviews")
          .withIndex("by_report", (q) => q.eq("reportId", report._id))
          .collect();

        const reviewCount = reviews.length;

        // Get atFaultDriverId from latest review if not set on report
        let atFaultDriver = await populateDriverWithClass(report.atFaultDriverId);

        if (!atFaultDriver && reviews.length > 0) {
          const latestReview = reviews.reduce((latest, current) => {
            const latestDate = latest.reviewDate || latest.createdAt || 0;
            const currentDate = current.reviewDate || current.createdAt || 0;
            return currentDate > latestDate ? current : latest;
          });

          if (latestReview.atFaultDriverId) {
            atFaultDriver = await populateDriverWithClass(
              latestReview.atFaultDriverId,
            );
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
    if (!race) throw new Error("Session not found");

    // Validate race belongs to event
    if (race.eventId !== args.eventId) {
      throw new Error("Session does not belong to the selected event");
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
    eventId: v.optional(v.id("events")),
    raceId: v.optional(v.id("races")),
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

    const nextEventId = updates.eventId ?? report.eventId;
    const nextRaceId = updates.raceId ?? report.raceId;

    if (updates.eventId !== undefined) {
      const event = await ctx.db.get(nextEventId);
      if (!event) {
        throw new UserFacingError("Event not found");
      }
    }

    if (updates.raceId !== undefined || updates.eventId !== undefined) {
      const race = await ctx.db.get(nextRaceId);
      if (!race) {
        throw new UserFacingError("Session not found");
      }
      if (race.eventId !== nextEventId) {
        throw new UserFacingError("Selected session does not belong to event");
      }
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
    isNoDriverAtFault: v.optional(v.boolean()),
    officialNotes: v.string(),
    isSelfReport: v.optional(v.boolean()),
    isAdjusted: v.optional(v.boolean()),
    adjustedReason: v.optional(v.string()),
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
    const isNoDriverAtFault = args.isNoDriverAtFault ?? false;
    const effectiveAtFaultDriverId = isNoDriverAtFault
      ? undefined
      : args.atFaultDriverId ?? report.reportedDriverId;

    let appliedPenaltyDoc: any = null;
    if (args.appliedPenalty) {
      appliedPenaltyDoc = await ctx.db.get(args.appliedPenalty as any);
    }

    await ctx.db.patch(args.reportId, {
      status: "finalized",
      isFinalized: true,
      finalDecision: args.finalDecision,
      appliedPenalty: args.appliedPenalty,
      atFaultDriverId: effectiveAtFaultDriverId,
      isNoDriverAtFault,
      officialNotes: args.officialNotes,
      isSelfReport: args.isSelfReport,
      finalizedBy: args.userId,
      finalizedAt: now,
      updatedAt: now,
    });

    const finalizeValues = {
      isSelfReport: args.isSelfReport,
      isAdjusted: args.isAdjusted,
      adjustedReason: args.adjustedReason,
      appliedPenalty: args.appliedPenalty,
      atFaultDriverId: effectiveAtFaultDriverId,
      finalDecision: args.finalDecision,
      isNoDriverAtFault,
    };

    const auditChanges = compareAndBuildChanges(
      report as any,
      finalizeValues,
      REPORT_AUDIT_FIELDS as any,
    );

    if (auditChanges.length > 0) {
      await recordChanges(ctx, {
        tableName: "reports",
        documentId: args.reportId.toString(),
        changes: auditChanges,
        changedByUserId: args.userId,
        source: "manual",
      });
    }

    if (effectiveAtFaultDriverId && appliedPenaltyDoc) {
      const atFaultDriver = await ctx.db.get(effectiveAtFaultDriverId);
      const pointsToAdd = appliedPenaltyDoc.licensePoints ?? 0;

      if (atFaultDriver && pointsToAdd > 0) {
        await ctx.db.patch(effectiveAtFaultDriverId, {
          accumulatedLicensePoints:
            (atFaultDriver.accumulatedLicensePoints || 0) + pointsToAdd,
        });
      }
    }

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
          if (finalizedReport.isNoDriverAtFault) {
            continue;
          }

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

        console.log(
          `[FINALIZE] Checking driver ${driver.driverNumber} (${driverId}): totalPoints=${totalPoints}, driverClassId=${driverClassId}`,
        );

        const existingDriverSeriesPenalties = await ctx.db
          .query("driverSeriesPenalties")
          .withIndex("by_driver_and_series", (q) =>
            q.eq("driverId", driver._id).eq("seriesId", event.seriesId),
          )
          .collect();

        const assignedThresholds: string[] = [];
        for (const dsp of existingDriverSeriesPenalties) {
          const linkedReview = dsp.raceBanReviewId
            ? await ctx.db.get(dsp.raceBanReviewId)
            : await ctx.db
                .query("raceBanReviews")
                .withIndex("by_driver_series_penalty", (q) =>
                  q.eq("driverSeriesPenaltyId", dsp._id),
                )
                .first();
          const thresholdDoc = await ctx.db.get(dsp.seriesPenaltyThresholdId);
          const requiresReview =
            dsp.requiresReview ?? thresholdDoc?.requiresReview ?? false;
          const stillActive =
            !dsp.isServed ||
            (requiresReview && linkedReview?.status !== "completed");
          if (stillActive) {
            assignedThresholds.push(dsp.seriesPenaltyThresholdId.toString());
          }
        }

        console.log(
          `[FINALIZE] Driver ${driver.driverNumber} has ${existingDriverSeriesPenalties.length} existing penalties, ${assignedThresholds.length} unserved`,
        );

        for (const seriesPenalty of seriesPenalties) {
          const thresholds = await ctx.db
            .query("seriesPenaltyThresholds")
            .withIndex("by_series_penalty", (q) =>
              q.eq("seriesPenaltyId", seriesPenalty._id),
            )
            .collect();

          for (const threshold of thresholds) {
            const appliesToDriver =
              driverClassId &&
              threshold.driverClassIds &&
              threshold.driverClassIds.includes(driverClassId as any);
            const thresholdMet = totalPoints >= threshold.threshold;
            const alreadyAssigned = assignedThresholds.includes(
              threshold._id.toString(),
            );

            console.log(
              `[FINALIZE] Checking threshold for ${seriesPenalty.penaltyName}: applies=${appliesToDriver}, threshold=${threshold.threshold}, met=${thresholdMet}, alreadyAssigned=${alreadyAssigned}`,
            );

            if (appliesToDriver && thresholdMet && !alreadyAssigned) {
              console.log(
                `[FINALIZE] >>> ASSIGNING penalty ${seriesPenalty.penaltyName} to driver ${driver.driverNumber}`,
              );
              const insertedId = await ctx.db.insert("driverSeriesPenalties", {
                driverId: driver._id,
                seriesId: event.seriesId,
                seriesPenaltyId: seriesPenalty._id,
                seriesPenaltyThresholdId: threshold._id,
                isServed: false,
                requiresReview: threshold.requiresReview ?? false,
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
    isNoDriverAtFault: v.optional(v.boolean()),
    officialNotes: v.string(),
    isSelfReport: v.optional(v.boolean()),
    isAdjusted: v.optional(v.boolean()),
    adjustedReason: v.optional(v.string()),
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

    const updates = {
      finalDecision: args.finalDecision,
      appliedPenalty: args.appliedPenalty,
      atFaultDriverId: args.isNoDriverAtFault
        ? undefined
        : args.atFaultDriverId,
      isNoDriverAtFault: args.isNoDriverAtFault ?? false,
      officialNotes: args.officialNotes,
      isSelfReport: args.isSelfReport,
    };

    const now = Date.now();
    await ctx.db.patch(args.reportId, {
      ...updates,
      isEdited: true,
      editedBy: args.userId,
      editedAt: now,
      updatedAt: now,
    });

    const auditChanges = compareAndBuildChanges(
      report as any,
      updates as any,
      REPORT_AUDIT_FIELDS as any,
    );

    if (auditChanges.length > 0) {
      await recordChanges(ctx, {
        tableName: "reports",
        documentId: args.reportId.toString(),
        changes: auditChanges,
        changedByUserId: args.userId,
        source: "manual",
      });
    }

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
    description: v.optional(v.string()),
    incidentDescription: v.string(),
    reviewNotes: v.optional(v.string()),
    recommendedPenalty: v.string(),
    atFaultDriverId: v.optional(v.id("drivers")),
    isNoDriverAtFault: v.optional(v.boolean()),
    videoTimestamp: v.optional(v.string()),
    secondStewardId: v.optional(v.id("users")),
    isSelfReport: v.optional(v.boolean()),
    isAdjusted: v.optional(v.boolean()),
    candidateForStandardization: v.optional(v.boolean()),
    adjustedReason: v.optional(v.string()),
    reportNumber: v.optional(v.number()),
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

    const reportId = await ctx.db.insert("reports", {
      reportingUserId: args.reportingUserId,
      reportedDriverId: args.reportedDriverId,
      eventId: args.eventId,
      raceId: args.raceId,
      lap: args.lap,
      turn: args.turn,
      description: args.description ?? args.incidentDescription,
      videoTimestamp: args.videoTimestamp,
      reportDate: now,
      status: "pending",
      isFinalized: false,
      reportId: args.reportNumber,
      isSelfReport: args.isSelfReport,
      isStewardReported: true,
      createdAt: now,
      updatedAt: now,
    });

    // Validate that adjustedReason is provided when isAdjusted is true
    if (
      args.isAdjusted &&
      (!args.adjustedReason || args.adjustedReason.trim() === "")
    ) {
      return failure(
        "Adjusted reason is required when the incident is marked as adjusted",
      );
    }

    const reviewData = {
      userId: args.reportingUserId,
      reportId: reportId,
      incidentDescription: args.incidentDescription,
      reviewNotes: args.reviewNotes || "",
      recommendedPenalty: args.recommendedPenalty,
      atFaultDriverId: args.isNoDriverAtFault
        ? undefined
        : args.atFaultDriverId,
      isNoDriverAtFault: args.isNoDriverAtFault ?? false,
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
    finalDecision: v.string(),
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
      finalDecision: args.finalDecision,
      officialNotes: "",
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

const dashboardStatusValidator = v.union(
  v.literal("pending"),
  v.literal("reviewed"),
  v.literal("finalized"),
  v.literal("rejected"),
);

export const getDashboardStats = query({
  args: {
    seriesId: v.optional(v.id("series")),
  },
  handler: async (ctx, args) => {
    const reports = await ctx.db.query("reports").collect();
    const eventSeriesCache = new Map<string, string | null>();

    const filteredReports = [];
    for (const report of reports) {
      if (!args.seriesId) {
        filteredReports.push(report);
        continue;
      }

      const eventId = report.eventId.toString();
      if (!eventSeriesCache.has(eventId)) {
        const event = await ctx.db.get(report.eventId);
        eventSeriesCache.set(eventId, event?.seriesId?.toString() ?? null);
      }

      if (eventSeriesCache.get(eventId) === args.seriesId.toString()) {
        filteredReports.push(report);
      }
    }

    return {
      total: filteredReports.length,
      pending: filteredReports.filter((r) => r.status === "pending").length,
      reviewed: filteredReports.filter((r) => r.status === "reviewed").length,
      finalized: filteredReports.filter((r) => r.status === "finalized").length,
      rejected: filteredReports.filter((r) => r.status === "rejected").length,
    };
  },
});

export const getPreviousWeekEventStatus = query({
  args: {},
  handler: async (ctx) => {
    const endOfToday = new Date();
    endOfToday.setUTCHours(23, 59, 59, 999);
    const latestAllowedEventDate = endOfToday.getTime();

    const seriesList = await ctx.db.query("series").collect();
    const activeSeries = seriesList.filter(
      (series) => series.isActive !== false,
    );
    const activeSeriesIds = new Set(
      activeSeries.map((series) => series._id.toString()),
    );
    const seriesById = new Map(
      activeSeries.map((series) => [series._id.toString(), series]),
    );

    if (activeSeries.length === 0) {
      return [];
    }

    const events = await ctx.db
      .query("events")
      .withIndex("by_date")
      .order("desc")
      .collect();

    const latestEventBySeries = new Map<string, (typeof events)[number]>();
    for (const event of events) {
      const seriesId = event.seriesId.toString();
      if (!activeSeriesIds.has(seriesId)) {
        continue;
      }

      if (event.eventDate > latestAllowedEventDate) {
        continue;
      }

      const currentLatest = latestEventBySeries.get(seriesId);
      if (
        !currentLatest ||
        event.eventDate > currentLatest.eventDate ||
        (event.eventDate === currentLatest.eventDate &&
          event.createdAt > currentLatest.createdAt)
      ) {
        latestEventBySeries.set(seriesId, event);
      }
    }

    const results = [];
    for (const series of activeSeries) {
      const event = latestEventBySeries.get(series._id.toString());
      if (!event) {
        results.push({
          series: { id: series._id, name: series.name },
          event: null,
          stats: { pending: 0, reviewed: 0, finalized: 0 },
        });
        continue;
      }

      const reports = await ctx.db
        .query("reports")
        .withIndex("by_event", (q) => q.eq("eventId", event._id))
        .collect();

      results.push({
        series: { id: series._id, name: series.name },
        event: {
          eventNumber: event.eventNumber,
          trackName: event.trackName,
          eventDate: event.eventDate,
        },
        stats: {
          pending: reports.filter((report) => report.status === "pending")
            .length,
          reviewed: reports.filter((report) => report.status === "reviewed")
            .length,
          finalized: reports.filter((report) => report.status === "finalized")
            .length,
        },
      });
    }

    return results.sort((a, b) => a.series.name.localeCompare(b.series.name));
  },
});

export const listDashboard = query({
  args: {
    seriesId: v.optional(v.id("series")),
    status: v.optional(dashboardStatusValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_date")
      .order("desc")
      .collect();

    const eventCache = new Map<string, any>();
    const seriesCache = new Map<string, any>();
    const result: any[] = [];

    for (const report of reports) {
      if (args.status && report.status !== args.status) {
        continue;
      }

      const eventId = report.eventId.toString();
      if (!eventCache.has(eventId)) {
        eventCache.set(eventId, await ctx.db.get(report.eventId));
      }
      const event = eventCache.get(eventId);
      if (!event) {
        continue;
      }

      if (args.seriesId && event.seriesId !== args.seriesId) {
        continue;
      }

      const seriesId = event.seriesId.toString();
      if (!seriesCache.has(seriesId)) {
        seriesCache.set(seriesId, await ctx.db.get(event.seriesId));
      }
      const series = seriesCache.get(seriesId);

      result.push({
        _id: report._id,
        reportId: report.reportId ?? null,
        reportDate: report.reportDate,
        status: report.status,
        reportingUserId: report.reportingUserId ?? null,
        seriesId: event.seriesId,
        seriesName: series?.name ?? "Unknown Series",
        eventName: `Event ${event.eventNumber} - ${event.trackName}`,
      });

      if (args.limit && result.length >= args.limit) {
        break;
      }
    }

    return result;
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
          isSelfReport: report.isSelfReport ?? false,
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
export const getEventExportData = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) {
      return [];
    }

    const reports = await ctx.db
      .query("reports")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    const exportRows = await Promise.all(
      reports.map(async (report) => {
        if (report.status !== "finalized" && report.status !== "reviewed") {
          return null;
        }

        let review: any = null;
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

        if (report.status === "reviewed" && !review?.recommendedPenalty) {
          return null;
        }

        const isNoDriverAtFault =
          report.status === "reviewed"
            ? Boolean(review?.isNoDriverAtFault)
            : Boolean(report.isNoDriverAtFault);

        if (isNoDriverAtFault) {
          return null;
        }

        const atFaultDriverId = report.atFaultDriverId || report.reportedDriverId;
        const atFaultDriver = await ctx.db.get(atFaultDriverId);

        if (
          atFaultDriver &&
          (!atFaultDriver.championshipId ||
            atFaultDriver.championshipId !== event.seriesId)
        ) {
          return null;
        }

        let userOfficialName: string | undefined;
        if (atFaultDriver?.userId) {
          const user = await ctx.db.get(atFaultDriver.userId);
          userOfficialName = user?.officialName;
        }
        const displayName = atFaultDriver
          ? (userOfficialName ||
              atFaultDriver.officialName ||
              atFaultDriver.driverName)
          : null;

        let driverClassDisplayName: string | null = null;
        if (atFaultDriver?.driverClassId) {
          const driverClass = await ctx.db.get(atFaultDriver.driverClassId);
          driverClassDisplayName = driverClass?.displayName ?? null;
        }

        let incidentDescription: string;
        if (report.status === "finalized") {
          incidentDescription = report.finalDecision ?? "";
        } else {
          incidentDescription = review?.incidentDescription ?? "";
        }

        let appliedPenalty: any = null;
        if (report.status === "finalized" && report.appliedPenalty) {
          appliedPenalty = await ctx.db.get(report.appliedPenalty as any);
        } else if (report.status === "reviewed" && review?.recommendedPenalty) {
          appliedPenalty = await ctx.db.get(review.recommendedPenalty as any);
        }

        const lapNumber = parseInt(report.lap || "0", 10);
        const isLap1 = !isNaN(lapNumber) && lapNumber === 1;

        let timePenaltySeconds = 0;
        let licensePoints: number | null = null;

        if (appliedPenalty) {
          const baseTimePenalty = isLap1
            ? (appliedPenalty.timePenaltyLap1 ?? appliedPenalty.timePenalty ?? 0)
            : (appliedPenalty.timePenalty ?? 0);
          const selfReportReduction = appliedPenalty.selfReportReduction ?? 0;
          timePenaltySeconds =
            appliedPenalty && report.isSelfReport
              ? Math.max(0, baseTimePenalty - selfReportReduction)
              : baseTimePenalty;
          licensePoints = appliedPenalty.licensePoints ?? null;
        }

        const stewardNames: string[] = [];
        for (const r of reviews) {
          const reviewer = await ctx.db.get(r.userId);
          if (reviewer?.name) {
            stewardNames.push(reviewer.name);
          }
        }

        let finalizedByName: string | null = null;
        if (report.finalizedBy) {
          const finalizedByUser = await ctx.db.get(report.finalizedBy);
          finalizedByName = finalizedByUser?.name ?? null;
        }

        const isAdjusted = review?.isAdjusted ?? false;
        const adjustedReason = isAdjusted ? (review?.adjustedReason ?? "") : "";

        return {
          carNumber: atFaultDriver?.driverNumber ?? null,
          driverName: displayName,
          driverClass: driverClassDisplayName,
          ticketNumber: report.reportId ?? null,
          lap: report.lap ?? null,
          turn: report.turn ?? null,
          incidentDescription,
          isAdjusted,
          isSelfReport: report.isSelfReport ?? false,
          timePenaltySeconds,
          licensePoints,
          stewardNames: stewardNames.join("; "),
          finalizedByName,
          adjustedReason,
          raceId: report.raceId,
        };
      }),
    );

    const validRows = exportRows.filter((row) => row !== null);

    const races = await ctx.db
      .query("races")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    const raceMap = new Map(races.map((r) => [r._id.toString(), r.raceNumber]));

    validRows.sort((a, b) => {
      const raceNumA = raceMap.get(a!.raceId.toString()) ?? 0;
      const raceNumB = raceMap.get(b!.raceId.toString()) ?? 0;
      if (raceNumA !== raceNumB) return raceNumA - raceNumB;
      return (a!.ticketNumber ?? 0) - (b!.ticketNumber ?? 0);
    });

    return validRows.map((row) => {
      const { raceId, ...rest } = row!;
      return rest;
    });
  },
});

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
            driverClassId: reportingDriver.driverClassId,
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
            driverClassId: reportedDriver.driverClassId,
            username: reportedDriver.username,
            externalId: reportedDriver.externalId,
            userId: reportedDriver.userId,
          }
        : null,
      reportingUser: reportingUser
        ? {
            userId: reportingUser._id,
            name: reportingUser.name,
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
