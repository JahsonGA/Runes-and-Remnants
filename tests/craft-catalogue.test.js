import { describe, it, expect, afterEach } from "vitest";
import {
  MANUFACTURING_TABLE,
  MANUFACTURING_CATEGORIES,
  POTION_TABLE,
  RARITY_CRAFTING,
  TOOL_ABILITY
} from "../src/data/manufacturing.js";
import {
  getRecipe,
  getRecipesByCategory,
  allRecipes,
  registerExtraRecipes,
  getExtraRecipes,
  clearExtraRecipes,
  planManufacture
} from "../src/craft/logic.js";
import { recipeFromItem } from "../src/craft/extras.js";

// ─── Category coverage ────────────────────────────────────────────────────────

describe("catalogue coverage", () => {
  const names = MANUFACTURING_TABLE.map(r => r.name);

  it("covers all four things a hunter actually makes", () => {
    // Weapons, armour, consumables, potions — the four the campaign needs.
    const counts = {};
    for (const r of MANUFACTURING_TABLE) counts[r.category] = (counts[r.category] ?? 0) + 1;

    expect(counts["Simple Melee"] + counts["Martial Melee"]).toBeGreaterThan(20);
    expect(counts["Armour"]).toBeGreaterThan(10);
    expect(counts["Consumable"]).toBeGreaterThan(5);
    expect(counts["Potion"]).toBeGreaterThan(20);
  });

  it("every category in the table is one the UI knows how to show", () => {
    for (const r of MANUFACTURING_TABLE) {
      expect(MANUFACTURING_CATEGORIES, `"${r.name}" has an unlisted category`)
        .toContain(r.category);
    }
  });

  it("names are unique across the whole catalogue", () => {
    const seen = names.map(n => n.toLowerCase());
    expect(new Set(seen).size, "duplicate recipe name").toBe(seen.length);
  });

  it("every tool named by a recipe has an ability mapped to it", () => {
    for (const r of MANUFACTURING_TABLE) {
      for (const tool of r.tools) {
        expect(TOOL_ABILITY, `"${r.name}" wants an unknown tool: ${tool}`)
          .toHaveProperty(tool);
      }
    }
  });
});

// ─── Consumables ──────────────────────────────────────────────────────────────

describe("consumables", () => {
  it("carries the alchemical staples by name", () => {
    for (const name of ["Acid (vial)", "Alchemist's Fire (flask)", "Antitoxin (vial)",
                        "Holy Water (flask)", "Oil (flask)", "Poison, Basic (vial)"]) {
      expect(getRecipe(name), `missing "${name}"`).toBeTruthy();
    }
  });

  it("basic poison needs a poisoner's kit, not general alchemy", () => {
    expect(getRecipe("Poison, Basic (vial)").tools).toEqual(["Poisoner's kit"]);
  });

  it("is distinct from the empty vessels on the Consumable Base list", () => {
    expect(getRecipe("Potion base").category).toBe("Consumable Base");
    expect(getRecipe("Acid (vial)").category).toBe("Consumable");
  });
});

// ─── Potions ──────────────────────────────────────────────────────────────────

describe("potions", () => {
  it("scales DC, time and cost strictly with rarity", () => {
    const order = ["common", "uncommon", "rare", "very rare", "legendary"];
    for (let i = 1; i < order.length; i++) {
      const prev = RARITY_CRAFTING[order[i - 1]];
      const curr = RARITY_CRAFTING[order[i]];
      expect(curr.dc, `${order[i]} DC`).toBeGreaterThan(prev.dc);
      expect(curr.hours, `${order[i]} hours`).toBeGreaterThan(prev.hours);
      expect(curr.gp, `${order[i]} cost`).toBeGreaterThan(prev.gp);
    }
  });

  it("every potion's numbers come from its rarity, never hand-typed", () => {
    // The whole point of deriving the table is that nothing can drift.
    for (const p of POTION_TABLE) {
      const scale = RARITY_CRAFTING[p.rarity];
      expect(scale, `"${p.name}" has an unknown rarity`).toBeTruthy();
      expect(p.dc).toBe(scale.dc);
      expect(p.hours).toBe(scale.hours);
      expect(p.materialGp).toBe(scale.gp);
    }
  });

  it("the healing line spans common to very rare", () => {
    expect(getRecipe("Potion of Healing").rarity).toBe("common");
    expect(getRecipe("Potion of Greater Healing").rarity).toBe("uncommon");
    expect(getRecipe("Potion of Superior Healing").rarity).toBe("rare");
    expect(getRecipe("Potion of Supreme Healing").rarity).toBe("very rare");
  });

  it("a legendary potion is a campaign undertaking, not an afternoon", () => {
    const storm = getRecipe("Potion of Storm Giant Strength");
    expect(storm.rarity).toBe("legendary");
    expect(storm.hours).toBeGreaterThanOrEqual(1000);
  });

  it("brewing counts — a potion is not alchemy-only", () => {
    expect(getRecipe("Potion of Healing").tools).toContain("Brewer's supplies");
    expect(getRecipe("Potion of Healing").tools).toContain("Herbalism kit");
  });

  it("prices nothing it has no basis to price", () => {
    // Better a null than an invented market value.
    for (const p of POTION_TABLE) expect(p.valueGp).toBeNull();
  });
});

