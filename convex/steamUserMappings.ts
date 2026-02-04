import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { UserFacingError } from "./lib/errors";

export const getBySteamId = query({
  args: { steamId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("steamUserMappings")
      .withIndex("by_steam_id", (q) => q.eq("steamId", args.steamId))
      .first();
  },
});

export const getByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("steamUserMappings")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const create = mutation({
  args: {
    steamId: v.string(),
    userId: v.id("users"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("steamUserMappings")
      .withIndex("by_steam_id", (q) => q.eq("steamId", args.steamId))
      .first();

    if (existing) {
      throw new UserFacingError(`Steam ID ${args.steamId} is already associated with another user`);
    }

    await ctx.db.insert("steamUserMappings", {
      steamId: args.steamId,
      userId: args.userId,
      isBanned: false,
      note: args.note,
      createdAt: Date.now(),
    });
  },
});

export const deleteBySteamId = mutation({
  args: { steamId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("steamUserMappings")
      .withIndex("by_steam_id", (q) => q.eq("steamId", args.steamId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const updateNote = mutation({
  args: {
    steamId: v.string(),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("steamUserMappings")
      .withIndex("by_steam_id", (q) => q.eq("steamId", args.steamId))
      .first();

    if (!existing) {
      throw new UserFacingError("Steam ID mapping not found");
    }

    await ctx.db.patch(existing._id, { note: args.note });
  },
});

export const toggleBan = mutation({
  args: {
    steamId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("steamUserMappings")
      .withIndex("by_steam_id", (q) => q.eq("steamId", args.steamId))
      .first();

    if (!existing) {
      throw new UserFacingError("Steam ID mapping not found");
    }

    await ctx.db.patch(existing._id, { isBanned: !existing.isBanned });
  },
});

export const updateUserAssociation = mutation({
  args: {
    steamId: v.string(),
    oldUserId: v.id("users"),
    newUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("steamUserMappings")
      .withIndex("by_steam_id", (q) => q.eq("steamId", args.steamId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    await ctx.db.insert("steamUserMappings", {
      steamId: args.steamId,
      userId: args.newUserId,
      isBanned: false,
      createdAt: Date.now(),
    });
  },
});
