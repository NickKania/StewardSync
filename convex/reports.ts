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

    // Get reviews for this report
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_report", (q) => q.eq("reportId", args.reportId))
      .collect();

    const reviewsWithUsers = await Promise.all(
      reviews.map(async (review) => {
        const user = await ctx.db.get(review.userId);
        return { ...review, reviewer: user };
      })
    );

    return {
      ...report,
      reportingDriver,
      reportedDriver,
      event,
      race,
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

        const reviewCount = (
          await ctx.db
            .query("reviews")
            .withIndex("by_report", (q) => q.eq("reportId", report._id))
            .collect()
        ).length;

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

        return {
          ...report,
          reportingDriver,
          reportedDriver,
          event,
          race,
          reviewCount: reviews.length,
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
      .first();

    if (!reviews) {
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
      finalizedBy: args.userId,
      finalizedAt: now,
      updatedAt: now,
    });

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
