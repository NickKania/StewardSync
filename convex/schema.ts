import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  roles: defineTable({
    name: v.string(),
    displayName: v.string(),
  }).index("by_name", ["name"]),

  users: defineTable({
    email: v.optional(v.string()),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    roleId: v.id("roles"),
    discordId: v.optional(v.string()),
    discordUsername: v.optional(v.string()),
    discordGlobalName: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_discord_id", ["discordId"]),

  drivers: defineTable({
    driverNumber: v.number(),
    driverName: v.string(),
    username: v.optional(v.string()),
    externalId: v.optional(v.string()),
    driverClass: v.string(),
    steamId: v.optional(v.string()),
    championshipId: v.optional(v.id("series")),
    userId: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_number", ["driverNumber"])
    .index("by_username", ["username"])
    .index("by_external_id", ["externalId"])
    .index("by_steam_id", ["steamId"])
    .index("by_championship", ["championshipId"])
    .index("by_user_id", ["userId"]),

  series: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    simgridLink: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_name", ["name"]),

  penalties: defineTable({
    seriesId: v.id("series"),
    name: v.string(),
    timePenalty: v.number(),
    selfReportReduction: v.optional(v.number()),
    timePenaltyLap1: v.number(),
    licensePoints: v.number(),
    createdAt: v.number(),
  }).index("by_series", ["seriesId"]),

  events: defineTable({
    seriesId: v.id("series"),
    eventNumber: v.number(),
    trackName: v.string(),
    eventDate: v.number(),
    createdAt: v.number(),
  })
    .index("by_series", ["seriesId"])
    .index("by_date", ["eventDate"])
    .index("by_series_and_number", ["seriesId", "eventNumber"]),

  races: defineTable({
    eventId: v.id("events"),
    raceNumber: v.number(),
    createdAt: v.number(),
  }).index("by_event", ["eventId"]),

  seriesPenalties: defineTable({
    seriesId: v.id("series"),
    penaltyName: v.string(),
    penaltyDescription: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_series", ["seriesId"]),

  seriesPenaltyThresholds: defineTable({
    seriesPenaltyId: v.id("seriesPenalties"),
    threshold: v.number(),
    driverClasses: v.array(v.string()),
    createdAt: v.number(),
  }).index("by_series_penalty", ["seriesPenaltyId"]),

  driverSeriesPenalties: defineTable({
    driverId: v.id("drivers"),
    seriesId: v.id("series"),
    seriesPenaltyId: v.id("seriesPenalties"),
    seriesPenaltyThresholdId: v.id("seriesPenaltyThresholds"),
    isServed: v.boolean(),
    pointsAtAssignment: v.number(),
    assignedAt: v.number(),
    servedAt: v.optional(v.number()),
    servedBy: v.optional(v.id("users")),
  })
    .index("by_driver_and_series", ["driverId", "seriesId"])
    .index("by_series", ["seriesId"]),

  reports: defineTable({
    reportDate: v.number(),
    reportingDriverId: v.optional(v.id("drivers")),
    reportingUserId: v.optional(v.id("users")),
    reportedDriverId: v.id("drivers"),
    eventId: v.id("events"),
    raceId: v.id("races"),
    lap: v.number(),
    turn: v.number(),
    description: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("reviewed"),
      v.literal("finalized"),
      v.literal("rejected"),
    ),
    isFinalized: v.boolean(),
    finalDecision: v.optional(v.string()),
    appliedPenalty: v.optional(v.string()),
    officialNotes: v.optional(v.string()),
    finalizedBy: v.optional(v.id("users")),
    finalizedAt: v.optional(v.number()),
    isSelfReport: v.optional(v.boolean()),
    isStewardReported: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_event", ["eventId"])
    .index("by_reporting_driver", ["reportingDriverId"])
    .index("by_reporting_user", ["reportingUserId"])
    .index("by_reported_driver", ["reportedDriverId"])
    .index("by_date", ["reportDate"]),

  reviews: defineTable({
    reviewDate: v.number(),
    userId: v.id("users"),
    reportId: v.id("reports"),
    incidentDescription: v.string(),
    reviewNotes: v.string(),
    recommendedPenalty: v.optional(v.string()),
    videoTimestamp: v.optional(v.string()),
    secondStewardId: v.optional(v.id("users")),
    linkedReviewId: v.optional(v.id("reviews")),
    isSelfReport: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_report", ["reportId"])
    .index("by_user", ["userId"]),
});
