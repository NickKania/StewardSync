import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  roles: defineTable({
    RoleName: v.union(
      v.literal("Driver"),
      v.literal("Steward"),
      v.literal("Head Steward"),
      v.literal("Event Manager"),
      v.literal("Admin")
    ),
  }).index("by_role_name", ["RoleName"]),

  users: defineTable({
    UserName: v.string(),
    Role: v.id("roles"),
    email: v.string(),
    tokenIdentifier: v.string(),
    createdAt: v.number(),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"]),

  drivers: defineTable({
    DriverNumber: v.number(),
    DriverName: v.string(),
    ExternalId: v.string(),
    DriverClass: v.string(),
  })
    .index("by_driver_number", ["DriverNumber"])
    .index("by_external_id", ["ExternalId"]),

  events: defineTable({
    Series: v.string(),
    EventNumber: v.number(),
    TrackName: v.string(),
    EventDate: v.number(),
  })
    .index("by_series", ["Series"])
    .index("by_date", ["EventDate"]),

  races: defineTable({
    Event: v.id("events"),
    RaceNumber: v.number(),
  })
    .index("by_event", ["Event"])
    .index("by_event_and_number", ["Event", "RaceNumber"]),

  reports: defineTable({
    ReportDate: v.number(),
    ReportingDriver: v.id("drivers"),
    ReportedDriver: v.id("drivers"),
    Event: v.id("events"),
    Race: v.id("races"),
    Turn: v.number(),
    Description: v.string(),
    IsFinalized: v.boolean(),
    createdBy: v.id("users"),
  })
    .index("by_event", ["Event"])
    .index("by_reported_driver", ["ReportedDriver"])
    .index("by_is_finalized", ["IsFinalized"])
    .index("by_date", ["ReportDate"]),

  reviews: defineTable({
    ReviewDate: v.number(),
    UserId: v.id("users"),
    ReviewedReport: v.id("reports"),
    IncidentDescription: v.string(),
    ReviewNotes: v.string(),
  })
    .index("by_report", ["ReviewedReport"])
    .index("by_user", ["UserId"])
    .index("by_date", ["ReviewDate"]),
});
