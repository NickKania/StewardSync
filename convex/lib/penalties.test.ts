import { describe, expect, it } from "bun:test";

import { isSeriesPenaltyThresholdMet } from "./penalties";

describe("isSeriesPenaltyThresholdMet", () => {
  it("matches when points equal the threshold", () => {
    expect(isSeriesPenaltyThresholdMet(6, 6)).toBe(true);
  });

  it("matches when points exceed the threshold", () => {
    expect(isSeriesPenaltyThresholdMet(7, 6)).toBe(true);
  });

  it("does not match before points reach the threshold", () => {
    expect(isSeriesPenaltyThresholdMet(5, 6)).toBe(false);
  });
});
