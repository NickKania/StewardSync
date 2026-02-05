import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { checkUserDriverConflict } from "./lib/reports";
import { UserFacingError } from "./lib/errors";
import { Result, success, failure } from "./lib/result";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const reviews = await ctx.db.query("reviews").order("desc").collect();

    const populatedReviews = await Promise.all(
      reviews.map(async (review) => {
        const [user, report, linkedReview] = await Promise.all([
          ctx.db.get(review.userId),
          ctx.db.get(review.reportId),
          review.linkedReviewId ? ctx.db.get(review.linkedReviewId) : null,
        ]);

        const linkedReviewWithReviewer = linkedReview ? {
          ...linkedReview,
          reviewer: linkedReview.userId ? await ctx.db.get(linkedReview.userId) : null,
        } : null;

        return {
          ...review,
          reviewer: user,
          report,
          linkedReview: linkedReviewWithReviewer,
        };
      })
    );

    return populatedReviews;
  },
});

export const getByReport = query({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_report", (q) => q.eq("reportId", args.reportId))
      .collect();

    const populatedReviews = await Promise.all(
      reviews.map(async (review) => {
        const [user, linkedReview] = await Promise.all([
          ctx.db.get(review.userId),
          review.linkedReviewId ? ctx.db.get(review.linkedReviewId) : null,
        ]);

        const linkedReviewWithReviewer = linkedReview ? {
          ...linkedReview,
          reviewer: linkedReview.userId ? await ctx.db.get(linkedReview.userId) : null,
        } : null;

        return {
          ...review,
          reviewer: user,
          linkedReview: linkedReviewWithReviewer,
        };
      })
    );

    return populatedReviews;
  },
});

export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    const populatedReviews = await Promise.all(
      reviews.map(async (review) => {
        const report = await ctx.db.get(review.reportId);
        return {
          ...review,
          report,
        };
      })
    );

    return populatedReviews;
  },
});

export const getById = query({
  args: { reviewId: v.id("reviews") },
  handler: async (ctx, args) => {
    const review = await ctx.db.get(args.reviewId);
    if (!review) return null;

    const [user, report, linkedReview] = await Promise.all([
      ctx.db.get(review.userId),
      ctx.db.get(review.reportId),
      review.linkedReviewId ? ctx.db.get(review.linkedReviewId) : null,
    ]);

    const linkedReviewWithReviewer = linkedReview ? {
      ...linkedReview,
      reviewer: linkedReview.userId ? await ctx.db.get(linkedReview.userId) : null,
    } : null;

    return {
      ...review,
      reviewer: user,
      report,
      linkedReview: linkedReviewWithReviewer,
    };
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    reportId: v.id("reports"),
    incidentDescription: v.string(),
    reviewNotes: v.string(),
    candidateForStandardization: v.optional(v.boolean()),
    recommendedPenalty: v.string(),
    atFaultDriverId: v.optional(v.id("drivers")),
    videoTimestamp: v.optional(v.string()),
    secondStewardId: v.optional(v.id("users")),
    isSelfReport: v.optional(v.boolean()),
    isAdjusted: v.optional(v.boolean()),
    adjustedReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate report exists and is not finalized
    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    if (report.isFinalized) {
      return failure("Cannot review a finalized report");
    }

    // Check if primary steward has driver conflict
    const primaryConflict = await checkUserDriverConflict(ctx, args.userId, report);
    if (primaryConflict.hasConflict) {
      const getConflictTypeText = (type: string) => {
        if (type === "reporting_user") return "reporting user";
        if (type === "reporting_driver") return "reporting driver";
        return "reported driver";
      };
      return failure(
        `You cannot review this report because you are involved as the ${getConflictTypeText(primaryConflict.conflictType!)}${primaryConflict.driverName ? ` (${primaryConflict.driverName})` : ""}.`
      );
    }

    // Check if second steward has driver conflict
    if (args.secondStewardId) {
      const secondConflict = await checkUserDriverConflict(ctx, args.secondStewardId, report);
      if (secondConflict.hasConflict) {
        const secondSteward = await ctx.db.get(args.secondStewardId);
        const getConflictTypeText = (type: string) => {
          if (type === "reporting_user") return "reporting user";
          if (type === "reporting_driver") return "reporting driver";
          return "reported driver";
        };
        return failure(
          `${secondSteward?.name || "The second steward"} cannot review this report because they are involved as the ${getConflictTypeText(secondConflict.conflictType!)}${secondConflict.driverName ? ` (${secondConflict.driverName})` : ""}.`
        );
      }
    }

    // Check if this user has already reviewed this report
    const existingReview = await ctx.db
      .query("reviews")
      .withIndex("by_report", (q) => q.eq("reportId", args.reportId))
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();

    if (existingReview) {
      return failure("You have already submitted a review for this report");
    }

    // If second steward is provided, check if they've also already reviewed
    if (args.secondStewardId) {
      const existingSecondReview = await ctx.db
        .query("reviews")
        .withIndex("by_report", (q) => q.eq("reportId", args.reportId))
        .filter((q) => q.eq(q.field("userId"), args.secondStewardId!))
        .first();

      if (existingSecondReview) {
        return failure("Second steward has already submitted a review for this report");
      }
    }

    const now = Date.now();

    const reviewData = {
      userId: args.userId,
      reportId: args.reportId,
      incidentDescription: args.incidentDescription,
      reviewNotes: args.reviewNotes,
      candidateForStandardization: args.candidateForStandardization,
      recommendedPenalty: args.recommendedPenalty,
      atFaultDriverId: args.atFaultDriverId,
      videoTimestamp: args.videoTimestamp,
      isSelfReport: args.isSelfReport,
      isAdjusted: args.isAdjusted,
      adjustedReason: args.adjustedReason,
      reviewDate: now,
      createdAt: now,
      updatedAt: now,
    };

    // If second steward is provided, create two linked reviews
    if (args.secondStewardId) {
      const primaryReviewId = await ctx.db.insert("reviews", reviewData);

      const secondReviewId = await ctx.db.insert("reviews", {
        ...reviewData,
        userId: args.secondStewardId,
        linkedReviewId: primaryReviewId,
      });

      await ctx.db.patch(primaryReviewId, { linkedReviewId: secondReviewId });

      if (args.videoTimestamp) {
        await ctx.db.patch(args.reportId, { videoTimestamp: args.videoTimestamp });
      }

      return success(primaryReviewId);
    }

    // Single review
    const reviewId = await ctx.db.insert("reviews", reviewData);

    if (args.videoTimestamp) {
      await ctx.db.patch(args.reportId, { videoTimestamp: args.videoTimestamp });
    }

    return success(reviewId);
  },
});

