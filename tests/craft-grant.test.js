import { describe, it, expect } from "vitest";
import {
  itemNameCandidates, normaliseName, fallbackItemData,
  searchablePacks, SYSTEM_ITEM_NAME, FALLBACK_TYPE, FALLBACK_ARMOUR,
  concoctionItemData
} from "../src/craft/grant.js";
import { MANUFACTURING_TABLE, MANUFACTURING_CATEGORIES } from "../src/data/manufacturing.js";
import { getRecipe, analyseConcoction } from "../src/craft/logic.js";

// ─── Names ────────────────────────────────────────────────────────────────────

describe("itemNameCandidates", () => {
  it("asks for Leather Armor before Leather", () => {
    // The bug this file exists for: crafting Leather Armour produced a `loot`
    // item called "Leather", because nothing ever looked for the real one.
    const names = itemNameCandidates(getRecipe("Leather"));
    expect(names[0]).toBe("Leather Armor");
    expect(names).toContain("Leather");
  });

  it("offers both spellings of armour", () => {
    // A localised dnd5e build may use either.
    const names = itemNameCandidates(getRecipe("Half Plate"));
    expect(names).toContain("Half Plate Armor");
    expect(names).toContain("Half Plate Armour");
  });

  it("un-inverts a sorted equipment-table name", () => {
    // "Crossbow, Light" is how the table sorts it; the item is called
    // "Light Crossbow".
    expect(itemNameCandidates(getRecipe("Crossbow, Light"))[0]).toBe("Light Crossbow");
    expect(itemNameCandidates(getRecipe("Crossbow, Heavy"))[0]).toBe("Heavy Crossbow");
  });

  it("strips a trailing count or unit", () => {
    expect(itemNameCandidates(getRecipe("Arrows (20)"))).toContain("Arrows");
    expect(itemNameCandidates(getRecipe("Acid (vial)"))).toContain("Acid");
  });

  it("leaves a name that already matches alone", () => {
    expect(itemNameCandidates(getRecipe("Longsword"))).toEqual(["Longsword"]);
  });

  it("never repeats a candidate", () => {
    for (const recipe of MANUFACTURING_TABLE) {
      const names = itemNameCandidates(recipe);
      const lower = names.map(n => n.toLowerCase());
      expect(new Set(lower).size, `"${recipe.name}" repeats a candidate`).toBe(lower.length);
    }
  });

  it("produces at least one candidate for every recipe in the catalogue", () => {
    // A recipe with nothing to search for can only ever fall back.
    for (const recipe of MANUFACTURING_TABLE) {
      expect(itemNameCandidates(recipe).length, `"${recipe.name}"`).toBeGreaterThan(0);
    }
  });

  it("takes a bare string as well as a recipe", () => {
    expect(itemNameCandidates("Leather")[0]).toBe("Leather Armor");
  });

  it("survives nothing", () => {
    expect(itemNameCandidates(null)).toEqual([]);
    expect(itemNameCandidates({})).toEqual([]);
  });
});

describe("SYSTEM_ITEM_NAME", () => {
  it("only maps names the generic rules do not already handle", () => {
    // Every entry here is a maintenance cost; a table of a hundred would rot
    // the first time dnd5e renamed anything.
    for (const [from, to] of Object.entries(SYSTEM_ITEM_NAME)) {
      expect(from.toLowerCase(), `"${from}" maps to itself`).not.toBe(to.toLowerCase());
    }
  });

  it("maps only names that are actually in the catalogue", () => {
    const known = new Set(MANUFACTURING_TABLE.map(r => r.name));
    for (const from of Object.keys(SYSTEM_ITEM_NAME)) {
      const bare = from.replace(/\s*\([^)]*\)\s*$/, "");
      expect(known.has(from) || known.has(bare) || [...known].some(n => n.startsWith(bare)),
        `"${from}" is mapped but no recipe makes it`).toBe(true);
    }
  });
});

describe("normaliseName", () => {
  it("matches across armour spelling and trailing units", () => {
    expect(normaliseName("Leather Armor")).toBe(normaliseName("Leather Armour"));
    expect(normaliseName("Arrows (20)")).toBe(normaliseName("Arrows"));
    expect(normaliseName("Half Plate Armor")).toBe(normaliseName("half-plate"));
  });

  it("keeps genuinely different things apart", () => {
    expect(normaliseName("Longsword")).not.toBe(normaliseName("Shortsword"));
  });
});

// ─── The fallback ─────────────────────────────────────────────────────────────

