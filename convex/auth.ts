import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getOrCreateUser = mutation({
  args: {
    email: v.optional(v.string()),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    discordId: v.string(),
    discordUsername: v.optional(v.string()),
    discordGlobalName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user exists by Discord ID
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_discord_id", (q) => q.eq("discordId", args.discordId))
      .first();

    if (existingUser) {
      const updates = Object.fromEntries(
        Object.entries({
          email: args.email,
          name: args.name,
          avatarUrl: args.avatarUrl,
          discordUsername: args.discordUsername,
          discordGlobalName: args.discordGlobalName,
        }).filter(([_, value]) => value !== undefined),
      );

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existingUser._id, updates);
      }

      await linkDriversByDiscordUsername(
        ctx,
        existingUser._id,
        args.discordUsername,
        args.discordGlobalName,
      );
      return existingUser._id;
    }

    // Get default role (driver)
    let defaultRole = await ctx.db
      .query("roles")
      .withIndex("by_name", (q) => q.eq("name", "driver"))
      .first();

    // Create default role if it doesn't exist
    if (!defaultRole) {
      const roleId = await ctx.db.insert("roles", {
        name: "driver",
        displayName: "Driver",
      });
      defaultRole = await ctx.db.get(roleId);
    }

    // Create new user
    const userId = await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
      avatarUrl: args.avatarUrl,
      discordId: args.discordId,
      discordUsername: args.discordUsername,
      discordGlobalName: args.discordGlobalName,
      roleId: defaultRole!._id,
      createdAt: Date.now(),
    });

    await linkDriversByDiscordUsername(
      ctx,
      userId,
      args.discordUsername,
      args.discordGlobalName,
    );
    return userId;
  },
});

const linkDriversByDiscordUsername = async (
  ctx: any,
  userId: any,
  discordUsername?: string,
  discordGlobalName?: string,
): Promise<void> => {
  let matchedDrivers: any[] = [];

  if (discordUsername) {
    matchedDrivers = await ctx.db
      .query("drivers")
      .withIndex("by_username", (q: any) => q.eq("username", discordUsername))
      .collect();
  }

  if (matchedDrivers.length === 0 && discordGlobalName) {
    matchedDrivers = await ctx.db
      .query("drivers")
      .withIndex("by_username", (q: any) => q.eq("username", discordGlobalName))
      .collect();
  }

  // Get the user to check if they have an officialName
  const user = await ctx.db.get(userId);

  await Promise.all(
    matchedDrivers.map(async (driver) => {
      if (driver.userId && driver.userId !== userId) {
        return;
      }

      if (!driver.userId) {
        await ctx.db.patch(driver._id, { userId });

        // Auto-populate officialName on first driver link if user doesn't have one
        if (user && !user.officialName) {
          await ctx.db.patch(userId, { officialName: driver.driverName });
        }
      }
    }),
  );
};

export const getCurrentUser = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    if (!args.userId) {
      return null;
    }

    const user = await ctx.db.get(args.userId);
    if (!user) {
      return null;
    }

    const role = await ctx.db.get(user.roleId);

    return {
      ...user,
      role,
    };
  },
});

export const getUserByDiscordId = query({
  args: { discordId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_discord_id", (q) => q.eq("discordId", args.discordId))
      .first();

    if (!user) {
      return null;
    }

    const role = await ctx.db.get(user.roleId);

    return {
      ...user,
      role,
    };
  },
});

export const getDevUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();

    // Filter for demo/dev users (those with discordId starting with "demo-")
    const devUsers = users.filter((user) =>
      user.email?.endsWith("demo.stewardsync.com"),
    );

    // Get roles for each user
    const usersWithRoles = await Promise.all(
      devUsers.map(async (user) => {
        const role = await ctx.db.get(user.roleId);
        return {
          ...user,
          role,
        };
      }),
    );

    return usersWithRoles;
  },
});
