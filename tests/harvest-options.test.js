import { describe, it, expect } from "vitest";
import { getHarvestOptions } from "../src/harvest/logic.js";

const ALL_TYPES = [
  "aberration", "beast",     "celestial", "construct", "dragon",
  "elemental",  "fey",       "fiend",     "giant",     "humanoid",
  "monstrosity","ooze",      "plant",     "undead"
];

// ─── Coverage ─────────────────────────────────────────────────────────────────

describe("getHarvestOptions — coverage", () => {
  it("returns a non-empty array for every D&D creature type", () => {
    for (const type of ALL_TYPES) {
      const result = getHarvestOptions(type);
      expect(Array.isArray(result), `"${type}" did not return an array`).toBe(true);
      expect(result.length, `"${type}" returned empty tiers`).toBeGreaterThan(0);
    }
  });
});

// ─── Fallback behaviour ───────────────────────────────────────────────────────

describe("getHarvestOptions — fallback", () => {
  it("unknown type falls back to 'other'", () => {
    expect(getHarvestOptions("swarm-of-wasps")).toEqual(getHarvestOptions("other"));
    expect(getHarvestOptions("custom-type")).toEqual(getHarvestOptions("other"));
  });

  it("null falls back to 'other'", () => {
    expect(getHarvestOptions(null)).toEqual(getHarvestOptions("other"));
  });

  it("undefined falls back to 'other'", () => {
    expect(getHarvestOptions(undefined)).toEqual(getHarvestOptions("other"));
  });

  it("empty string falls back to 'other'", () => {
    expect(getHarvestOptions("")).toEqual(getHarvestOptions("other"));
  });
});

// ─── Case handling ────────────────────────────────────────────────────────────

describe("getHarvestOptions — case insensitivity", () => {
  it("accepts mixed-case type strings", () => {
    expect(getHarvestOptions("Beast")).toEqual(getHarvestOptions("beast"));
    expect(getHarvestOptions("UNDEAD")).toEqual(getHarvestOptions("undead"));
    expect(getHarvestOptions("Monstrosity")).toEqual(getHarvestOptions("monstrosity"));
    expect(getHarvestOptions("ABERRATION")).toEqual(getHarvestOptions("aberration"));
  });
});

// ─── Tier structure ───────────────────────────────────────────────────────────

describe("getHarvestOptions — tier structure", () => {
  it("every returned tier has a dc and an items array", () => {
    for (const type of ALL_TYPES) {
      for (const tier of getHarvestOptions(type)) {
        expect(typeof tier.dc, `"${type}" tier missing dc`).toBe("number");
        expect(Array.isArray(tier.items), `"${type}" tier missing items`).toBe(true);
      }
    }
  });
});

// ─── Additive tier logic ──────────────────────────────────────────────────────

describe("getHarvestOptions — additive tier logic", () => {
  it("a roll of 18 on beast unlocks DC 10 and DC 15 tiers but not DC 20", () => {
    const rollTotal = 18;
    const tiers = getHarvestOptions("beast");

    const unlocked = tiers
      .filter(t => rollTotal >= t.dc)
      .flatMap(t => t.items);

    const locked = tiers
      .filter(t => rollTotal < t.dc)
      .flatMap(t => t.items);

    expect(unlocked).toContain("Hide");   // DC 10
    expect(unlocked).toContain("Heart");  // DC 15
    expect(locked).toContain("Marrow");   // DC 20 — not yet unlocked
  });

  it("a roll of 10 on dragon unlocks only the first tier", () => {
    const tiers = getHarvestOptions("dragon");
    const unlocked = tiers.filter(t => 10 >= t.dc).flatMap(t => t.items);
    const locked   = tiers.filter(t => 10 < t.dc).flatMap(t => t.items);

    expect(unlocked).toContain("Pouch of Scales"); // DC 10
    expect(locked).toContain("Breath Sac");        // DC 15
    expect(locked).toContain("Horn");              // DC 20
  });

  it("a roll of 25 on undead unlocks all tiers", () => {
    const tiers = getHarvestOptions("undead");
    const unlocked = tiers.filter(t => 25 >= t.dc).flatMap(t => t.items);

    expect(unlocked).toContain("Bone");               // DC 10
    expect(unlocked).toContain("Phial of Congealed Blood"); // DC 15
    expect(unlocked).toContain("Soul");               // DC 20
  });
});

// ─── Per-type spot-checks ─────────────────────────────────────────────────────

describe("getHarvestOptions — per-type spot-checks", () => {
  const find = (type, dc) => getHarvestOptions(type).find(t => t.dc === dc);

  it("aberration DC 10 yields Tentacle and Eye", () => {
    const items = find("aberration", 10)?.items ?? [];
    expect(items).toContain("Tentacle");
    expect(items).toContain("Eye");
  });

  it("celestial DC 15 yields Lifespark", () => {
    expect(find("celestial", 15)?.items).toContain("Lifespark");
  });

  it("construct DC 20 yields Phial of Oil", () => {
    expect(find("construct", 20)?.items).toContain("Phial of Oil");
  });

  it("elemental DC 20 yields Ethereal Ichor", () => {
    expect(find("elemental", 20)?.items).toContain("Ethereal Ichor");
  });

  it("fey DC 20 yields Psyche", () => {
    expect(find("fey", 20)?.items).toContain("Psyche");
  });

  it("fiend DC 10 yields Rancid Fat", () => {
    expect(find("fiend", 10)?.items).toContain("Rancid Fat");
  });

  it("giant DC 15 yields Marrow", () => {
    expect(find("giant", 15)?.items).toContain("Marrow");
  });

  it("humanoid DC 20 yields Brain and Tongue", () => {
    const items = find("humanoid", 20)?.items ?? [];
    expect(items).toContain("Brain");
    expect(items).toContain("Tongue");
  });

  it("monstrosity DC 20 yields Poison Gland (Poison)", () => {
    expect(find("monstrosity", 20)?.items).toContain("Poison Gland (Poison)");
  });

  it("ooze DC 15 yields Vesicle", () => {
    expect(find("ooze", 15)?.items).toContain("Vesicle");
  });

  it("plant DC 15 yields Phial of Sap", () => {
    expect(find("plant", 15)?.items).toContain("Phial of Sap");
  });

  it("undead DC 20 yields Undying Heart", () => {
    expect(find("undead", 20)?.items).toContain("Undying Heart");
  });
});