describe("fallbackItemData", () => {
  it("builds armour as equipment, not loot", () => {
    // A weapon or a suit of armour filed as `loot` cannot be equipped, and
    // the player has to rebuild it by hand.
    const data = fallbackItemData(getRecipe("Leather"), "Ash");
    expect(data.type).toBe("equipment");
    expect(data.system.armor).toMatchObject({ type: "light", value: 11 });
  });

  it("builds a weapon as a weapon", () => {
    expect(fallbackItemData(getRecipe("Longsword"), "Ash").type).toBe("weapon");
  });

  it("builds a potion as a consumable", () => {
    expect(fallbackItemData(getRecipe("Potion of Healing"), "Ash").type).toBe("consumable");
  });

  it("gives every category a type that is not loot", () => {
    for (const category of MANUFACTURING_CATEGORIES) {
      expect(FALLBACK_TYPE[category], `"${category}" falls back to loot`).toBeTruthy();
      expect(FALLBACK_TYPE[category]).not.toBe("loot");
    }
  });

  it("carries the price and rarity the recipe knows", () => {
    const data = fallbackItemData(getRecipe("Potion of Superior Healing"), "Ash");
    expect(data.system.rarity).toBe("rare");
  });

  it("says in the description that it was improvised, and flags it", () => {
    // So a GM can find every improvised item and fix them in one pass.
    const data = fallbackItemData(getRecipe("Longsword"), "Ash");
    expect(data.system.description.value).toMatch(/Ash/);
    expect(data.system.description.value).toMatch(/import the SRD/i);
    expect(data.flags["runes-and-remnants"].improvised).toBe(true);
  });

  it("covers every armour in the catalogue with a shape", () => {
    const armour = MANUFACTURING_TABLE.filter(r => r.category === "Armour");
    for (const a of armour) {
      expect(FALLBACK_ARMOUR[a.name], `"${a.name}" has no fallback shape`).toBeTruthy();
    }
  });

  it("gives heavier armour a higher base AC", () => {
    expect(FALLBACK_ARMOUR["Plate"].ac).toBeGreaterThan(FALLBACK_ARMOUR["Leather"].ac);
  });

  it("returns nothing for nothing", () => {
    expect(fallbackItemData(null)).toBeNull();
    expect(fallbackItemData({})).toBeNull();
  });
});

// ─── Where it looks ───────────────────────────────────────────────────────────

describe("searchablePacks", () => {
  const pack = (collection, packageName, type, documentName = "Item") =>
    ({ collection, documentName, metadata: { packageName, packageType: type } });

  it("searches the system's own compendiums first", () => {
    // They hold the SRD the recipes are written against.
    const order = searchablePacks([
      pack("some-module.gear", "some-module", "module"),
      pack("world.mine", "world", "world"),
      pack("dnd5e.items", "dnd5e", "system")
    ]).map(p => p.collection);
    expect(order).toEqual(["dnd5e.items", "world.mine", "some-module.gear"]);
  });

  it("never searches the harvest pack", () => {
    // It holds monster components. A recipe sharing a name with one would
    // produce a lump of monster instead of a sword.
    const packs = searchablePacks([
      pack("runes-and-remnants.harvest-items", "runes-and-remnants", "module"),
      pack("dnd5e.items", "dnd5e", "system")
    ]);
    expect(packs.map(p => p.collection)).toEqual(["dnd5e.items"]);
  });

  it("ignores packs that do not hold items", () => {
    const packs = searchablePacks([
      pack("dnd5e.monsters", "dnd5e", "system", "Actor"),
      pack("dnd5e.items", "dnd5e", "system")
    ]);
    expect(packs.map(p => p.collection)).toEqual(["dnd5e.items"]);
  });

  it("survives no packs at all", () => {
    expect(searchablePacks(null)).toEqual([]);
    expect(searchablePacks([])).toEqual([]);
  });
});

// ─── Alchemy produces something ───────────────────────────────────────────────

describe("concoctionItemData", () => {
  const brew = bench => concoctionItemData(analyseConcoction(bench), bench, "Ash");

  it("names the brew after what it does, not the vessel", () => {
    // Alchemy used to grant nothing at all, and a "Potion base" from the gear
    // catalogue was the only thing an alchemist ended up holding.
    expect(brew(["Wild Sageroot"]).name).toBe("Potion of Wild Sageroot");
    expect(brew(["Wyrmtongue Petals"]).name).toBe("Poison of Wyrmtongue Petals");
    expect(brew(["Elemental Water", "Scillia Beans"]).name).toBe("Elixir of Scillia Beans");
  });

  it("is a consumable, not loot", () => {
    expect(brew(["Wild Sageroot"]).type).toBe("consumable");
    expect(brew(["Wild Sageroot"]).system.quantity).toBe(1);
  });

  it("composes the base effect and every modifier into the description", () => {
    // The whole point of the modifier system is that the combination does
    // something none of the parts do alone, so the item has to say so.
    const value = brew(["Wild Sageroot", "Milkweed Seeds", "Dried Ephedra"]).system.description.value;
    expect(value).toContain("Wild Sageroot");
    expect(value).toContain("Milkweed Seeds");
    expect(value).toContain("Dried Ephedra");
    expect(value).toMatch(/Heals 2d4/);
  });

  it("takes its rarity from the rarest thing that went in", () => {
    expect(brew(["Wild Sageroot"]).system.rarity).toBe("common");
    expect(brew(["Wild Sageroot", "Dried Ephedra"]).system.rarity).toBe("uncommon");
  });

  it("records the exact bench, so two brews sharing a name are tellable apart", () => {
    const flags = brew(["Wild Sageroot", "Milkweed Seeds"]).flags["runes-and-remnants"];
    expect(flags.ingredients).toEqual(["Wild Sageroot", "Milkweed Seeds"]);
    expect(flags.concoction).toBe(true);
    expect(flags.dc).toBe(analyseConcoction(["Wild Sageroot", "Milkweed Seeds"]).dc);
  });

  it("escapes ingredient text it does not own", () => {
    const data = concoctionItemData(
      { valid: true, kind: "potion", dc: 12,
        effects: [{ name: "<script>x</script>", effect: "bad" }], modifiers: [] },
      [], "Ash");
    expect(data.system.description.value).not.toContain("<script>");
  });

  it("refuses to build anything from an invalid mixture", () => {
    expect(concoctionItemData(analyseConcoction(["Milkweed Seeds"]), ["Milkweed Seeds"])).toBeNull();
    expect(concoctionItemData(null)).toBeNull();
  });
});
