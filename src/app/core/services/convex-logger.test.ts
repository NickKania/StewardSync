import { describe, expect, it, spyOn } from "bun:test";
import { ConvexError } from "convex/values";
import { ConvexCustomLogger } from "./convex-logger";

describe("ConvexCustomLogger", () => {
  it("filters ConvexError instances and log strings from console.error", () => {
    const logger = new ConvexCustomLogger();
    const consoleError = spyOn(console, "error").mockImplementation(() => {});
    try {
      logger.error(new ConvexError("Validation failed"));
      logger.error('[CONVEX M(reports:create)] ConvexError "Reports have been locked"');
      logger.error("Uncaught UserFacingError: Unauthorized");
      expect(consoleError).not.toHaveBeenCalled();

      logger.error(new Error("Unexpected database failure"));
      expect(consoleError).toHaveBeenCalledTimes(1);
    } finally {
      consoleError.mockRestore();
    }
  });
});
