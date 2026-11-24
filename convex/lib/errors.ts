import { ConvexError } from "convex/values";

/**
 * Custom error class for user-facing validation errors.
 * These errors should be shown to users via toast notifications
 * but should not clutter the console as "Uncaught Error".
 */
export class UserFacingError extends ConvexError<string> {
  override name = "UserFacingError";

  constructor(message: string) {
    super(message);
  }
}
