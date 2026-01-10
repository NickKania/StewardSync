import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
  },
  handler: async (ctx, args) => {
    const { userId, roleId } = args;

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
