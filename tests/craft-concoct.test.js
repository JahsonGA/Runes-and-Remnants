import { describe, it, expect } from "vitest";
import { EFFECT_FORMULA, MODIFIER_TRANSFORM, DIE_LADDER } from "../src/data/alchemy-effects.js";
import { ALCHEMY_INGREDIENTS, ALCHEMY_SRD_ITEM } from "../src/data/alchemy.js";
import {
  composeEffect, renderFormula, describeEffect, stepDie, dieCapped, applyCounts
} from "../src/craft/concoct.js";

const heal = (mods = [], mod = 3) => composeEffect("Wild Sageroot", mods, mod);
const toxin = (mods = [], mod = 4) => composeEffect("Wyrmtongue Petals", mods, mod);

// ─── Data integrity ───────────────────────────────────────────────────────────

describe("the mechanical tables line up with the ingredient table", () => {
  it("every effect that needs its own item has a formula", () => {
    // These are exactly the brews with no SRD item to fall back on. One
    // without a formula would grant a vial nobody can roll.
    const needsOwn = ALCHEMY_INGREDIENTS.filter(i =>
      /^(potion-effect|toxin-effect|enchantment)$/.test(i.role) && !ALCHEMY_SRD_ITEM[i.name]);

    expect(needsOwn.length).toBeGreaterThan(0);
    for (const i of needsOwn) {
      expect(EFFECT_FORMULA, `"${i.name}" brews an item with no mechanics`).toHaveProperty(i.name);
    }
  });

  it("every modifier in the table has a transform", () => {
    for (const i of ALCHEMY_INGREDIENTS.filter(i => /modifier/.test(i.role))) {
      expect(MODIFIER_TRANSFORM, `"${i.name}" changes nothing`).toHaveProperty(i.name);
    }
  });

  it("names nothing that is not an ingredient", () => {
    const known = new Set(ALCHEMY_INGREDIENTS.map(i => i.name));
    for (const name of [...Object.keys(EFFECT_FORMULA), ...Object.keys(MODIFIER_TRANSFORM)]) {
      expect(known.has(name), `"${name}" has mechanics but is not an ingredient`).toBe(true);
    }
  });

  it("every transform actually does something", () => {
    for (const [name, t] of Object.entries(MODIFIER_TRANSFORM)) {
      const changes = Object.keys(t).filter(k => k !== "stacks");
      expect(changes.length, `"${name}" is a no-op`).toBeGreaterThan(0);
    }
  });
});

// ─── The die ladder ───────────────────────────────────────────────────────────

describe("stepDie", () => {
  it("walks up the ladder", () => {
    expect(stepDie(4)).toBe(6);
    expect(stepDie(6)).toBe(8);
    expect(stepDie(10)).toBe(12);
  });

  it("stops at d12 — nothing in 5e steps past it", () => {
    expect(stepDie(12)).toBe(12);
    expect(dieCapped(12)).toBe(true);
    expect(dieCapped(4)).toBe(false);
  });

  it("leaves a die it does not recognise alone", () => {
    expect(stepDie(7)).toBe(7);
  });

  it("the ladder is ascending and has no gaps in the usual dice", () => {
    expect(DIE_LADDER).toEqual([...DIE_LADDER].sort((a, b) => a - b));
    expect(DIE_LADDER).toContain(4);
    expect(DIE_LADDER).toContain(12);
  });
});

// ─── Stacking ─────────────────────────────────────────────────────────────────

describe("applyCounts", () => {
  it("applies a stacking modifier once per copy", () => {
    // Only two ingredients say they stack, and it is what makes them a choice
    // rather than a checkbox.
    expect(applyCounts(["Milkweed Seeds", "Milkweed Seeds"]).get("Milkweed Seeds")).toBe(2);
    expect(applyCounts(Array(3).fill("Quicksilver Lichen")).get("Quicksilver Lichen")).toBe(3);
  });

  it("applies a non-stacking modifier once however many are on the bench", () => {
    // Three Spineflower Berries must not step a d4 to a d12.
    expect(applyCounts(["Spineflower Berries", "Spineflower Berries"])
      .get("Spineflower Berries")).toBe(1);
  });

  it("survives an empty bench", () => {
    expect(applyCounts().size).toBe(0);
  });
});

// ─── Composition ──────────────────────────────────────────────────────────────