// ─── Third-party recipes ──────────────────────────────────────────────────────

describe("third-party recipes", () => {
  afterEach(() => clearExtraRecipes());

  const gh = { name: "Blightsteel Blade", category: "Third-party Weapons", tools: ["Smith's tools"], hours: 20, dc: 18 };

  it("starts empty — nothing third-party ships in the box", () => {
    expect(getExtraRecipes()).toEqual([]);
  });

  it("registers world-loaded recipes and marks them non-SRD", () => {
    expect(registerExtraRecipes([gh], "Grim Hollow")).toBe(1);
    const found = getRecipe("Blightsteel Blade");
    expect(found.srd).toBe(false);
    expect(found.source).toBe("Grim Hollow");
  });

  it("ignores junk rather than registering half a recipe", () => {
    expect(registerExtraRecipes([{ name: "No category" }, null, { category: "No name" }])).toBe(0);
  });

  it("lets a world override a shipped recipe instead of duplicating it", () => {
    registerExtraRecipes([{ name: "Plate", category: "Armour", tools: ["Smith's tools"], hours: 200, dc: 25 }], "Grim Hollow");
    const plate = allRecipes().filter(r => r.name === "Plate");
    expect(plate).toHaveLength(1);
    expect(plate[0].dc).toBe(25);
  });

  it("re-registering the same name replaces it, so a reload never doubles up", () => {
    registerExtraRecipes([gh], "Grim Hollow");
    registerExtraRecipes([{ ...gh, dc: 20 }], "Grim Hollow");
    expect(getExtraRecipes()).toHaveLength(1);
    expect(getRecipe("Blightsteel Blade").dc).toBe(20);
  });

  it("shows an invented category after the known ones rather than dropping it", () => {
    registerExtraRecipes([gh], "Grim Hollow");
    const groups = getRecipesByCategory().map(g => g.category);
    expect(groups).toContain("Third-party Weapons");
    expect(groups.indexOf("Third-party Weapons")).toBeGreaterThan(groups.indexOf("Armour"));
  });

  it("clearing leaves only what shipped", () => {
    registerExtraRecipes([gh], "Grim Hollow");
    clearExtraRecipes();
    expect(getRecipe("Blightsteel Blade")).toBeNull();
    expect(allRecipes()).toHaveLength(MANUFACTURING_TABLE.length);
  });

  it("a world recipe still plans like any other", () => {
    registerExtraRecipes([gh], "Grim Hollow");
    const plan = planManufacture(getRecipe("Blightsteel Blade"), {
      mods: { str: 3, con: 1 }, tools: ["Smith's tools"], proficiency: 3
    });
    expect(plan.disadvantage).toBe(false);
    expect(plan.dc).toBe(18);
  });
});

// ─── recipeFromItem ───────────────────────────────────────────────────────────

describe("recipeFromItem", () => {
  it("reads a plain dnd5e item with no annotation at all", () => {
    // Importing a book must be useful before anyone has tagged anything.
    const r = recipeFromItem({ name: "Ashen Cuirass", type: "equipment", system: { price: { value: 300 } } }, "Grim Hollow");
    expect(r.name).toBe("Ashen Cuirass");
    expect(r.category).toBe("Third-party Armour & Gear");
    expect(r.materialGp).toBe(100);   // one third of value
    expect(r.srd).toBe(false);
  });

  it("prefers the table's own flags over anything inferred", () => {
    const r = recipeFromItem({
      name: "Ashen Cuirass",
      type: "equipment",
      system: { price: { value: 300 } },
      flags: { "runes-and-remnants": { category: "Armour", tools: ["Smith's tools"], hours: 60, dc: 19, materialGp: 250 } }
    });
    expect(r.category).toBe("Armour");
    expect(r.dc).toBe(19);
    expect(r.materialGp).toBe(250);
  });

  it("survives an item with no price", () => {
    const r = recipeFromItem({ name: "Cursed Thing", type: "loot" });
    expect(r.materialGp).toBeNull();
    expect(r.valueGp).toBeNull();
    expect(r.category).toBe("Third-party Materials");
  });

  it("keeps an unknown item type out of a bucket that would misdescribe it", () => {
    expect(recipeFromItem({ name: "Odd", type: "spell" }).category).toBe("Third-party Gear");
  });

  it("returns null for something with no name", () => {
    expect(recipeFromItem({ type: "weapon" })).toBeNull();
    expect(recipeFromItem(null)).toBeNull();
  });
});
