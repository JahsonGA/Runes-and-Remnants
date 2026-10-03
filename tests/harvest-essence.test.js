import { describe, it, expect } from "vitest";
import { ESSENCE_TABLE, getEssenceByCR, essenceDC, isEssenceName, lowestComponentDC } from "../src/harvest/logic.js";

// ─── ESSENCE_TABLE structure ───────────────────────────────────────────────────

describe("ESSENCE_TABLE — structure", () => {
  it("has 5 entries", () => {
    expect(ESSENCE_TABLE.length).toBe(5);
  });

  it("all names follow 'Remnant (X)' format to match compendium", () => {
    for (const entry of ESSENCE_TABLE) {
      expect(entry.name, `"${entry.name}" does not match compendium format`).toMatch(
        /^Remnant \(\w+\)$/
      );
    }
  });

  it("still recognises the old 'Essence (X)' name every entry was renamed from", () => {
    // Worlds already hold items under the old name. Matching is by name, so
    // dropping the legacy spelling would make a party's hard-won remnants
    // invisible to enchanting overnight.
    for (const entry of ESSENCE_TABLE) {
      expect(entry.legacyName, `"${entry.name}" has no legacy name`).toMatch(
        /^Essence \(\w+\)$/
      );
      expect(essenceDC(entry.legacyName), `"${entry.legacyName}" no longer resolves`)
        .toBe(entry.dc);
      expect(essenceDC(entry.name)).toBe(entry.dc);
    }
  });

  it("knows a remnant from an ordinary component", () => {
    // lowestComponentDC only scanned HARVEST_TABLE, so an unstamped remnant
    // resolved to null, partFromItem dropped it, and the Enchanting tab
    // reported none while one sat in the pack.
    expect(isEssenceName("Remnant (Potent)")).toBe(true);
    expect(isEssenceName("Essence (Potent)")).toBe(true);
    expect(isEssenceName("Heart")).toBe(false);
    expect(isEssenceName(null)).toBe(false);
  });

  it("values an unstamped remnant off its name alone", () => {
    for (const entry of ESSENCE_TABLE) {
      expect(lowestComponentDC(entry.name), entry.name).toBe(entry.dc);
      expect(lowestComponentDC(entry.legacyName), entry.legacyName).toBe(entry.dc);
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
  it("CR 0-2 → fallback Remnant (Frail)", () => {
    for (const cr of [0, 1, 2]) {
      expect(getEssenceByCR(cr).name, `CR ${cr}`).toBe("Remnant (Frail)");
    }
  });

  it("CR 3-6 → Remnant (Frail)", () => {
    expect(getEssenceByCR(3).name).toBe("Remnant (Frail)");
    expect(getEssenceByCR(6).name).toBe("Remnant (Frail)");
  });

  it("CR 7-11 → Remnant (Robust)", () => {
    expect(getEssenceByCR(7).name).toBe("Remnant (Robust)");
    expect(getEssenceByCR(11).name).toBe("Remnant (Robust)");
  });

  it("CR 12-17 → Remnant (Potent)", () => {
    expect(getEssenceByCR(12).name).toBe("Remnant (Potent)");
    expect(getEssenceByCR(17).name).toBe("Remnant (Potent)");
  });

  it("CR 18-24 → Remnant (Mythic)", () => {
    expect(getEssenceByCR(18).name).toBe("Remnant (Mythic)");
    expect(getEssenceByCR(24).name).toBe("Remnant (Mythic)");
  });

  it("CR 25+ → Remnant (Deific)", () => {
    expect(getEssenceByCR(25).name).toBe("Remnant (Deific)");
    expect(getEssenceByCR(30).name).toBe("Remnant (Deific)");
    expect(getEssenceByCR(99).name).toBe("Remnant (Deific)");
  });
});

// ─── getEssenceByCR — boundary values ─────────────────────────────────────────

describe("getEssenceByCR — boundaries", () => {
  it("handles exact tier boundaries correctly", () => {
    // Lower bound of each tier
    expect(getEssenceByCR(3).name).toBe("Remnant (Frail)");
    expect(getEssenceByCR(7).name).toBe("Remnant (Robust)");
    expect(getEssenceByCR(12).name).toBe("Remnant (Potent)");
    expect(getEssenceByCR(18).name).toBe("Remnant (Mythic)");
    expect(getEssenceByCR(25).name).toBe("Remnant (Deific)");
  });

  it("handles upper boundary of each tier correctly", () => {
    expect(getEssenceByCR(6).name).toBe("Remnant (Frail)");
    expect(getEssenceByCR(11).name).toBe("Remnant (Robust)");
    expect(getEssenceByCR(17).name).toBe("Remnant (Potent)");
    expect(getEssenceByCR(24).name).toBe("Remnant (Mythic)");
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
