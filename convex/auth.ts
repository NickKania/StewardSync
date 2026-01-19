import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getOrCreateUser = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    discordId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if user exists by Discord ID
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_discord_id", (q) => q.eq("discordId", args.discordId))
      .first();

    if (existingUser) {
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
      roleId: defaultRole!._id,
      createdAt: Date.now(),
    });

    return userId;
  },
});

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
