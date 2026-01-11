import { mutation } from "./_generated/server";

export const seedRoles = mutation({
  args: {},
  handler: async (ctx) => {
    const roles = [
      { name: "driver", displayName: "Driver" },
      { name: "steward", displayName: "Steward" },
      { name: "head_steward", displayName: "Head Steward" },
      { name: "event_manager", displayName: "Event Manager" },
    ];

    for (const role of roles) {
      const existing = await ctx.db
        .query("roles")
        .withIndex("by_name", (q) => q.eq("name", role.name))
        .first();

      if (!existing) {
        await ctx.db.insert("roles", role);
      }
    }

    return "Roles seeded successfully";
  },
});

export const seedDemoUsers = mutation({
  args: {},
  handler: async (ctx) => {
    // Get head_steward role
    const headStewardRole = await ctx.db
      .query("roles")
      .withIndex("by_name", (q) => q.eq("name", "head_steward"))
      .first();

    if (!headStewardRole) {
      throw new Error("head_steward role not found. Run seedRoles first.");
    }

    // Get steward role
    const stewardRole = await ctx.db
      .query("roles")
      .withIndex("by_name", (q) => q.eq("name", "steward"))
      .first();

    if (!stewardRole) {
      throw new Error("steward role not found. Run seedRoles first.");
    }

    // Define demo users
    const demoUsers = [
      {
        email: "headsteward@demo.stewardsync.com",
        name: "Demo Head Steward",
        discordId: "demo-head-steward-001",
        roleId: headStewardRole._id,
      },
      {
        email: "steward@demo.stewardsync.com",
        name: "Demo Steward",
        discordId: "demo-steward-001",
        roleId: stewardRole._id,
      },
    ];

    for (const demoUser of demoUsers) {
      // Check if demo user already exists
      const existing = await ctx.db
        .query("users")
        .withIndex("by_discord_id", (q) => q.eq("discordId", demoUser.discordId))
        .first();

      if (!existing) {
        await ctx.db.insert("users", {
          ...demoUser,
          createdAt: Date.now(),
        });
      }
    }

    return "Demo users seeded successfully";
  },
});

export const seedSampleData = mutation({
  args: {},
  handler: async (ctx) => {
    // Seed sample drivers
    const sampleDrivers = [
      { driverNumber: 1, driverName: "Max Verstappen", driverClass: "Pro", externalId: "VER" },
      { driverNumber: 11, driverName: "Sergio Perez", driverClass: "Pro", externalId: "PER" },
      { driverNumber: 44, driverName: "Lewis Hamilton", driverClass: "Pro", externalId: "HAM" },
      { driverNumber: 63, driverName: "George Russell", driverClass: "Pro", externalId: "RUS" },
      { driverNumber: 16, driverName: "Charles Leclerc", driverClass: "Pro", externalId: "LEC" },
      { driverNumber: 55, driverName: "Carlos Sainz", driverClass: "Pro", externalId: "SAI" },
      { driverNumber: 4, driverName: "Lando Norris", driverClass: "Pro", externalId: "NOR" },
      { driverNumber: 81, driverName: "Oscar Piastri", driverClass: "Pro", externalId: "PIA" },
    ];

    for (const driver of sampleDrivers) {
      const existing = await ctx.db
        .query("drivers")
        .withIndex("by_number", (q) => q.eq("driverNumber", driver.driverNumber))
        .first();

      if (!existing) {
        await ctx.db.insert("drivers", {
          ...driver,
          createdAt: Date.now(),
        });
      }
    }

    // Seed sample events
    const sampleEvents = [
      { series: "F1 Sim League", eventNumber: 1, trackName: "Bahrain International Circuit", eventDate: Date.now() - 7 * 24 * 60 * 60 * 1000 },
      { series: "F1 Sim League", eventNumber: 2, trackName: "Jeddah Corniche Circuit", eventDate: Date.now() },
      { series: "F1 Sim League", eventNumber: 3, trackName: "Albert Park Circuit", eventDate: Date.now() + 7 * 24 * 60 * 60 * 1000 },
    ];

    for (const event of sampleEvents) {
      const existing = await ctx.db
        .query("events")
        .filter((q) =>
          q.and(
            q.eq(q.field("series"), event.series),
            q.eq(q.field("eventNumber"), event.eventNumber)
          )
        )
        .first();

      if (!existing) {
        const eventId = await ctx.db.insert("events", {
          ...event,
          createdAt: Date.now(),
        });

        // Add races to each event
        await ctx.db.insert("races", { eventId, raceNumber: 1, createdAt: Date.now() });
        await ctx.db.insert("races", { eventId, raceNumber: 2, createdAt: Date.now() });
      }
    }

    return "Sample data seeded successfully";
  },
});
