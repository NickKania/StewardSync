import { v } from "convex/values";
import { query } from "./_generated/server";

export const listReports = query({
  args: {
    limit: v.optional(v.number()),
    finalizedOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let reportsQuery = ctx.db.query("reports");

    if (args.finalizedOnly !== undefined) {
      reportsQuery = reportsQuery.withIndex("by_is_finalized", (q) =>
        q.eq("IsFinalized", args.finalizedOnly!)
      );
    }

    const reports = await reportsQuery
      .order("desc")
      .take(args.limit || 50);

    // Fetch related data
    const reportsWithDetails = await Promise.all(
      reports.map(async (report) => {
        const reportingDriver = await ctx.db.get(report.ReportingDriver);
        const reportedDriver = await ctx.db.get(report.ReportedDriver);
        const event = await ctx.db.get(report.Event);
        const race = await ctx.db.get(report.Race);
        const createdBy = await ctx.db.get(report.createdBy);

        return {
          ...report,
          reportingDriver,
          reportedDriver,
          event,
          race,
          createdBy,
        };
      })
    );

    return reportsWithDetails;
  },
});

export const getReport = query({
  args: {
    reportId: v.id("reports"),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) {
      return null;
    }

    const reportingDriver = await ctx.db.get(report.ReportingDriver);
    const reportedDriver = await ctx.db.get(report.ReportedDriver);
    const event = await ctx.db.get(report.Event);
    const race = await ctx.db.get(report.Race);
    const createdBy = await ctx.db.get(report.createdBy);

    return {
      ...report,
      reportingDriver,
      reportedDriver,
      event,
      race,
      createdBy,
    };
  },
});

export const listReviews = query({
  args: {
    reportId: v.id("reports"),
  },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_report", (q) => q.eq("ReviewedReport", args.reportId))
      .order("desc")
      .collect();

    // Fetch related data
    const reviewsWithUsers = await Promise.all(
      reviews.map(async (review) => {
        const user = await ctx.db.get(review.UserId);
        return {
          ...review,
          user,
        };
      })
    );

    return reviewsWithUsers;
  },
});

export const listDrivers = query({
  args: {},
  handler: async (ctx) => {
    const drivers = await ctx.db.query("drivers").order("asc").collect();
    return drivers;
  },
});

export const listEvents = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("events").order("desc").collect();
    return events;
  },
});

export const listRaces = query({
  args: {
    eventId: v.optional(v.id("events")),
  },
  handler: async (ctx, args) => {
    if (args.eventId) {
      const races = await ctx.db
        .query("races")
        .withIndex("by_event", (q) => q.eq("Event", args.eventId))
        .collect();
      return races;
    }
    return await ctx.db.query("races").collect();
  },
});

export const listRoles = query({
  args: {},
  handler: async (ctx) => {
    const roles = await ctx.db.query("roles").collect();
    return roles;
  },
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if user is admin
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const role = await ctx.db.get(user.Role);
    if (!role || role.RoleName !== "Admin") {
      throw new Error("Not authorized");
    }

    const users = await ctx.db.query("users").collect();

    // Fetch roles for each user
    const usersWithRoles = await Promise.all(
      users.map(async (u) => {
        const userRole = await ctx.db.get(u.Role);
        return {
          ...u,
          role: userRole,
        };
      })
    );

    return usersWithRoles;
  },
});

export const getUnfinalizedReports = query({
  args: {},
  handler: async (ctx) => {
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_is_finalized", (q) => q.eq("IsFinalized", false))
      .order("desc")
      .collect();

    // Fetch related data
    const reportsWithDetails = await Promise.all(
      reports.map(async (report) => {
        const reportingDriver = await ctx.db.get(report.ReportingDriver);
        const reportedDriver = await ctx.db.get(report.ReportedDriver);
        const event = await ctx.db.get(report.Event);
        const race = await ctx.db.get(report.Race);

        return {
          ...report,
          reportingDriver,
          reportedDriver,
          event,
          race,
        };
      })
    );

    return reportsWithDetails;
  },
});
