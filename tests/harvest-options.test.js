import { describe, it, expect } from "vitest";
import { getHarvestOptions } from "../src/harvest/logic.js";

// getHarvestOptions is the component-DC lookup for a creature type. It says
// what a creature can yield and what each part costs; it does NOT decide what
// is awarded — that is buildHarvestList / resolveHarvest, covered in
// harvest-unlock.test.js.

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

  it("every type offers a cheap entry component", () => {
    // Without a low-cost component the first Harvest DC is already steep and
    // the creature is effectively unharvestable.
    for (const type of ALL_TYPES) {
      const cheapest = Math.min(...getHarvestOptions(type).map(t => t.dc));
      expect(cheapest, `"${type}" cheapest component costs ${cheapest}`).toBeLessThanOrEqual(10);
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

  it("returns tiers in ascending cost order", () => {
    for (const type of ALL_TYPES) {
      const dcs = getHarvestOptions(type).map(t => t.dc);
      expect(dcs, `"${type}" tiers are out of order`).toEqual([...dcs].sort((a, b) => a - b));
    }
  });
});

// ─── Per-type spot-checks ─────────────────────────────────────────────────────

describe("getHarvestOptions — per-type spot-checks", () => {
  const find = (type, dc) => getHarvestOptions(type).find(t => t.dc === dc);

  it("aberration DC 5 yields Antenna and Eye", () => {
    const items = find("aberration", 5)?.items ?? [];
    expect(items).toContain("Antenna");
    expect(items).toContain("Eye");
  });

  it("celestial DC 25 yields Soul", () => {
    expect(find("celestial", 25)?.items).toContain("Soul");
  });

  it("construct DC 5 yields Phial of Oil", () => {
    expect(find("construct", 5)?.items).toContain("Phial of Oil");
  });

  it("dragon DC 25 yields Breath Sac", () => {
    expect(find("dragon", 25)?.items).toContain("Breath Sac");
  });

  it("fey DC 25 yields Psyche", () => {
    expect(find("fey", 25)?.items).toContain("Psyche");
  });

  it("fiend DC 10 yields Horn", () => {
    expect(find("fiend", 10)?.items).toContain("Horn");
  });

  it("giant DC 15 yields Heart and Liver", () => {
    const items = find("giant", 15)?.items ?? [];
    expect(items).toContain("Heart");
    expect(items).toContain("Liver");
  });

  it("humanoid DC 20 yields Brain and Skin", () => {
    const items = find("humanoid", 20)?.items ?? [];
    expect(items).toContain("Brain");
    expect(items).toContain("Skin");
  });

  it("monstrosity DC 15 yields Poison Gland (Material)", () => {
    expect(find("monstrosity", 15)?.items).toContain("Poison Gland (Material)");
  });

  it("ooze DC 15 yields Vesicle", () => {
    expect(find("ooze", 15)?.items).toContain("Vesicle");
  });

  it("plant DC 5 yields Phial of Sap", () => {
    expect(find("plant", 5)?.items).toContain("Phial of Sap");
  });

  it("undead DC 20 yields Undying Heart", () => {
    expect(find("undead", 20)?.items).toContain("Undying Heart");
  });
});
