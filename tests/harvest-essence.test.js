import { describe, it, expect } from "vitest";
import { ESSENCE_TABLE, getEssenceByCR } from "../src/harvest/logic.js";

// ─── ESSENCE_TABLE structure ───────────────────────────────────────────────────

describe("ESSENCE_TABLE — structure", () => {
  it("has 5 entries", () => {
    expect(ESSENCE_TABLE.length).toBe(5);
  });

  it("all names follow 'Essence (X)' format to match compendium", () => {
    for (const entry of ESSENCE_TABLE) {
      expect(entry.name, `"${entry.name}" does not match compendium format`).toMatch(
        /^Essence \(\w+\)$/
      );
    }
  });

  it("every entry has the required fields: name, rarity, dc, crMin, crMax", () => {
    for (const entry of ESSENCE_TABLE) {
      expect(typeof entry.name).toBe("string");
      expect(typeof entry.rarity).toBe("string");
      expect(typeof entry.dc).toBe("number");
      expect(typeof entry.crMin).toBe("number");
      expect(typeof entry.crMax).toBe("number");
    }
  });

  it("DC values increase with each tier", () => {
    for (let i = 1; i < ESSENCE_TABLE.length; i++) {
      expect(
        ESSENCE_TABLE[i].dc,
        `Tier ${i} DC should be higher than tier ${i - 1}`
      ).toBeGreaterThan(ESSENCE_TABLE[i - 1].dc);
    }
  });

  it("CR ranges are non-overlapping and sorted ascending", () => {
    for (let i = 1; i < ESSENCE_TABLE.length; i++) {
      expect(
        ESSENCE_TABLE[i].crMin,
        `Tier ${i} crMin should be greater than tier ${i - 1} crMax`
      ).toBeGreaterThan(ESSENCE_TABLE[i - 1].crMax);
    }
  });

  it("entries are sorted by crMin ascending", () => {
    for (let i = 1; i < ESSENCE_TABLE.length; i++) {
      expect(ESSENCE_TABLE[i].crMin).toBeGreaterThan(ESSENCE_TABLE[i - 1].crMin);
    }
  });
});

// ─── getEssenceByCR — CR range mapping ────────────────────────────────────────

describe("getEssenceByCR — CR range mapping", () => {
  it("CR 0-2 → fallback Essence (Frail)", () => {
    for (const cr of [0, 1, 2]) {
      expect(getEssenceByCR(cr).name, `CR ${cr}`).toBe("Essence (Frail)");
    }
  });

  it("CR 3-6 → Essence (Frail)", () => {
    expect(getEssenceByCR(3).name).toBe("Essence (Frail)");
    expect(getEssenceByCR(6).name).toBe("Essence (Frail)");
  });

  it("CR 7-11 → Essence (Robust)", () => {
    expect(getEssenceByCR(7).name).toBe("Essence (Robust)");
    expect(getEssenceByCR(11).name).toBe("Essence (Robust)");
  });

  it("CR 12-17 → Essence (Potent)", () => {
    expect(getEssenceByCR(12).name).toBe("Essence (Potent)");
    expect(getEssenceByCR(17).name).toBe("Essence (Potent)");
  });

  it("CR 18-24 → Essence (Mythic)", () => {
    expect(getEssenceByCR(18).name).toBe("Essence (Mythic)");
    expect(getEssenceByCR(24).name).toBe("Essence (Mythic)");
  });

  it("CR 25+ → Essence (Deific)", () => {
    expect(getEssenceByCR(25).name).toBe("Essence (Deific)");
    expect(getEssenceByCR(30).name).toBe("Essence (Deific)");
    expect(getEssenceByCR(99).name).toBe("Essence (Deific)");
  });
});

// ─── getEssenceByCR — boundary values ─────────────────────────────────────────

describe("getEssenceByCR — boundaries", () => {
  it("handles exact tier boundaries correctly", () => {
    // Lower bound of each tier
    expect(getEssenceByCR(3).name).toBe("Essence (Frail)");
    expect(getEssenceByCR(7).name).toBe("Essence (Robust)");
    expect(getEssenceByCR(12).name).toBe("Essence (Potent)");
    expect(getEssenceByCR(18).name).toBe("Essence (Mythic)");
    expect(getEssenceByCR(25).name).toBe("Essence (Deific)");
  });

  it("handles upper boundary of each tier correctly", () => {
    expect(getEssenceByCR(6).name).toBe("Essence (Frail)");
    expect(getEssenceByCR(11).name).toBe("Essence (Robust)");
    expect(getEssenceByCR(17).name).toBe("Essence (Potent)");
    expect(getEssenceByCR(24).name).toBe("Essence (Mythic)");
  });
});

// ─── getEssenceByCR — return shape ────────────────────────────────────────────

describe("getEssenceByCR — return shape", () => {
  it("always returns an object with name, rarity, and dc", () => {
    for (const cr of [0, 5, 10, 15, 20, 25]) {
      const result = getEssenceByCR(cr);
      expect(result).toHaveProperty("name");
      expect(result).toHaveProperty("rarity");
      expect(result).toHaveProperty("dc");
    }
  });

  it("name is always a non-empty string", () => {
    for (const cr of [0, 5, 10, 15, 20, 25]) {
      const { name } = getEssenceByCR(cr);
      expect(typeof name).toBe("string");
      expect(name.trim().length).toBeGreaterThan(0);
    }
  });

  it("dc is always a positive number", () => {
    for (const cr of [0, 5, 10, 15, 20, 25]) {
      expect(getEssenceByCR(cr).dc).toBeGreaterThan(0);
    }
  });
});