describe("composeEffect", () => {
  it("returns the base effect untouched with no modifiers", () => {
    expect(heal().formula).toBe("2d4 + 3");
  });

  it("doubles the dice and drops the modifier together", () => {
    // Milkweed Seeds trades the alchemist's own skill for raw dice. Dropping
    // the modifier is the price, and it is what makes it a real decision.
    const r = heal(["Milkweed Seeds"]);
    expect(r.formula).toBe("4d4");
    expect(r.mod).toBe(false);
  });

  it("doubles again for a second copy, because it stacks", () => {
    expect(heal(["Milkweed Seeds", "Milkweed Seeds"]).formula).toBe("8d4");
  });

  it("steps the die up without touching the count", () => {
    expect(heal(["Dried Ephedra"]).formula).toBe("2d6 + 3");
  });

  it("combines a doubling and a step", () => {
    expect(heal(["Milkweed Seeds", "Dried Ephedra"]).formula).toBe("4d6");
  });

  it("halves the total after doubling, and floors it", () => {
    // Gengko Brush spreads the healing over rounds. floor() so rounding can
    // never invent free healing.
    const r = heal(["Gengko Brush"]);
    expect(r.formula).toBe("floor((4d4 + 3) / 2)");
    expect(r.perRound).toBe(true);
  });

  it("changes the damage type", () => {
    expect(toxin(["Drakus Flower"]).damageType).toBe("fire");
    expect(toxin(["Radiant Synthseed"]).damageType).toBe("radiant");
  });

  it("lets a later modifier win the damage type", () => {
    expect(toxin(["Drakus Flower", "Arctic Creeper"]).damageType).toBe("cold");
  });

  it("halves the duration each time it stacks, and says it in rounds", () => {
    // "0.25 minute" is not something anyone can act on at a table.
    expect(describeEffect(toxin(["Quicksilver Lichen"]))).toContain("5 rounds");
    expect(describeEffect(toxin(["Quicksilver Lichen", "Quicksilver Lichen"]))).toContain("2 rounds");
  });

  it("collects riders from modifiers that change no numbers", () => {
    // Half of them add a condition rather than dice; pretending otherwise
    // would invent mechanics the rules do not have.
    const r = toxin(["Harrada Leaf", "Frozen Seedlings"]);
    expect(r.riders.join(" ")).toMatch(/disadvantage on ability checks/);
    expect(r.riders.join(" ")).toMatch(/speed drops by 10 feet/);
    expect(r.formula).toBe("1d4 + 4");                // numbers untouched
  });

  it("Lavender Sprig changes nothing about the finished brew", () => {
    // It steadied the brewing. That is a crafting DC concern, not an effect.
    expect(heal(["Lavender Sprig"]).formula).toBe(heal().formula);
  });

  it("records a delay rather than folding it into the formula", () => {
    const r = heal(["Emetic Wax"]);
    expect(r.formula).toBe("2d4 + 3");
    expect(describeEffect(r)).toMatch(/after 1d6 rounds/);
  });

  it("flags an inversion for the GM rather than guessing at it", () => {
    expect(heal(["Chromus Slime"]).inverted).toBe(true);
  });

  it("notes when a step hit the ceiling", () => {
    const r = composeEffect("Wyrmtongue Petals",
      ["Spineflower Berries"], 0);
    expect(r.die).toBe(6);
    const capped = composeEffect("Wild Sageroot", [], 0);
    capped.die = 12;
    expect(dieCapped(12)).toBe(true);
  });

  it("returns nothing for an effect it has no mechanics for", () => {
    expect(composeEffect("Milkweed Seeds")).toBeNull();
    expect(composeEffect(null)).toBeNull();
  });
});

// ─── Rendering ────────────────────────────────────────────────────────────────

describe("renderFormula", () => {
  it("says the modifier by name when the crafter is unknown", () => {
    expect(renderFormula({ count: 2, die: 4, mod: true })).toBe("2d4 + the Alchemy modifier");
  });

  it("handles a negative modifier", () => {
    expect(renderFormula({ count: 2, die: 4, mod: true }, -1)).toBe("2d4 - 1");
  });

  it("returns nothing where there are no dice", () => {
    // Plenty of effects work through a condition or a duration. Inventing a
    // formula for those would be making rules up.
    expect(renderFormula({ kind: "utility" })).toBeNull();
    expect(renderFormula(null)).toBeNull();
  });
});

describe("describeEffect", () => {
  it("reads as one line a player can act on", () => {
    expect(describeEffect(heal())).toBe("Heals 2d4 + 3.");
  });

  it("names the damage type, the condition and the duration", () => {
    const line = describeEffect(toxin());
    expect(line).toContain("poison damage per round");
    expect(line).toContain("poisoned");
    expect(line).toContain("1 minute");
  });

  it("gives a save DC that depends on the brewer", () => {
    expect(describeEffect(composeEffect("Basilisk Breath", [], 4)))
      .toMatch(/Save DC 5 \+ the Alchemy modifier/);
  });

  it("describes a dice-less effect without pretending it rolls", () => {
    expect(describeEffect(composeEffect("Fennel Silk", [], 3))).toBe("Lasts 1 hour.");
  });

  it("survives nothing", () => {
    expect(describeEffect(null)).toBe("");
  });
});