export const update = mutation({
  args: {
    reviewId: v.id("reviews"),
    incidentDescription: v.optional(v.string()),
    reviewNotes: v.optional(v.string()),
    candidateForStandardization: v.optional(v.boolean()),
    recommendedPenalty: v.optional(v.string()),
    videoTimestamp: v.optional(v.string()),
    isAdjusted: v.optional(v.boolean()),
    adjustedReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { reviewId, ...updates } = args;

    const review = await ctx.db.get(reviewId);
    if (!review) {
      throw new Error("Review not found");
    }

    // Check if the report is finalized
    const report = await ctx.db.get(review.reportId);
    if (report?.isFinalized) {
      throw new UserFacingError("Cannot update review for a finalized report");
    }

    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(reviewId, {
      ...cleanUpdates,
      updatedAt: Date.now(),
    });

    return reviewId;
  },
});

export const remove = mutation({
  args: { reviewId: v.id("reviews") },
  handler: async (ctx, args) => {
    const review = await ctx.db.get(args.reviewId);
    if (!review) {
      throw new Error("Review not found");
    }

    // Check if the report is finalized
    const report = await ctx.db.get(review.reportId);
    if (report?.isFinalized) {
      throw new UserFacingError("Cannot delete review for a finalized report");
    }

    await ctx.db.delete(args.reviewId);
  },
});

export const getStats = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    let reviews;

    if (args.userId) {
      reviews = await ctx.db
        .query("reviews")
        .withIndex("by_user", (q) => q.eq("userId", args.userId!))
        .collect();
    } else {
      reviews = await ctx.db.query("reviews").collect();
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    return {
      total: reviews.length,
      today: reviews.filter((r) => r.reviewDate >= todayTimestamp).length,
    };
  },
});

export const migrateSecondStewardToLinkedReviews = mutation({
  args: {},
  handler: async (ctx) => {
    const reviews = await ctx.db.query("reviews").collect();

    for (const review of reviews) {
      const reviewDoc = review as any;

      if (reviewDoc.secondStewardId && !reviewDoc.linkedReviewId) {
        const now = Date.now();

        const primaryReviewId = await ctx.db.insert("reviews", {
          userId: reviewDoc.userId,
          reportId: reviewDoc.reportId,
          incidentDescription: reviewDoc.incidentDescription,
          reviewNotes: reviewDoc.reviewNotes,
          candidateForStandardization: reviewDoc.candidateForStandardization,
          recommendedPenalty: reviewDoc.recommendedPenalty,
          videoTimestamp: reviewDoc.videoTimestamp,
          reviewDate: reviewDoc.reviewDate,
          createdAt: reviewDoc.createdAt,
          updatedAt: now,
        });

        const secondReviewId = await ctx.db.insert("reviews", {
          userId: reviewDoc.secondStewardId,
          reportId: reviewDoc.reportId,
          incidentDescription: reviewDoc.incidentDescription,
          reviewNotes: reviewDoc.reviewNotes,
          candidateForStandardization: reviewDoc.candidateForStandardization,
          recommendedPenalty: reviewDoc.recommendedPenalty,
          videoTimestamp: reviewDoc.videoTimestamp,
          linkedReviewId: primaryReviewId,
          reviewDate: reviewDoc.reviewDate,
          createdAt: reviewDoc.createdAt,
          updatedAt: now,
        });

        await ctx.db.patch(primaryReviewId, { linkedReviewId: secondReviewId });

        await ctx.db.delete(review._id);
      }
    }

    return { success: true, migrated: reviews.length };
  },
});

