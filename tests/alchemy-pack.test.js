import { describe, it, expect } from "vitest";
import { readPack } from "./read-pack.mjs";
import { REMEDY_NAME } from "../src/data/alchemy-effects.js";
import { ALCHEMY_INGREDIENTS, ALCHEMY_SRD_ITEM } from "../src/data/alchemy.js";
import { analyseConcoction } from "../src/craft/logic.js";
import { concoctionItemNames } from "../src/craft/grant.js";

// Item NAMES are the join between a brew and the item it hands over. A
// mismatch is silent at runtime: the lookup misses, the module builds a
// plain item instead, and the player gets something that works but is not
// the one anybody authored. So it has to be loud here.

const items = await readPack("packs/alchemy-items");
const byName = new Map(items.map(i => [i.name, i]));

const benchFor = ingredient => {
  const spec = ALCHEMY_INGREDIENTS.find(i => i.name === ingredient);
  return spec?.role === "enchantment" ? ["Elemental Water", ingredient] : [ingredient];
};

// ─── The join ─────────────────────────────────────────────────────────────────

describe("alchemy pack ↔ what the code asks for", () => {
  it("holds an item for every remedy the code can name", () => {
    const missing = Object.values(REMEDY_NAME).filter(n => !byName.has(n));
    expect(missing, `absent from the pack: ${missing.join(", ")}`).toEqual([]);
  });

  it("holds nothing the code would never ask for", () => {
    // A stray item is dead weight — it can never be granted, and a leftover
    // "New Item" placeholder would ship to every user.
    const wanted = new Set(Object.values(REMEDY_NAME));
    const strays = items.map(i => i.name).filter(n => !wanted.has(n));
    expect(strays, `dead weight in the pack: ${strays.join(", ")}`).toEqual([]);
  });

  it("every brew with no SRD equivalent resolves to a packed item", () => {
    // The real contract, walked end to end: compose the bench the way the
    // crafting tab would, ask for the names it would ask for, and confirm
    // one of them is in the pack.
    const unresolved = [];
    for (const ingredient of Object.keys(REMEDY_NAME)) {
      const names = concoctionItemNames(analyseConcoction(benchFor(ingredient)));
      if (!names.some(n => byName.has(n))) unresolved.push(`${ingredient} → ${names.join(" / ")}`);
    }
    expect(unresolved, `these brews would fall back to a built item:\n${unresolved.join("\n")}`)
      .toEqual([]);
  });

  it("maps every custom brew, so none is left needing an item nobody made", () => {
    const needsOwn = ALCHEMY_INGREDIENTS.filter(i =>
      /^(potion-effect|toxin-effect|enchantment)$/.test(i.role) && !ALCHEMY_SRD_ITEM[i.name]);
    expect(Object.keys(REMEDY_NAME).sort()).toEqual(needsOwn.map(i => i.name).sort());
  });
});

// ─── Item integrity ───────────────────────────────────────────────────────────

describe("alchemy pack — integrity", () => {
  it("every entry has a unique 16-character _id", () => {
    for (const i of items) {
      expect(i._id, `"${i.name}" has a malformed _id`).toMatch(/^[A-Za-z0-9]{16}$/);
    }
    expect(new Set(items.map(i => i._id)).size).toBe(items.length);
  });

  it("names are unique", () => {
    expect(byName.size).toBe(items.length);
  });

  it("every entry is a consumable, typed potion or poison", () => {
    for (const i of items) {
      expect(i.type, `"${i.name}"`).toBe("consumable");
      expect(["potion", "poison"], `"${i.name}"`).toContain(i.system.type?.value);
    }
  });

  it("every damage formula is something Foundry can roll", () => {
    // "2d4 + the Alchemy modifier" reads well and evaluates to nothing. A
    // damage field has to be arithmetic.
    for (const i of items) {
      for (const [formula] of i.system.damage?.parts ?? []) {
        expect(formula, `"${i.name}" cannot be rolled: ${formula}`)
          .toMatch(/^[0-9df\s()+\-/*.]+$/);
      }
    }
  });

  it("anything with dice declares an action type", () => {
    // dnd5e hides the damage block entirely without one, so the formula
    // would be set and unreachable.
    for (const i of items.filter(i => (i.system.damage?.parts ?? []).length)) {
      expect(i.system.actionType, `"${i.name}" has dice but no action type`).toBeTruthy();
    }
  });

  it("a save effect names the ability it is rolled against", () => {
    for (const i of items.filter(i => i.system.save?.dc != null)) {
      expect(i.system.save.ability, `"${i.name}" has a DC but no ability`).toBeTruthy();
    }
  });

  it("every entry says what it is before saying what it does", () => {
    for (const i of items) {
      expect(i.system.description?.value?.length ?? 0, `"${i.name}" has no description`)
        .toBeGreaterThan(60);
    }
  });

  it("a multi-use brew is not destroyed on first use", () => {
    const hibiscus = byName.get("Silver Hibiscus Infusion");
    expect(hibiscus.system.uses.value).toBe(3);
    expect(hibiscus.system.uses.autoDestroy).toBe(false);
  });

  it("carries no world-specific baggage", () => {
    // Export source and _stats name a world and a user, and mean nothing to
    // anyone installing the module.
    for (const i of items) {
      expect(i.flags?.exportSource, `"${i.name}" carries an exportSource`).toBeUndefined();
      expect(i._stats?.lastModifiedBy, `"${i.name}" names its author`).toBeUndefined();
    }
  });
});
