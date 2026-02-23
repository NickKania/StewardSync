import { query } from "./_generated/server";
import { v } from "convex/values";

export const getByEntity = query({
  args: {
    tableName: v.string(),
    documentId: v.string(),
  },
  handler: async (ctx, args) => {
    const changes = await ctx.db
      .query("changeHistory")
      .withIndex("by_entity", (q) =>
        q.eq("tableName", args.tableName).eq("documentId", args.documentId),
      )
      .order("desc")
      .collect();

    const changesWithUser = await Promise.all(
      changes.map(async (change) => {
        const user = change.changedByUserId
          ? await ctx.db.get(change.changedByUserId)
          : null;
        return {
          ...change,
          changedByUser: user,
        };
      }),
    );

    return changesWithUser;
  },
});

export const getByEntityField = query({
  args: {
    tableName: v.string(),
    documentId: v.string(),
    fieldName: v.string(),
  },
  handler: async (ctx, args) => {
    const changes = await ctx.db
      .query("changeHistory")
      .withIndex("by_entity_field", (q) =>
        q
          .eq("tableName", args.tableName)
          .eq("documentId", args.documentId)
          .eq("fieldName", args.fieldName),
      )
      .order("desc")
      .collect();

    const changesWithUser = await Promise.all(
      changes.map(async (change) => {
        const user = change.changedByUserId
          ? await ctx.db.get(change.changedByUserId)
          : null;
        return {
          ...change,
          changedByUser: user,
        };
      }),
    );

    return changesWithUser;
  },
});

export const getReportHistory = query({
  args: {
    reportId: v.id("reports"),
  },
  handler: async (ctx, args) => {
    const changes = await ctx.db
      .query("changeHistory")
      .withIndex("by_entity", (q) =>
        q.eq("tableName", "reports").eq("documentId", args.reportId.toString()),
      )
      .order("desc")
      .collect();

    const changesWithUser = await Promise.all(
      changes.map(async (change) => {
        const user = change.changedByUserId
          ? await ctx.db.get(change.changedByUserId)
          : null;
        return {
          ...change,
          changedByUser: user,
        };
      }),
    );

    return changesWithUser;
  },
});

export const getReviewHistory = query({
  args: {
    reviewId: v.id("reviews"),
  },
  handler: async (ctx, args) => {
    const changes = await ctx.db
      .query("changeHistory")
      .withIndex("by_entity", (q) =>
        q.eq("tableName", "reviews").eq("documentId", args.reviewId.toString()),
      )
      .order("desc")
      .collect();

    const changesWithUser = await Promise.all(
      changes.map(async (change) => {
        const user = change.changedByUserId
          ? await ctx.db.get(change.changedByUserId)
          : null;
        return {
          ...change,
          changedByUser: user,
        };
      }),
    );

    return changesWithUser;
  },
});
