import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  roles: defineTable({
    name: v.string(),
    displayName: v.string(),
  }).index("by_name", ["name"]),

  users: defineTable({
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    roleId: v.id("roles"),
    discordId: v.optional(v.string()),
    discordUsername: v.optional(v.string()),
    officialName: v.optional(v.string()),
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_discord_id", ["discordId"]),

  steamUserMappings: defineTable({
    steamId: v.string(),
    userId: v.id("users"),
    isBanned: v.boolean(),
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_steam_id", ["steamId"])
    .index("by_user_id", ["userId"]),

  driverClasses: defineTable({
    seriesId: v.id("series"),
    className: v.string(),
    displayName: v.string(),
    createdAt: v.number(),
  })
    .index("by_series", ["seriesId"])
    .index("by_series_class", ["seriesId", "className"]),

  drivers: defineTable({
    driverNumber: v.number(),
    driverName: v.string(),
    officialName: v.optional(v.string()),
    username: v.optional(v.string()),
    externalId: v.optional(v.string()),
    driverClassId: v.optional(v.id("driverClasses")),
    steamId: v.optional(v.string()),
    championshipId: v.optional(v.id("series")),
    userId: v.optional(v.id("users")),
    accumulatedLicensePoints: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    createdAt: v.number(),
  })
    .index("by_number", ["driverNumber"])
    .index("by_username", ["username"])
    .index("by_external_id", ["externalId"])
    .index("by_steam_id", ["steamId"])
    .index("by_championship", ["championshipId"])
    .index("by_user_id", ["userId"])
    .index("by_driver_class", ["driverClassId"]),

  series: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    simgridLink: v.optional(v.string()),
    reportingOpenTime: v.optional(v.string()),
    reportingCloseDuration: v.optional(v.number()),
    isReportingLocked: v.optional(v.boolean()),
    requireVideoEvidence: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
    seriesPenaltyNotes: v.optional(v.string()),
    scheduledImportTime: v.optional(v.string()),
    scheduledImportDays: v.optional(v.array(v.number())),
    scheduledImportJobId: v.optional(v.id("_scheduled_functions")),
    isScheduledImportActive: v.optional(v.boolean()),
    createdAt: v.number(),
  }).index("by_name", ["name"]),

  penalties: defineTable({
    seriesId: v.id("series"),
    name: v.string(),
    timePenalty: v.number(),
    selfReportReduction: v.optional(v.number()),
    timePenaltyLap1: v.number(),
    licensePoints: v.number(),
    allowNoDriverAtFault: v.optional(v.boolean()),
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
    sessionName: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_event", ["eventId"]),

  changeHistory: defineTable({
    tableName: v.string(),
    documentId: v.string(),
    fieldName: v.string(),
    fromValue: v.optional(v.string()),
    toValue: v.optional(v.string()),
    changedByUserId: v.optional(v.id("users")),
    source: v.union(v.literal("manual"), v.literal("simgrid"), v.literal("system")),
    changedAt: v.number(),
  })
    .index("by_entity", ["tableName", "documentId"])
    .index("by_entity_field", ["tableName", "documentId", "fieldName"])
    .index("by_entity_field_source", ["tableName", "documentId", "fieldName", "source"]),

  seriesPenalties: defineTable({
    seriesId: v.id("series"),
    penaltyName: v.string(),
    penaltyDescription: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_series", ["seriesId"]),

  seriesPenaltyThresholds: defineTable({
    seriesPenaltyId: v.id("seriesPenalties"),
    threshold: v.number(),
    driverClassIds: v.array(v.id("driverClasses")),
    requiresReview: v.optional(v.boolean()),
    createdAt: v.number(),
  }).index("by_series_penalty", ["seriesPenaltyId"]),

  driverSeriesPenalties: defineTable({
    driverId: v.id("drivers"),
    seriesId: v.id("series"),
    seriesPenaltyId: v.id("seriesPenalties"),
    seriesPenaltyThresholdId: v.id("seriesPenaltyThresholds"),
    isServed: v.boolean(),
    requiresReview: v.optional(v.boolean()),
    raceBanReviewId: v.optional(v.id("raceBanReviews")),
    pointsAtAssignment: v.number(),
    assignedAt: v.number(),
    servedAt: v.optional(v.number()),
    servedBy: v.optional(v.id("users")),
  })
    .index("by_driver_and_series", ["driverId", "seriesId"])
    .index("by_series", ["seriesId"])
    .index("by_race_ban_review", ["raceBanReviewId"]),

  raceBanReviews: defineTable({
    driverSeriesPenaltyId: v.id("driverSeriesPenalties"),
    driverId: v.id("drivers"),
    userId: v.id("users"),
    seriesId: v.id("series"),
    seriesPenaltyId: v.id("seriesPenalties"),
    seriesPenaltyThresholdId: v.id("seriesPenaltyThresholds"),
    status: v.union(
      v.literal("open"),
      v.literal("scheduled"),
      v.literal("completed"),
    ),
    availabilityWindows: v.array(
      v.object({
        startAt: v.number(),
        endAt: v.number(),
      }),
    ),
    selectedMeetingStartAt: v.optional(v.number()),
    selectedMeetingEndAt: v.optional(v.number()),
    scheduledBy: v.optional(v.id("users")),
    scheduledAt: v.optional(v.number()),
    meetingThreadId: v.optional(v.string()),
    meetingReminderJobId: v.optional(v.id("_scheduled_functions")),
    meetingReminderSentAt: v.optional(v.number()),
    meetingReminderError: v.optional(v.string()),
    completedBy: v.optional(v.id("users")),
    completedAt: v.optional(v.number()),
    notificationSentAt: v.optional(v.number()),
    notificationError: v.optional(v.string()),
    notes: v.optional(v.string()),
    notesUpdatedAt: v.optional(v.number()),
    notesUpdatedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_driver_series_penalty", ["driverSeriesPenaltyId"])
    .index("by_status", ["status"])
    .index("by_series", ["seriesId"])
    .index("by_driver", ["driverId"]),

  reports: defineTable({
    reportDate: v.number(),
    reportingDriverId: v.optional(v.id("drivers")),
    reportingUserId: v.optional(v.id("users")),
    reportedDriverId: v.id("drivers"),
    eventId: v.id("events"),
    raceId: v.id("races"),
    lap: v.string(),
    turn: v.string(),
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
    atFaultDriverId: v.optional(v.id("drivers")),
    isNoDriverAtFault: v.optional(v.boolean()),
    officialNotes: v.optional(v.string()),
    finalizedBy: v.optional(v.id("users")),
    finalizedAt: v.optional(v.number()),
    editedBy: v.optional(v.id("users")),
    editedAt: v.optional(v.number()),
    isSelfReport: v.optional(v.boolean()),
    isStewardReported: v.optional(v.boolean()),
    isEdited: v.optional(v.boolean()),
    videoLink: v.optional(v.string()),
    videoTimestamp: v.optional(v.string()),
    reportId: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_event", ["eventId"])
    .index("by_reporting_driver", ["reportingDriverId"])
    .index("by_reporting_user", ["reportingUserId"])
    .index("by_reported_driver", ["reportedDriverId"])
    .index("by_date", ["reportDate"])
    .index("by_reportId", ["reportId"]),

  reviews: defineTable({
    reviewDate: v.number(),
    userId: v.id("users"),
    reportId: v.id("reports"),
    incidentDescription: v.string(),
    reviewNotes: v.string(),
    candidateForStandardization: v.optional(v.boolean()),
    recommendedPenalty: v.optional(v.string()),
    atFaultDriverId: v.optional(v.id("drivers")),
    isNoDriverAtFault: v.optional(v.boolean()),
    videoTimestamp: v.optional(v.string()),
    linkedReviewId: v.optional(v.id("reviews")),
    isSelfReport: v.optional(v.boolean()),
    isAdjusted: v.optional(v.boolean()),
    adjustedReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_report", ["reportId"])
    .index("by_user", ["userId"]),
});
