import { describe, it, expect } from "vitest";
import { getHarvestOptions, normaliseCreatureType, skillForType } from "../src/harvest/logic.js";

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

// ─── Creature types from books past the SRD ───────────────────────────────────

describe("normaliseCreatureType", () => {
  // The module never knows a monster's NAME — it reads the creature type. That
  // is why anything from Volo's, Mordenkainen's, Tasha's or a homebrew folder
  // harvests without being added to any table here. What it has to survive is
  // the several shapes a type arrives in.

  it("passes a plain type through", () => {
    expect(normaliseCreatureType("monstrosity")).toBe("monstrosity");
  });

  it("reads dnd5e's object form", () => {
    expect(normaliseCreatureType({ value: "beast", subtype: "", swarm: "tiny" })).toBe("beast");
  });

  it("unpicks a custom type, where .value only ever reads 'custom'", () => {
    // Books past the SRD lean on custom types far more than the SRD does,
    // and this fell through to the generic 8-component table.
    expect(normaliseCreatureType({ value: "custom", custom: "Monstrosity (Shapechanger)" }))
      .toBe("monstrosity");
  });

  it("drops a subtype carried in the string itself", () => {
    expect(normaliseCreatureType("Humanoid (any race)")).toBe("humanoid");
    expect(normaliseCreatureType("Fiend (Demon)")).toBe("fiend");
  });

  it("finds the type inside a swarm's description, plural and all", () => {
    expect(normaliseCreatureType("swarm of tiny beasts")).toBe("beast");
  });

  it("is not thrown by case or whitespace", () => {
    expect(normaliseCreatureType("  Fiend  ")).toBe("fiend");
  });

  it("falls back rather than throwing on something genuinely unknown", () => {
    // A homebrew type should still harvest, just from the generic table.
    expect(normaliseCreatureType("clockwork horror")).toBe("other");
    expect(normaliseCreatureType(null)).toBe("other");
    expect(normaliseCreatureType({})).toBe("other");
  });

  it("gives a subtyped creature its full table, not the generic one", () => {
    const full = getHarvestOptions("monstrosity").reduce((n, t) => n + t.items.length, 0);
    const sub = getHarvestOptions("Monstrosity (Shapechanger)").reduce((n, t) => n + t.items.length, 0);
    const generic = getHarvestOptions("nonsense").reduce((n, t) => n + t.items.length, 0);

    expect(sub).toBe(full);
    expect(sub).toBeGreaterThan(generic);
  });
});

describe("skillForType", () => {
  it("reads a creature with the skill its type calls for", () => {
    expect(skillForType("undead")).toBe("Medicine");
    expect(skillForType("aberration")).toBe("Arcana");
  });

  it("normalises first, so a subtype does not silently become Survival", () => {
    // Both roll helpers looked this up by exact match, so a custom or
    // subtyped creature rolled the fallback skill instead of its own.
    expect(skillForType("Fiend (Demon)")).toBe("Religion");
    expect(skillForType({ value: "custom", custom: "Ooze (Gelatinous)" })).toBe("Nature");
  });

  it("falls back for an unknown type", () => {
    expect(skillForType("clockwork horror")).toBe("Survival");
  });
});
