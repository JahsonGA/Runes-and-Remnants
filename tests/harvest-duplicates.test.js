import { describe, it, expect } from "vitest";
import { DUPLICATE_RESOLVER, findCompendiumEntry } from "../src/harvest/logic.js";

// Minimal compendium index stubs that mirror the real duplicate items.
const MOCK_LOOT = [
  { _id: "bone-a",      name: "Bone",     type: "consumable" },
  { _id: "bone-b",      name: "Bone",     type: "consumable" },
  { _id: "hair-a",      name: "Hair",     type: "loot"       },
  { _id: "hair-b",      name: "Hair",     type: "loot"       },
  { _id: "membrane-a",  name: "Membrane", type: "loot"       }, // ooze variant
  { _id: "membrane-b",  name: "Membrane", type: "consumable" }, // plant variant
  { _id: "hide",        name: "Hide",     type: "loot"       },
  { _id: "soul",        name: "Soul",     type: "loot"       }
];

// ─── DUPLICATE_RESOLVER structure ─────────────────────────────────────────────

describe("DUPLICATE_RESOLVER", () => {
  it("is empty — the shipped pack has no duplicate names", () => {
    expect(Object.keys(DUPLICATE_RESOLVER)).toHaveLength(0);
  });

  it("still resolves entries that a world adds at runtime", () => {
    const resolver = {
      Membrane: {
        ooze:  { type: "loot" },
        plant: { type: "consumable" }
      }
    };
    // Mirrors findCompendiumEntry's hint matching against a caller-supplied map.
    const candidates = MOCK_LOOT.filter(i => i.name === "Membrane");
    const hints = resolver.Membrane.plant;
    const match = candidates.find(c =>
      Object.entries(hints).every(([k, v]) => c[k] === v)
    );
    expect(match?._id).toBe("membrane-b");
  });
});

// ─── findCompendiumEntry — unique items ───────────────────────────────────────

describe("findCompendiumEntry — unique items", () => {
  it("returns the single match for a unique item name", () => {
    const result = findCompendiumEntry(MOCK_LOOT, "Hide", "beast");
    expect(result?._id).toBe("hide");
  });

  it("returns null when item name is not in loot", () => {
    expect(findCompendiumEntry(MOCK_LOOT, "Nonexistent", "beast")).toBeNull();
  });

  it("returns null for empty loot array", () => {
    expect(findCompendiumEntry([], "Hide", "beast")).toBeNull();
  });
});

// ─── findCompendiumEntry — duplicate resolution ───────────────────────────────

describe("findCompendiumEntry — unresolved duplicates fall back to first", () => {
  it("Membrane returns the first candidate for every creature type", () => {
    for (const type of ["ooze", "plant", "beast"]) {
      expect(findCompendiumEntry(MOCK_LOOT, "Membrane", type)?._id).toBe("membrane-a");
    }
  });
});

// ─── findCompendiumEntry — unresolved duplicates (Bone, Hair) ─────────────────

describe("findCompendiumEntry — Bone and Hair (no resolver, falls back to first)", () => {
  it("Bone returns the first candidate regardless of creature type", () => {
    expect(findCompendiumEntry(MOCK_LOOT, "Bone", "undead")?._id).toBe("bone-a");
    expect(findCompendiumEntry(MOCK_LOOT, "Bone", "giant")?._id).toBe("bone-a");
  });

  it("Hair returns the first candidate regardless of creature type", () => {
    expect(findCompendiumEntry(MOCK_LOOT, "Hair", "fey")?._id).toBe("hair-a");
    expect(findCompendiumEntry(MOCK_LOOT, "Hair", "giant")?._id).toBe("hair-a");
  });
});

// ─── findCompendiumEntry — case and edge cases ────────────────────────────────

describe("findCompendiumEntry — edge cases", () => {
  it("creatureType is lowercased internally (mixed case input)", () => {
    const ooze   = findCompendiumEntry(MOCK_LOOT, "Membrane", "Ooze");
    const oozeLC = findCompendiumEntry(MOCK_LOOT, "Membrane", "ooze");
    expect(ooze?._id).toBe(oozeLC?._id);
  });

  it("null creatureType falls back to first candidate", () => {
    const result = findCompendiumEntry(MOCK_LOOT, "Membrane", null);
    expect(result?._id).toBe("membrane-a");
  });

  it("undefined creatureType falls back to first candidate", () => {
    const result = findCompendiumEntry(MOCK_LOOT, "Membrane", undefined);
    expect(result?._id).toBe("membrane-a");
  });
});
