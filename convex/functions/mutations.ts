import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const createReport = mutation({
  args: {
    reportingDriverId: v.id("drivers"),
    reportedDriverId: v.id("drivers"),
    eventId: v.id("events"),
    raceId: v.id("races"),
    turn: v.number(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get the user
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const reportId = await ctx.db.insert("reports", {
      ReportDate: Date.now(),
      ReportingDriver: args.reportingDriverId,
      ReportedDriver: args.reportedDriverId,
      Event: args.eventId,
      Race: args.raceId,
      Turn: args.turn,
      Description: args.description,
      IsFinalized: false,
      createdBy: user._id,
    });

    return reportId;
  },
});

export const updateReport = mutation({
  args: {
    reportId: v.id("reports"),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const role = await ctx.db.get(user.Role);
    if (!role || !["Steward", "Head Steward", "Event Manager", "Admin"].includes(role.RoleName)) {
      throw new Error("Not authorized to update reports");
    }

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    if (report.IsFinalized) {
      throw new Error("Cannot update finalized reports");
    }

    if (args.description !== undefined) {
      await ctx.db.patch(args.reportId, {
        Description: args.description,
      });
    }

    return args.reportId;
  },
});

export const createReview = mutation({
  args: {
    reportId: v.id("reports"),
    incidentDescription: v.string(),
    reviewNotes: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const role = await ctx.db.get(user.Role);
    if (!role || !["Steward", "Head Steward", "Event Manager", "Admin"].includes(role.RoleName)) {
      throw new Error("Not authorized to create reviews");
    }

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    if (report.IsFinalized) {
      throw new Error("Cannot review finalized reports");
    }

    const reviewId = await ctx.db.insert("reviews", {
      ReviewDate: Date.now(),
      UserId: user._id,
      ReviewedReport: args.reportId,
      IncidentDescription: args.incidentDescription,
      ReviewNotes: args.reviewNotes,
    });

    return reviewId;
  },
});

export const finalizeReport = mutation({
  args: {
    reportId: v.id("reports"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const role = await ctx.db.get(user.Role);
    if (!role || !["Head Steward", "Event Manager", "Admin"].includes(role.RoleName)) {
      throw new Error("Not authorized to finalize reports");
    }

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    if (report.IsFinalized) {
      throw new Error("Report is already finalized");
    }

    await ctx.db.patch(args.reportId, {
      IsFinalized: true,
    });

    return args.reportId;
  },
});

export const createDriver = mutation({
  args: {
    driverNumber: v.number(),
    driverName: v.string(),
    externalId: v.string(),
    driverClass: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const role = await ctx.db.get(user.Role);
    if (!role || !["Head Steward", "Event Manager", "Admin"].includes(role.RoleName)) {
      throw new Error("Not authorized to create drivers");
    }

    const driverId = await ctx.db.insert("drivers", {
      DriverNumber: args.driverNumber,
      DriverName: args.driverName,
      ExternalId: args.externalId,
      DriverClass: args.driverClass,
    });

    return driverId;
  },
});

export const createEvent = mutation({
  args: {
    series: v.string(),
    eventNumber: v.number(),
    trackName: v.string(),
    eventDate: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const role = await ctx.db.get(user.Role);
    if (!role || !["Head Steward", "Event Manager", "Admin"].includes(role.RoleName)) {
      throw new Error("Not authorized to create events");
    }

    const eventId = await ctx.db.insert("events", {
      Series: args.series,
      EventNumber: args.eventNumber,
      TrackName: args.trackName,
      EventDate: args.eventDate,
    });

    return eventId;
  },
});

export const createRace = mutation({
  args: {
    eventId: v.id("events"),
    raceNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const role = await ctx.db.get(user.Role);
    if (!role || !["Head Steward", "Event Manager", "Admin"].includes(role.RoleName)) {
      throw new Error("Not authorized to create races");
    }

    const raceId = await ctx.db.insert("races", {
      Event: args.eventId,
      RaceNumber: args.raceNumber,
    });

    return raceId;
  },
});

export const updateUserRole = mutation({
  args: {
    userId: v.id("users"),
    roleId: v.id("roles"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const role = await ctx.db.get(user.Role);
    if (!role || role.RoleName !== "Admin") {
      throw new Error("Not authorized to update user roles");
    }

    await ctx.db.patch(args.userId, {
      Role: args.roleId,
    });

    return args.userId;
  },
});

export const ensureUserExists = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (existingUser) {
      return existingUser;
    }

    // Get or create Driver role (default role)
    let driverRole = await ctx.db
      .query("roles")
      .withIndex("by_role_name", (q) => q.eq("RoleName", "Driver"))
      .first();

    if (!driverRole) {
      driverRole = await ctx.db.insert("roles", {
        RoleName: "Driver",
      });
    }

    const userId = await ctx.db.insert("users", {
      UserName: identity.name || "Unknown",
      Role: driverRole,
      email: identity.email || "",
      tokenIdentifier: identity.tokenIdentifier,
      createdAt: Date.now(),
    });

    return await ctx.db.get(userId);
  },
});
