import { describe, it, expect } from "vitest";
import { computeHarvestDC, rollOutcome } from "../../src/harvest/logic.js";

describe("computeHarvestDC", () => {
  it("scales with CR", () => {
    expect(computeHarvestDC({ cr: 0 })).toBe(10);
    expect(computeHarvestDC({ cr: 5 })).toBe(12);
    expect(computeHarvestDC({ cr: 20 })).toBe(20);
  });
  it("respects rarity modifier", () => {
    expect(computeHarvestDC({ cr: 10, rarityMultiplier: 5 })).toBe(20);
  });
});

describe("rollOutcome", () => {
  it("classifies outcomes", () => {
    const dc = 15;
    expect(rollOutcome({ rollTotal: 26, dc })).toBe("critical-success");
    expect(rollOutcome({ rollTotal: 15, dc })).toBe("success");
    expect(rollOutcome({ rollTotal: 5, dc })).toBe("critical-failure");
    expect(rollOutcome({ rollTotal: 14, dc })).toBe("failure");
  });
});
