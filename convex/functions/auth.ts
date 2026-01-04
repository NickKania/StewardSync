import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    return user;
  },
});

export const getUserRole = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (!user) {
      return null;
    }

    const role = await ctx.db.get(user.Role);
    return role?.RoleName || null;
  },
});

export const hasPermission = query({
  args: {
    requiredRole: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (!user) {
      return false;
    }

    const role = await ctx.db.get(user.Role);
    if (!role) {
      return false;
    }

    const roleHierarchy = {
      "Driver": 1,
      "Steward": 2,
      "Head Steward": 3,
      "Event Manager": 3,
      "Admin": 4,
    };

    const userLevel = roleHierarchy[role.RoleName as keyof typeof roleHierarchy] || 0;
    const requiredLevel = roleHierarchy[args.requiredRole as keyof typeof roleHierarchy] || 0;

    return userLevel >= requiredLevel;
  },
});

export const isSteward = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (!user) {
      return false;
    }

    const role = await ctx.db.get(user.Role);
    if (!role) {
      return false;
    }

    return ["Steward", "Head Steward", "Event Manager", "Admin"].includes(role.RoleName);
  },
});

export const isHeadSteward = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (!user) {
      return false;
    }

    const role = await ctx.db.get(user.Role);
    if (!role) {
      return false;
    }

    return ["Head Steward", "Event Manager", "Admin"].includes(role.RoleName);
  },
});

export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (!user) {
      return false;
    }

    const role = await ctx.db.get(user.Role);
    if (!role) {
      return false;
    }

    return role.RoleName === "Admin";
  },
});