export const search = query({
  args: {
    searchQuery: v.optional(v.string()),
    seriesId: v.optional(v.id("series")),
    userId: v.optional(v.id("users")),
    candidateForStandardization: v.optional(v.boolean()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.number(),
    offset: v.number(),
  },
  handler: async (ctx, args) => {
    let reviews = await ctx.db.query("reviews").order("desc").collect();

    const populatedReviews = await Promise.all(
      reviews.map(async (review) => {
        const [user, report, linkedReview] = await Promise.all([
          ctx.db.get(review.userId),
          ctx.db.get(review.reportId),
          review.linkedReviewId ? ctx.db.get(review.linkedReviewId) : null,
        ]);

        const linkedReviewWithReviewer = linkedReview ? {
          ...linkedReview,
          reviewer: linkedReview.userId ? await ctx.db.get(linkedReview.userId) : null,
        } : null;

        return {
          ...review,
          reviewer: user,
          report,
          linkedReview: linkedReviewWithReviewer,
        };
      })
    );

    let filteredReviews = populatedReviews;

    if (args.searchQuery) {
      const query = args.searchQuery.toLowerCase();
      filteredReviews = filteredReviews.filter(
        (review) => {
          const descriptionMatch = review.incidentDescription?.toLowerCase().includes(query) || false;
          const notesMatch = review.reviewNotes?.toLowerCase().includes(query) || false;
          return descriptionMatch || notesMatch;
        }
      );
    }

    if (args.seriesId) {
      filteredReviews = await Promise.all(
        filteredReviews.map(async (review) => {
          const report = review.report;
          if (!report) return false;
          const event = await ctx.db.get(report.eventId);
          return event?.seriesId === args.seriesId;
        })
      ).then((results) => filteredReviews.filter((_, i) => results[i]));
    }

    if (args.userId) {
      filteredReviews = filteredReviews.filter(
        (review) => review.userId === args.userId
      );
    }

    if (args.candidateForStandardization !== undefined) {
      filteredReviews = filteredReviews.filter(
        (review) =>
          Boolean(review.candidateForStandardization) ===
          args.candidateForStandardization,
      );
    }

    if (args.startDate) {
      filteredReviews = filteredReviews.filter(
        (review) => review.createdAt >= args.startDate!
      );
    }

    if (args.endDate) {
      filteredReviews = filteredReviews.filter(
        (review) => review.createdAt <= args.endDate!
      );
    }

    const paginatedReviews = filteredReviews.slice(args.offset, args.offset + args.limit);

    const reviewsWithFullDetails = await Promise.all(
      paginatedReviews.map(async (review) => {
        const event = review.report ? await ctx.db.get(review.report.eventId) : null;
        const series = event ? await ctx.db.get(event.seriesId) : null;
        const race = review.report ? await ctx.db.get(review.report.raceId) : null;
        const atFaultDriver = review.report && review.report.atFaultDriverId 
          ? await ctx.db.get(review.report.atFaultDriverId) 
          : null;
        const reportingDriver = review.report && review.report.reportingDriverId 
          ? await ctx.db.get(review.report.reportingDriverId) 
          : null;

        return {
          ...review,
          event,
          series,
          race,
          atFaultDriver,
          reportingDriver,
        };
      })
    );

    return reviewsWithFullDetails;
  },
});

export const searchCount = query({
  args: {
    searchQuery: v.optional(v.string()),
    seriesId: v.optional(v.id("series")),
    userId: v.optional(v.id("users")),
    candidateForStandardization: v.optional(v.boolean()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let reviews = await ctx.db.query("reviews").collect();

    if (args.searchQuery) {
      const query = args.searchQuery.toLowerCase();
      reviews = reviews.filter(
        (review) =>
          review.incidentDescription.toLowerCase().includes(query) ||
          review.reviewNotes.toLowerCase().includes(query)
      );
    }

    if (args.seriesId) {
      reviews = await Promise.all(
        reviews.map(async (review) => {
          const report = await ctx.db.get(review.reportId);
          const event = report ? await ctx.db.get(report.eventId) : null;
          return event?.seriesId === args.seriesId;
        })
      ).then((results) => reviews.filter((_, i) => results[i]));
    }

    if (args.userId) {
      reviews = reviews.filter((review) => review.userId === args.userId);
    }

    if (args.candidateForStandardization !== undefined) {
      reviews = reviews.filter(
        (review) =>
          Boolean(review.candidateForStandardization) ===
          args.candidateForStandardization,
      );
    }

    if (args.startDate) {
      reviews = reviews.filter((review) => review.createdAt >= args.startDate!);
    }

    if (args.endDate) {
      reviews = reviews.filter((review) => review.createdAt <= args.endDate!);
    }

    return reviews.length;
  },
});
