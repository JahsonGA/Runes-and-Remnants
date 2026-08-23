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

  it("every component DC is on the source's 5/10/15/20/25 scale", () => {
    // These are per-component costs that accumulate along the harvest list,
    // not thresholds. Inflating them (as an earlier revision did) breaks the
    // cumulative maths — a 25-cost component is meant to be affordable first
    // and unreachable fourth.
    const ALLOWED = [5, 10, 15, 20, 25];
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

  it("no component appears at two different costs within one type", () => {
    for (const [type, tiers] of Object.entries(HARVEST_TABLE)) {
      const seen = new Map();
      for (const tier of tiers) {
        for (const item of tier.items) {
          expect(
            seen.has(item),
            `"${type}" lists "${item}" at both DC ${seen.get(item)} and DC ${tier.dc}`
          ).toBe(false);
          seen.set(item, tier.dc);
        }
      }
    }
  });
});

// ─── Source fidelity spot-checks ──────────────────────────────────────────────
// Values taken from the harvest tables in Ryoko's Guide
// "Harvesting and Crafting Lite".

describe("HARVEST_TABLE — source fidelity", () => {
  const find = (type, dc) => HARVEST_TABLE[type]?.find(t => t.dc === dc);

  it("dragon matches the source's worked example", () => {
    expect(find("dragon", 5)?.items).toContain("Eye");
    expect(find("dragon", 10)?.items).toContain("Pouch of Teeth");
    expect(find("dragon", 15)?.items).toContain("Horn");
    expect(find("dragon", 20)?.items).toContain("Heart");
    expect(find("dragon", 25)?.items).toContain("Breath Sac");
  });

  it("aberration DC 20 holds Brain, Chitin, Hide and Main Eye", () => {
    const items = find("aberration", 20)?.items ?? [];
    for (const n of ["Brain", "Chitin", "Hide", "Main Eye"]) {
      expect(items).toContain(n);
    }
  });

  it("beast DC 20 holds Chitin and Pelt", () => {
    expect(find("beast", 20)?.items).toContain("Chitin");
    expect(find("beast", 20)?.items).toContain("Pelt");
  });

  it("celestial and fiend both cap at Soul (25)", () => {
    expect(find("celestial", 25)?.items).toContain("Soul");
    expect(find("fiend", 25)?.items).toContain("Soul");
  });

  it("construct caps at Lifespark (25)", () => {
    expect(find("construct", 25)?.items).toContain("Lifespark");
  });

  it("fey caps at Psyche (25)", () => {
    expect(find("fey", 25)?.items).toContain("Psyche");
  });

  it("ooze is a single component per cost", () => {
    expect(find("ooze", 5)?.items).toEqual(["Phial of acid"]);
    expect(find("ooze", 10)?.items).toEqual(["Phial of Mucus"]);
    expect(find("ooze", 15)?.items).toEqual(["Vesicle"]);
    expect(find("ooze", 20)?.items).toEqual(["Membrane (Ooze)"]);
  });

  it("undead DC 5 holds Eye, Bone and congealed blood", () => {
    const items = find("undead", 5)?.items ?? [];
    for (const n of ["Eye", "Bone", "Phial of Congealed Blood"]) {
      expect(items).toContain(n);
    }
  });

  it("undead caps at Undying Heart (20)", () => {
    expect(find("undead", 20)?.items).toContain("Undying Heart");
  });

  it("monstrosity mirrors beast on the shared source tiers", () => {
    for (const dc of [5, 10, 15]) {
      const beast = find("beast", dc)?.items ?? [];
      const mons  = find("monstrosity", dc)?.items ?? [];
      for (const n of beast) {
        // Beast DC 20 carries a house addition, so only shared tiers compare.
        expect(mons, `monstrosity DC ${dc} missing "${n}"`).toContain(n);
      }
    }
  });

  it("plant DC 20 holds Bark and the plant membrane", () => {
    const items = find("plant", 20)?.items ?? [];
    expect(items).toContain("Bark");
    expect(items).toContain("Membrane (Plant)");
  });

  it("keeps the lowercase 'Phial of acid' compendium spelling", () => {
    // Exact compendium name — the lowercase 'a' is intentional.
    expect(find("ooze", 5)?.items).toContain("Phial of acid");
  });
});
