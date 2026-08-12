import { describe, it, expect } from "vitest";
import { HARVEST_TABLE } from "../src/data/harvest-table.js";

// All 14 D&D 5e creature types + the "other" fallback.
const EXPECTED_TYPES = [
  "aberration", "beast",     "celestial", "construct", "dragon",
  "elemental",  "fey",       "fiend",     "giant",     "humanoid",
  "monstrosity","ooze",      "plant",     "undead",    "other"
];

// ─── Structure ────────────────────────────────────────────────────────────────

describe("HARVEST_TABLE — coverage", () => {
  it("contains all 14 D&D creature types plus 'other'", () => {
    for (const type of EXPECTED_TYPES) {
      expect(HARVEST_TABLE, `Missing type: "${type}"`).toHaveProperty(type);
    }
  });

  it("has no unrecognized keys", () => {
    for (const key of Object.keys(HARVEST_TABLE)) {
      expect(EXPECTED_TYPES, `Unexpected key: "${key}"`).toContain(key);
    }
  });
});

describe("HARVEST_TABLE — tier shape", () => {
  it("every type has at least one tier", () => {
    for (const [type, tiers] of Object.entries(HARVEST_TABLE)) {
      expect(tiers.length, `"${type}" has no tiers`).toBeGreaterThan(0);
    }
  });

  it("every tier has a numeric dc and a non-empty items array", () => {
    for (const [type, tiers] of Object.entries(HARVEST_TABLE)) {
      for (const tier of tiers) {
        expect(typeof tier.dc, `"${type}" tier dc should be number`).toBe("number");
        expect(Array.isArray(tier.items), `"${type}" tier items should be array`).toBe(true);
        expect(tier.items.length, `"${type}" has an empty items array`).toBeGreaterThan(0);
      }
    }
  });

  it("all item names are non-empty strings", () => {
    for (const [type, tiers] of Object.entries(HARVEST_TABLE)) {
      for (const tier of tiers) {
        for (const item of tier.items) {
          expect(typeof item, `"${type}" item is not a string`).toBe("string");
          expect(item.trim().length, `"${type}" item name is empty`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("every tier DC is drawn from the calibrated 20/30/40 scale", () => {
    // Tier DCs are compared against a COMBINED two-roll total (~12–50).
    // A stray DC 10 or 15 tier would be met automatically and silently
    // stop gating anything — see docs/ROADMAP.md § 1.2.
    const ALLOWED = [20, 30, 40];
    for (const [type, tiers] of Object.entries(HARVEST_TABLE)) {
      for (const tier of tiers) {
        expect(ALLOWED, `"${type}" has off-scale DC ${tier.dc}`).toContain(tier.dc);
      }
    }
  });

  it("DCs within each type are in strictly ascending order", () => {
    for (const [type, tiers] of Object.entries(HARVEST_TABLE)) {
      for (let i = 1; i < tiers.length; i++) {
        expect(
          tiers[i].dc,
          `"${type}" tier[${i}].dc (${tiers[i].dc}) must be > tier[${i-1}].dc (${tiers[i-1].dc})`
        ).toBeGreaterThan(tiers[i - 1].dc);
      }
    }
  });
});

// ─── Spot-checks (compendium item name accuracy) ──────────────────────────────

describe("HARVEST_TABLE — spot-checks", () => {
  const find = (type, dc) => HARVEST_TABLE[type]?.find(t => t.dc === dc);

  it("aberration DC 30 includes Main Eye", () => {
    expect(find("aberration", 30)?.items).toContain("Main Eye");
  });

  it("beast DC 20 includes Hide", () => {
    expect(find("beast", 20)?.items).toContain("Hide");
  });

  it("celestial DC 40 includes Soul", () => {
    expect(find("celestial", 40)?.items).toContain("Soul");
  });

  it("construct DC 20 includes Gears", () => {
    expect(find("construct", 20)?.items).toContain("Gears");
  });

  it("construct DC 30 includes Instructions", () => {
    expect(find("construct", 30)?.items).toContain("Instructions");
  });

  it("dragon DC 30 includes Breath Sac", () => {
    expect(find("dragon", 30)?.items).toContain("Breath Sac");
  });

  it("dragon DC 30 includes Phial of acid", () => {
    // Exact compendium name — lowercase 'a' is intentional.
    expect(find("dragon", 30)?.items).toContain("Phial of acid");
  });

  it("elemental DC 30 includes Lifespark", () => {
    expect(find("elemental", 30)?.items).toContain("Lifespark");
  });

  it("fey DC 40 includes Psyche", () => {
    expect(find("fey", 40)?.items).toContain("Psyche");
  });

  it("fiend DC 40 includes Soul", () => {
    expect(find("fiend", 40)?.items).toContain("Soul");
  });

  it("giant DC 30 includes Tusk and Horn", () => {
    const items = find("giant", 30)?.items ?? [];
    expect(items).toContain("Tusk");
    expect(items).toContain("Horn");
  });

  it("humanoid DC 40 includes Brain and Tongue", () => {
    const items = find("humanoid", 40)?.items ?? [];
    expect(items).toContain("Brain");
    expect(items).toContain("Tongue");
  });

  it("monstrosity DC 30 includes Poison Gland (Material)", () => {
    expect(find("monstrosity", 30)?.items).toContain("Poison Gland (Material)");
  });

  it("monstrosity DC 40 includes Silk Sack and Spider Milk", () => {
    const items = find("monstrosity", 40)?.items ?? [];
    expect(items).toContain("Silk Sack");
    expect(items).toContain("Spider Milk");
  });

  it("ooze DC 20 includes Phial of Mucus", () => {
    expect(find("ooze", 20)?.items).toContain("Phial of Mucus");
  });

  it("plant DC 40 includes Pouch of Spore and Pouch of Hyphae", () => {
    const items = find("plant", 40)?.items ?? [];
    expect(items).toContain("Pouch of Spore");
    expect(items).toContain("Pouch of Hyphae");
  });

  it("undead DC 20 includes Undying Flesh", () => {
    expect(find("undead", 20)?.items).toContain("Undying Flesh");
  });

  it("undead DC 40 includes Undying Heart and Soul", () => {
    const items = find("undead", 40)?.items ?? [];
    expect(items).toContain("Undying Heart");
    expect(items).toContain("Soul");
  });
});
