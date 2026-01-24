import { Id } from "../_generated/dataModel";

const ROLE_HIERARCHY = [
  "driver",
  "steward",
  "head_steward",
  "event_manager",
  "league_manager",
];

export async function getCurrentUserRole(ctx: any, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const role = await ctx.db.get(user.roleId);
  if (!role) {
    throw new Error("User role not found");
  }

  return role.name;
}

export function hasMinimumRole(
  userRole: string,
  minimumRole: string
): boolean {
  const userRoleIndex = ROLE_HIERARCHY.indexOf(userRole);
  const minimumRoleIndex = ROLE_HIERARCHY.indexOf(minimumRole);

  if (userRoleIndex === -1 || minimumRoleIndex === -1) {
    return false;
  }

  return userRoleIndex >= minimumRoleIndex;
}

export async function requireRole(
  ctx: any,
  userId: Id<"users">,
  allowedRoles: string[]
) {
  const userRole = await getCurrentUserRole(ctx, userId);

  const hasPermission = allowedRoles.some((allowedRole) =>
    hasMinimumRole(userRole, allowedRole)
  );

  if (!hasPermission) {
    throw new Error(
      `Unauthorized. Required roles: ${allowedRoles.join(", ")}. User role: ${userRole}`
    );
  }
}
