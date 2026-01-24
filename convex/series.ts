import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { UserFacingError } from "./lib/errors";

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("series").order("desc").collect();
  },
});

export const getById = query({
  args: { id: v.id("series") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    simgridLink: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const seriesId = await ctx.db.insert("series", {
      name: args.name,
      description: args.description,
      simgridLink: args.simgridLink,
      createdAt: Date.now(),
    });
    return seriesId;
  },
});

export const update = mutation({
  args: {
    id: v.id("series"),
    name: v.string(),
    description: v.optional(v.string()),
    simgridLink: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("series") },
  handler: async (ctx, args) => {
    // Check if any events are using this series
    const events = await ctx.db
      .query("events")
      .withIndex("by_series", (q) => q.eq("seriesId", args.id))
      .first();

    if (events) {
      throw new UserFacingError("Cannot delete series with existing events");
    }

    await ctx.db.delete(args.id);
  },
});
