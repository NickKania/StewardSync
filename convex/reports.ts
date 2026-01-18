import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("reviewed"),
        v.literal("finalized"),
        v.literal("rejected")
      )
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

    // Populate relations
    const populatedReports = await Promise.all(
      reports.map(async (report) => {
        const [reportingDriver, reportedDriver, event, race] = await Promise.all([
          ctx.db.get(report.reportingDriverId),
          ctx.db.get(report.reportedDriverId),
          ctx.db.get(report.eventId),
          ctx.db.get(report.raceId),
        ]);

        return {
          ...report,
          reportingDriver,
          reportedDriver,
          event,
          race,
        };
      })
    );

    return populatedReports;
  },
});

export const getById = query({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) return null;

    const [reportingDriver, reportedDriver, event, race] = await Promise.all([
      ctx.db.get(report.reportingDriverId),
      ctx.db.get(report.reportedDriverId),
      ctx.db.get(report.eventId),
      ctx.db.get(report.raceId),
    ]);

    // Populate event's series
    let eventWithSeries: any = event;
    if (event) {
      const series = await ctx.db.get(event.seriesId);
      eventWithSeries = { ...event, series };
    }

    // Populate applied penalty if exists
    let appliedPenaltyObj = null;
    if (report.appliedPenalty) {
      appliedPenaltyObj = await ctx.db.get(report.appliedPenalty as any);
    }

    // Get reviews for this report
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_report", (q) => q.eq("reportId", args.reportId))
      .collect();

    const reviewsWithUsers = await Promise.all(
      reviews.map(async (review) => {
        const [user, secondSteward, linkedReview] = await Promise.all([
          ctx.db.get(review.userId),
          (review as any).secondStewardId ? ctx.db.get((review as any).secondStewardId) : null,
          review.linkedReviewId ? ctx.db.get(review.linkedReviewId) : null,
        ]);

        const linkedReviewWithReviewer = linkedReview ? {
          ...linkedReview,
          reviewer: linkedReview.userId ? await ctx.db.get(linkedReview.userId) : null,
        } : null;

        // Populate recommended penalty if exists
        let recommendedPenaltyObj = null;
        if (review.recommendedPenalty) {
          recommendedPenaltyObj = await ctx.db.get(review.recommendedPenalty as any);
        }

        return { ...review, reviewer: user, recommendedPenaltyObj, secondSteward, linkedReview: linkedReviewWithReviewer };
      })
    );

    return {
      ...report,
      reportingDriver,
      reportedDriver,
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
        const [reportingDriver, reportedDriver, event, race] = await Promise.all([
          ctx.db.get(report.reportingDriverId),
          ctx.db.get(report.reportedDriverId),
          ctx.db.get(report.eventId),
          ctx.db.get(report.raceId),
        ]);

        const reviews = await ctx.db
          .query("reviews")
          .withIndex("by_report", (q) => q.eq("reportId", report._id))
          .collect();

        const reviewCount = reviews.length;

        return {
          ...report,
          reportingDriver,
          reportedDriver,
          event,
          race,
          reviewCount,
        };
      })
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
        const [reportingDriver, reportedDriver, event, race] = await Promise.all([
          ctx.db.get(report.reportingDriverId),
          ctx.db.get(report.reportedDriverId),
          ctx.db.get(report.eventId),
          ctx.db.get(report.raceId),
        ]);

        const reviews = await ctx.db
          .query("reviews")
          .withIndex("by_report", (q) => q.eq("reportId", report._id))
          .collect();

        const reviewCount = reviews.length;

        return {
          ...report,
          reportingDriver,
          reportedDriver,
          event,
          race,
          reviewCount,
        };
      })
    );

    return populatedReports;
  },
});

