import type { RoleName } from "./user.model";

export const REVIEW_ROLES = ["steward", "head_steward", "league_manager"] as const satisfies readonly RoleName[];
export const FINALIZATION_ROLES = ["head_steward", "league_manager"] as const satisfies readonly RoleName[];
export const DRIVER_DIRECTORY_ROLES = ["steward", "head_steward", "event_manager", "league_manager"] as const satisfies readonly RoleName[];
