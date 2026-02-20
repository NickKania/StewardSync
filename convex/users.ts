import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./lib/auth";
import { UserFacingError } from "./lib/errors";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();

    const usersWithRoles = await Promise.all(
      users.map(async (user) => {
        const role = await ctx.db.get(user.roleId);
        return { ...user, role };
      })
    );

    return usersWithRoles;
  },
});

export const getById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const role = await ctx.db.get(user.roleId);
    return { ...user, role };
  },
});

export const updateRole = mutation({
  args: {
    userId: v.id("users"),
    roleId: v.id("roles"),
    currentUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { userId, roleId, currentUserId } = args;

    // Verify current user is league_manager
    await requireRole(ctx, currentUserId, ["league_manager"]);

    // Prevent self-role changes
    if (userId === currentUserId) {
      throw new UserFacingError("Cannot change your own role");
    }

    // Verify role exists
    const role = await ctx.db.get(roleId);
    if (!role) {
      throw new Error("Role not found");
    }

    await ctx.db.patch(userId, { roleId });
    return userId;
  },
});

export const listRoles = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("roles").collect();
  },
});

export const listStewards = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const roles = await ctx.db.query("roles").collect();
    const stewardRoleIds = roles.filter(r =>
      r.name === 'steward' ||
      r.name === 'head_steward' ||
      r.name === 'league_manager'
    ).map(r => r._id);

    const stewards = users.filter(user => stewardRoleIds.includes(user.roleId));

    const usersWithRoles = await Promise.all(
      stewards.map(async (user) => {
        const role = await ctx.db.get(user.roleId);
        return { ...user, role };
      })
    );

    return usersWithRoles;
  },
});

export const updateOfficialName = mutation({
  args: {
    userId: v.id("users"),
    officialName: v.string(),
    currentUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { userId, officialName, currentUserId } = args;

    // Verify current user is event_manager or higher
    await requireRole(ctx, currentUserId, ["event_manager", "league_manager"]);

    // Trim whitespace, store undefined for empty string
    const trimmed = officialName.trim();
    await ctx.db.patch(userId, {
      officialName: trimmed || undefined,
    });

    return userId;
  },
});

export const updateNote = mutation({
  args: {
    userId: v.id("users"),
    note: v.string(),
    currentUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { userId, note, currentUserId } = args;

    // Verify current user is steward or higher
    await requireRole(ctx, currentUserId, ["steward"]);

    const trimmed = note.trim();
    await ctx.db.patch(userId, {
      note: trimmed || undefined,
    });

    return userId;
  },
});
