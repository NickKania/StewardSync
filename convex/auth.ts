import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getOrCreateUser = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    googleId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if user exists by Google ID
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_google_id", (q) => q.eq("googleId", args.googleId))
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
      googleId: args.googleId,
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
