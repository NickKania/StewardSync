import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./lib/auth";
import { UserFacingError } from "./lib/errors";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const [users, roles] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("roles").collect(),
    ]);
    const rolesById = new Map(roles.map((role) => [role._id, role]));
    return users.map((user) => ({ ...user, role: rolesById.get(user.roleId) ?? null }));
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
    const [users, roles] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("roles").collect(),
    ]);
    const stewardRoles = new Map(roles
      .filter((role) => ["steward", "head_steward", "league_manager"].includes(role.name))
      .map((role) => [role._id, role]));
    return users.flatMap((user) => {
      const role = stewardRoles.get(user.roleId);
      return role ? [{ ...user, role }] : [];
    });
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
