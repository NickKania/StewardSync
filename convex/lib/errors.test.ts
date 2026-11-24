import { expect, it } from "bun:test";
import { ConvexError } from "convex/values";
import { UserFacingError } from "./errors";

it("preserves validation text as both the Error message and Convex error data", () => {
  const error = new UserFacingError("Select a race.");
  expect(error).toBeInstanceOf(ConvexError);
  expect(error).toBeInstanceOf(UserFacingError);
  expect(error.name).toBe("UserFacingError");
  expect(error.message).toBe("Select a race.");
  expect(error.data).toBe("Select a race.");
});
