import { mutation } from "./_generated/server";

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    // Create roles
    const driverRole = await ctx.db.insert("roles", {
      RoleName: "Driver",
    });

    const stewardRole = await ctx.db.insert("roles", {
      RoleName: "Steward",
    });

    const headStewardRole = await ctx.db.insert("roles", {
      RoleName: "Head Steward",
    });

    const eventManagerRole = await ctx.db.insert("roles", {
      RoleName: "Event Manager",
    });

    const adminRole = await ctx.db.insert("roles", {
      RoleName: "Admin",
    });

    // Create sample drivers
    await ctx.db.insert("drivers", {
      DriverNumber: 1,
      DriverName: "Max Verstappen",
      ExternalId: "MV1",
      DriverClass: "Pro",
    });

    await ctx.db.insert("drivers", {
      DriverNumber: 44,
      DriverName: "Lewis Hamilton",
      ExternalId: "LH44",
      DriverClass: "Pro",
    });

    await ctx.db.insert("drivers", {
      DriverNumber: 16,
      DriverName: "Charles Leclerc",
      ExternalId: "CL16",
      DriverClass: "Pro",
    });

    await ctx.db.insert("drivers", {
      DriverNumber: 55,
      DriverName: "Carlos Sainz",
      ExternalId: "CS55",
      DriverClass: "Pro",
    });

    await ctx.db.insert("drivers", {
      DriverNumber: 4,
      DriverName: "Lando Norris",
      ExternalId: "LN4",
      DriverClass: "Pro",
    });

    // Create sample events
    const event1 = await ctx.db.insert("events", {
      Series: "Formula 1",
      EventNumber: 1,
      TrackName: "Bahrain International Circuit",
      EventDate: Date.now(),
    });

    const event2 = await ctx.db.insert("events", {
      Series: "Formula 1",
      EventNumber: 2,
      TrackName: "Jeddah Corniche Circuit",
      EventDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    // Create sample races
    await ctx.db.insert("races", {
      Event: event1,
      RaceNumber: 1,
    });

    await ctx.db.insert("races", {
      Event: event1,
      RaceNumber: 2,
    });

    await ctx.db.insert("races", {
      Event: event2,
      RaceNumber: 1,
    });

    return {
      message: "Seed data created successfully",
      roles: [driverRole, stewardRole, headStewardRole, eventManagerRole, adminRole],
    };
  },
});
