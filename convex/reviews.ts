import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const reviews = await ctx.db.query("reviews").order("desc").collect();

    const populatedReviews = await Promise.all(
      reviews.map(async (review) => {
        const [user, report] = await Promise.all([
          ctx.db.get(review.userId),
          ctx.db.get(review.reportId),
        ]);

        return {
          ...review,
          reviewer: user,
          report,
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
        const user = await ctx.db.get(review.userId);
        return {
          ...review,
          reviewer: user,
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

    const [user, report] = await Promise.all([
      ctx.db.get(review.userId),
      ctx.db.get(review.reportId),
    ]);

    return {
      ...review,
      reviewer: user,
      report,
    };
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    reportId: v.id("reports"),
    incidentDescription: v.string(),
    reviewNotes: v.string(),
    recommendedPenalty: v.optional(v.string()),
    videoTimestamp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate report exists and is not finalized
    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    if (report.isFinalized) {
      throw new Error("Cannot review a finalized report");
    }

    // Check if this user has already reviewed this report
    const existingReview = await ctx.db
      .query("reviews")
      .withIndex("by_report", (q) => q.eq("reportId", args.reportId))
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();

    if (existingReview) {
      throw new Error("You have already submitted a review for this report");
    }

    const now = Date.now();
    const reviewId = await ctx.db.insert("reviews", {
      ...args,
      reviewDate: now,
      createdAt: now,
      updatedAt: now,
    });

    return reviewId;
  },
});

export const update = mutation({
  args: {
    reviewId: v.id("reviews"),
    incidentDescription: v.optional(v.string()),
    reviewNotes: v.optional(v.string()),
    recommendedPenalty: v.optional(v.string()),
    videoTimestamp: v.optional(v.string()),
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
      throw new Error("Cannot update review for a finalized report");
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
      throw new Error("Cannot delete review for a finalized report");
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