export const create = mutation({
  args: {
    reportingDriverId: v.id("drivers"),
    reportedDriverId: v.id("drivers"),
    eventId: v.id("events"),
    raceId: v.id("races"),
    lap: v.number(),
    turn: v.number(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate that reporting and reported drivers are different
    if (args.reportingDriverId === args.reportedDriverId) {
      throw new Error("Reporting and reported driver cannot be the same");
    }

    // Validate all referenced entities exist
    const [reportingDriver, reportedDriver, event, race] = await Promise.all([
      ctx.db.get(args.reportingDriverId),
      ctx.db.get(args.reportedDriverId),
      ctx.db.get(args.eventId),
      ctx.db.get(args.raceId),
    ]);

    if (!reportingDriver) throw new Error("Reporting driver not found");
    if (!reportedDriver) throw new Error("Reported driver not found");
    if (!event) throw new Error("Event not found");
    if (!race) throw new Error("Race not found");

    // Validate race belongs to event
    if (race.eventId !== args.eventId) {
      throw new Error("Race does not belong to the selected event");
    }

    const now = Date.now();
    const reportId = await ctx.db.insert("reports", {
      ...args,
      reportDate: now,
      status: "pending",
      isFinalized: false,
      createdAt: now,
      updatedAt: now,
    });

    return reportId;
  },
});

export const update = mutation({
  args: {
    reportId: v.id("reports"),
    lap: v.optional(v.number()),
    turn: v.optional(v.number()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { reportId, ...updates } = args;

    const report = await ctx.db.get(reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    if (report.isFinalized) {
      throw new Error("Cannot edit a finalized report");
    }

    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
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
      throw new Error("Report must have at least one review before marking as reviewed");
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
    officialNotes: v.string(),
    isSelfReport: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    if (report.isFinalized) {
      throw new Error("Report is already finalized");
    }

    const now = Date.now();
    await ctx.db.patch(args.reportId, {
      status: "finalized",
      isFinalized: true,
      finalDecision: args.finalDecision,
      appliedPenalty: args.appliedPenalty,
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
        .withIndex("by_championship", (q) => q.eq("championshipId", event.seriesId))
        .collect();

      const penaltyAccumulator: Record<string, number> = {};

      for (const evt of events) {
        const evtReports = await ctx.db
          .query("reports")
          .withIndex("by_event", (q) => q.eq("eventId", evt._id))
          .collect();

        const finalizedReports = evtReports.filter((r) => r.status === "finalized");

        for (const finalizedReport of finalizedReports) {
          let penalty: any = null;
          if (finalizedReport.appliedPenalty) {
            penalty = await ctx.db.get(finalizedReport.appliedPenalty as any);
          }

          const points = penalty?.licensePoints ?? 0;
          const driverId = finalizedReport.reportedDriverId.toString();

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
        const driverClass = driver.driverClass || "";

        const existingDriverSeriesPenalties = await ctx.db
          .query("driverSeriesPenalties")
          .withIndex("by_driver_and_series", (q) =>
            q.eq("driverId", driver._id).eq("seriesId", event.seriesId)
          )
          .collect();

        const assignedThresholds = existingDriverSeriesPenalties
          .filter((dsp: any) => !dsp.isServed)
          .map((dsp: any) => dsp.seriesPenaltyThresholdId);

        for (const seriesPenalty of seriesPenalties) {
          const thresholds = await ctx.db
            .query("seriesPenaltyThresholds")
            .withIndex("by_series_penalty", (q) => q.eq("seriesPenaltyId", seriesPenalty._id))
            .collect();

          for (const threshold of thresholds) {
            const appliesToDriver = threshold.driverClasses.includes(driverClass);

            if (appliesToDriver &&
              totalPoints >= threshold.threshold &&
              !assignedThresholds.includes(threshold._id)) {
              await ctx.db.insert("driverSeriesPenalties", {
                driverId: driver._id,
                seriesId: event.seriesId,
                seriesPenaltyId: seriesPenalty._id,
                seriesPenaltyThresholdId: threshold._id,
                isServed: false,
                pointsAtAssignment: totalPoints,
                assignedAt: Date.now(),
              });
            }
          }
        }
      }
    }

    return args.reportId;
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
      throw new Error("Report is already finalized");
    }

    await ctx.db.patch(args.reportId, {
      status: "rejected",
      isFinalized: true,
      officialNotes: args.officialNotes,
      updatedAt: Date.now(),
    });

    return args.reportId;
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
      .withIndex("by_reporting_driver", (q) => q.eq("reportingDriverId", args.driverId))
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
        const [reportingDriver, reportedDriver, event, race] = await Promise.all([
          ctx.db.get(report.reportingDriverId),
          ctx.db.get(report.reportedDriverId),
          ctx.db.get(report.eventId),
          ctx.db.get(report.raceId),
        ]);

        let appliedPenaltyObj = null;
        if (report.appliedPenalty) {
          appliedPenaltyObj = await ctx.db.get(report.appliedPenalty as any);
        }

        return { ...report, reportingDriver, reportedDriver, event, race, appliedPenalty: appliedPenaltyObj };
      })
    );

    return { reports: populatedReports, total };
  },
});

export const getDriverIndividualPenalties = query({
  args: { driverId: v.id("drivers") },
  handler: async (ctx, args) => {
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_reported_driver", (q) => q.eq("reportedDriverId", args.driverId))
      .filter((q) => q.eq(q.field("status"), "finalized"))
      .collect();

    const penalties = await Promise.all(
      reports.map(async (report) => {
        const [event, race, appliedPenalty] = await Promise.all([
          ctx.db.get(report.eventId),
          ctx.db.get(report.raceId),
          report.appliedPenalty ? await ctx.db.get(report.appliedPenalty as any) : null,
        ]);

        return {
          reportId: report._id,
          reportDate: report.reportDate,
          finalizedAt: report.finalizedAt ?? report.reportDate,
          event,
          race,
          turn: report.turn,
          appliedPenalty,
          finalDecision: report.finalDecision,
        };
      })
    );

    const penaltiesWithPenalty = penalties.filter(p => p.appliedPenalty !== null);

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
