import type { QueryCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { UserFacingError } from "./errors";

const ROLE_HIERARCHY = [
  "driver",
  "steward",
  "head_steward",
  "event_manager",
  "league_manager",
];

export async function getCurrentUserRole(ctx: QueryCtx, userId: Id<"users">) {
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

export async function requireExactRole(
  ctx: QueryCtx,
  userId: Id<"users">,
  allowedRoles: readonly string[],
) {
  const userRole = await getCurrentUserRole(ctx, userId);

  if (!allowedRoles.includes(userRole)) {
    throw new UserFacingError(
      `Unauthorized. Required roles: ${allowedRoles.join(", ")}. User role: ${userRole}`
    );
  }
}

export async function requireRole(
  ctx: QueryCtx,
  userId: Id<"users">,
  allowedRoles: string[]
) {
  const userRole = await getCurrentUserRole(ctx, userId);

  const hasPermission = allowedRoles.some((allowedRole) =>
    hasMinimumRole(userRole, allowedRole)
  );

  if (!hasPermission) {
    throw new UserFacingError(
      `Unauthorized. Required roles: ${allowedRoles.join(", ")}. User role: ${userRole}`
    );
  }
}
