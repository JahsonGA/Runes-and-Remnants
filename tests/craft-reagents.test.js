import { describe, it, expect } from "vitest";
import { HARVEST_TABLE } from "../src/data/harvest-table.js";
import {
  COMPONENT_PROPERTIES,
  PROPERTY_LABELS,
  PROPERTY_HINTS,
  POTENCY_BY_DC,
  ESSENCE_POTENCY_BY_DC,
  RARITY_POTENCY,
  POTION_PROPERTY,
  CONSUMABLE_REAGENT,
  CATEGORY_REAGENT,
  ITEM_REAGENT,
  UNPRICED_POTENCY,
  ALL_PROPERTIES
} from "../src/data/reagents.js";
import { POTION_TABLE, MANUFACTURING_TABLE } from "../src/data/manufacturing.js";
import {
  getRecipe,
  componentProperties,
  componentPotency,
  componentsWithProperty,
  reagentRequirement,
  materialPotency,
  checkReagents,
  partFromItem,
  partsFromActor,
  planManufacture
} from "../src/craft/logic.js";
import { stampOrigin, lowestComponentDC } from "../src/harvest/logic.js";

const everyComponentName = () => {
  const names = new Set();
  for (const tiers of Object.values(HARVEST_TABLE))
    for (const tier of tiers) for (const item of tier.items) names.add(item);
  return [...names];
};

// ─── Table integrity ──────────────────────────────────────────────────────────

describe("COMPONENT_PROPERTIES", () => {
  it("tags every component the harvest table can drop", () => {
    // An untagged component is dead weight — it can never satisfy a recipe,
    // and the player has no way to find that out except by failing.
    for (const name of everyComponentName()) {
      expect(COMPONENT_PROPERTIES, `"${name}" is harvestable but untagged`)
        .toHaveProperty(name);
    }
  });

  it("tags nothing that cannot actually be harvested", () => {
    const harvestable = new Set(everyComponentName());
    for (const name of Object.keys(COMPONENT_PROPERTIES)) {
      expect(harvestable.has(name), `"${name}" is tagged but never drops`).toBe(true);
    }
  });

  it("uses only declared properties", () => {
    for (const [name, props] of Object.entries(COMPONENT_PROPERTIES)) {
      expect(props.length, `"${name}" has no properties`).toBeGreaterThan(0);
      for (const p of props) {
        expect(ALL_PROPERTIES, `"${name}" has unknown property "${p}"`).toContain(p);
      }
    }
  });

  it("every property is both labelled and explained", () => {
    for (const p of ALL_PROPERTIES) {
      expect(PROPERTY_LABELS[p]?.length, `"${p}" has no label`).toBeGreaterThan(0);
      expect(PROPERTY_HINTS[p]?.length, `"${p}" has no hint`).toBeGreaterThan(0);
    }
  });

  it("no property is so rare that a recipe needing it dead-ends the party", () => {
    // The whole reason for tagging by property instead of by item name.
    for (const p of ALL_PROPERTIES) {
      expect(componentsWithProperty(p).length, `only a handful of parts are "${p}"`)
        .toBeGreaterThanOrEqual(5);
    }
  });

  it("looks components up case-insensitively", () => {
    expect(componentProperties("heart")).toContain("vital");
    expect(componentProperties("HEART")).toContain("vital");
  });

  it("returns nothing for a part it does not know", () => {
    expect(componentProperties("Sword")).toEqual([]);
    expect(componentProperties(null)).toEqual([]);
  });
});

// ─── Potency ──────────────────────────────────────────────────────────────────

describe("componentPotency", () => {
  it("rises with the harvest DC", () => {
    const dcs = [5, 10, 15, 20, 25];
    for (let i = 1; i < dcs.length; i++) {
      expect(POTENCY_BY_DC[dcs[i]]).toBeGreaterThan(POTENCY_BY_DC[dcs[i - 1]]);
    }
  });

  it("rewards the deep cut more than the shallow one, per point of DC", () => {
    // Harvest DCs are cumulative, so the fifth component costs far more than
    // five times the first. Potency has to bend the same way or nobody will
    // ever reach for the hard components.
    const cheap = POTENCY_BY_DC[5] / 5;
    const dear  = POTENCY_BY_DC[25] / 25;
    expect(dear).toBeGreaterThan(cheap);
  });

  it("multiplies by quantity", () => {
    expect(componentPotency({ name: "Bone", dc: 5, quantity: 3 })).toBe(POTENCY_BY_DC[5] * 3);
  });

  it("treats a missing quantity as one", () => {
    expect(componentPotency({ name: "Heart", dc: 20 })).toBe(POTENCY_BY_DC[20]);
  });

  it("weighs essences on their own, heavier scale", () => {
    const essence = componentPotency({ name: "Essence", dc: 50, essence: true });
    expect(essence).toBe(ESSENCE_POTENCY_BY_DC[50]);
    expect(essence).toBeGreaterThan(componentPotency({ name: "Breath Sac", dc: 25 }));
  });

  it("values a part handed over without a DC at the least it could be worth", () => {
    // The same conservative rule partFromItem applies, enforced here too so
    // a caller cannot bypass it by skipping that step.
    expect(componentPotency({ name: "Heart" })).toBe(POTENCY_BY_DC[lowestComponentDC("Heart")]);
    expect(componentPotency({ name: "Heart" })).toBeLessThan(componentPotency({ name: "Heart", dc: 20 }));
  });

  it("is worth nothing for an off-scale DC or no part at all", () => {
    expect(componentPotency({ name: "Odd", dc: 7 })).toBe(0);
    expect(componentPotency(null)).toBe(0);
  });
});

// ─── Requirements ─────────────────────────────────────────────────────────────

describe("reagentRequirement", () => {
  it("every potion in the catalogue names a property", () => {
    for (const p of POTION_TABLE) {
      expect(POTION_PROPERTY, `"${p.name}" has no reagent requirement`).toHaveProperty(p.name);
    }
  });

  it("names nothing that is not in the catalogue", () => {
    const known = new Set(POTION_TABLE.map(p => p.name));
    for (const name of Object.keys(POTION_PROPERTY)) {
      expect(known.has(name), `"${name}" has a requirement but no recipe`).toBe(true);
    }
  });

  it("every requirement uses a property that parts actually carry", () => {
    for (const [name, req] of Object.entries({ ...POTION_PROPERTY, ...CONSUMABLE_REAGENT })) {
      expect(ALL_PROPERTIES, `"${name}" wants unknown property "${req.property}"`)
        .toContain(req.property);
    }
  });

  it("derives a potion's budget from its rarity", () => {
    expect(reagentRequirement(getRecipe("Potion of Healing")).potency).toBe(RARITY_POTENCY.common);
    expect(reagentRequirement(getRecipe("Potion of Supreme Healing")).potency)
      .toBe(RARITY_POTENCY["very rare"]);
  });

  it("gives consumables their own budget, since rarity means nothing to them", () => {
    expect(reagentRequirement(getRecipe("Oil (flask)")).potency).toBe(2);
    expect(reagentRequirement(getRecipe("Poison, Basic (vial)")).potency).toBe(7);
  });

  it("asks for monster parts from gear too — steel is not the material here", () => {
    // A hunter's kit is built out of what they killed. This was wrong in the
    // first cut of the system, which exempted weapons and armour.
    expect(reagentRequirement(getRecipe("Longsword")).properties).toContain("structural");
    expect(reagentRequirement(getRecipe("Plate")).properties).toContain("structural");
  });

  it("lets gear be made of any of several things, since a blade is not one thing", () => {
    expect(reagentRequirement(getRecipe("Plate")).properties).toEqual(["structural", "fibrous"]);
    expect(reagentRequirement(getRecipe("Rod, staff, wand")).properties)
      .toEqual(["arcane", "perceptive", "structural"]);
  });

  it("overrides the category where it would be plainly wrong", () => {
    // Padded armour is quilted; a net is woven. Neither is plate.
    expect(reagentRequirement(getRecipe("Padded")).properties).toEqual(["fibrous"]);
    expect(reagentRequirement(getRecipe("Net")).properties).toEqual(["fibrous"]);
  });

  it("takes gear's budget from the material yardstick, not from rarity", () => {
    const dagger = reagentRequirement(getRecipe("Dagger")).potency;
    const longsword = reagentRequirement(getRecipe("Longsword")).potency;
    const plate = reagentRequirement(getRecipe("Plate")).potency;
    expect(dagger).toBeLessThan(longsword);
    expect(longsword).toBeLessThan(plate);
  });

  it("falls back to a mid-ladder cost for the items the book never prices", () => {
    expect(materialPotency(getRecipe("Ring"))).toBe(UNPRICED_POTENCY);
    expect(materialPotency(getRecipe("Wondrous item"))).toBe(UNPRICED_POTENCY);
  });

  it("every catalogue recipe demands something — the house rule has no exceptions", () => {
    for (const r of MANUFACTURING_TABLE) {
      expect(reagentRequirement(r), `"${r.name}" can be made out of nothing`).toBeTruthy();
    }
  });

  it("every gear requirement names properties that parts actually carry", () => {
    for (const props of [...Object.values(CATEGORY_REAGENT), ...Object.values(ITEM_REAGENT)]) {
      for (const p of props) expect(ALL_PROPERTIES).toContain(p);
    }
  });

  it("no gear budget outruns what a single great part can cover", () => {
    // Plate should be an undertaking, not an impossibility.
    const best = Math.max(...Object.values(ESSENCE_POTENCY_BY_DC));
    for (const r of MANUFACTURING_TABLE) {
      expect(reagentRequirement(r).potency, `"${r.name}" is unbuildable`)
        .toBeLessThanOrEqual(best);
    }
  });

  it("every rarity budget is reachable with parts that exist", () => {
    // A requirement nobody can meet is a bug, not difficulty.
    const best = Math.max(...Object.values(ESSENCE_POTENCY_BY_DC));
    for (const [rarity, potency] of Object.entries(RARITY_POTENCY)) {
      expect(potency, `${rarity} needs more than the best part in the game`)
        .toBeLessThanOrEqual(best);
    }
  });
});

// ─── checkReagents ────────────────────────────────────────────────────────────

describe("checkReagents", () => {
  const superior = getRecipe("Potion of Superior Healing");   // vital, 10

  it("counts only parts carrying the required property", () => {
    const result = checkReagents(superior, [
      { name: "Heart", dc: 20 },
      { name: "Pouch of Scales", dc: 15 }
    ]);
    expect(result.used.map(p => p.name)).toEqual(["Heart"]);
    expect(result.rejected.map(p => p.name)).toEqual(["Pouch of Scales"]);
  });

  it("says why a part was set aside rather than dropping it silently", () => {
    const result = checkReagents(superior, [{ name: "Bone", dc: 5 }, { name: "Sword" }]);
    expect(result.rejected[0].reason).toBe("wrong property");
    expect(result.rejected[1].reason).toBe("not a harvested component");
  });

  it("adds lesser parts up to meet a budget one great part would also meet", () => {
    const oneGreat = checkReagents(superior, [{ name: "Heart", dc: 20 }]);
    const manySmall = checkReagents(superior, [{ name: "Phial of Blood", dc: 5, quantity: 5 }]);
    expect(oneGreat.met).toBe(true);
    expect(manySmall.met).toBe(true);
  });

  it("reports the shortfall so a player knows how much further to hunt", () => {
    const result = checkReagents(superior, [{ name: "Liver", dc: 15 }]);
    expect(result.met).toBe(false);
    expect(result.potency).toBe(7);
    expect(result.shortfall).toBe(3);
  });

  it("discounts the DC for a thematically apt creature, but never requires one", () => {
    const giant = getRecipe("Potion of Hill Giant Strength");
    const fromGiant = checkReagents(giant, [{ name: "Heart", dc: 20, creatureType: "giant" }]);
    const fromTroll = checkReagents(giant, [{ name: "Heart", dc: 20, creatureType: "monstrosity" }]);

    expect(fromGiant.met).toBe(true);
    expect(fromTroll.met).toBe(true);          // the troll's heart still works
    expect(fromGiant.dcAdjust).toBe(-2);
    expect(fromTroll.dcAdjust).toBe(0);
  });

  it("does not let a theme match substitute for potency", () => {
    const giant = getRecipe("Potion of Storm Giant Strength");  // legendary, 25
    const result = checkReagents(giant, [{ name: "Heart", dc: 20, creatureType: "giant" }]);
    expect(result.themed).toBe(true);
    expect(result.met).toBe(false);
  });

  it("matches creature type case-insensitively", () => {
    const giant = getRecipe("Potion of Hill Giant Strength");
    expect(checkReagents(giant, [{ name: "Heart", dc: 20, creatureType: "Giant" }]).themed).toBe(true);
  });

  it("waves through a world recipe in a category it has never heard of", () => {
    // Better to let a table's own content build than to block it on a
    // category this module was never told about.
    const invented = { name: "Soulforge Engine", category: "Clockwork", tools: [], dc: 15, hours: 4 };
    expect(checkReagents(invented, []).required).toBe(false);
    expect(checkReagents(invented, []).met).toBe(true);
  });

  it("survives being handed nothing", () => {
    expect(checkReagents(superior).met).toBe(false);
    expect(checkReagents(null, []).met).toBe(true);
  });
});

// ─── planManufacture with reagents ────────────────────────────────────────────

describe("planManufacture — reagents", () => {
  it("blocks a potion with nothing on the bench", () => {
    const plan = planManufacture(getRecipe("Potion of Healing"), {}, []);
    expect(plan.blocked).toBe(true);
    expect(plan.reagents.shortfall).toBe(RARITY_POTENCY.common);
  });

  it("unblocks once the budget is met", () => {
    const plan = planManufacture(getRecipe("Potion of Healing"), {}, [{ name: "Phial of Blood", dc: 5 }]);
    expect(plan.blocked).toBe(false);
  });

  it("applies the theme discount to the DC and keeps the base visible", () => {
    const plan = planManufacture(getRecipe("Potion of Fire Breath"), {},
      [{ name: "Breath Sac", dc: 25, creatureType: "dragon" }]);
    expect(plan.baseDc).toBe(15);
    expect(plan.dc).toBe(13);
  });

  it("blocks a blade with no bone, talon or chitin to knap it from", () => {
    expect(planManufacture(getRecipe("Longsword"), {}, []).blocked).toBe(true);
  });

  it("builds the things the source books actually describe", () => {
    // A blade from a talon, plate from chitin, a wand from an eye stalk.
    const blade = planManufacture(getRecipe("Dagger"), {}, [{ name: "Talon", dc: 10 }]);
    const plate = planManufacture(getRecipe("Plate"), {}, [
      { name: "Chitin", dc: 20 }, { name: "Hide", dc: 20 }
    ]);
    const wand = planManufacture(getRecipe("Rod, staff, wand"), {}, [
      { name: "Main Eye", dc: 20, creatureType: "aberration" }
    ]);

    expect(blade.blocked).toBe(false);
    expect(plate.blocked).toBe(false);
    expect(wand.blocked).toBe(false);
  });

  it("will not let a heart be hammered into a breastplate", () => {
    // Organs are not armour. The property is the whole point.
    const plate = planManufacture(getRecipe("Plate"), {}, [{ name: "Heart", dc: 20 }]);
    expect(plate.blocked).toBe(true);
    expect(plate.reagents.rejected.map(p => p.name)).toEqual(["Heart"]);
  });
});

// ─── Origin stamping ──────────────────────────────────────────────────────────

describe("origin stamping", () => {
  it("records where a part came from in the module's own namespace", () => {
    const data = stampOrigin({ name: "Heart" }, { creatureType: "dragon", cr: 17, dc: 20 });
    expect(data.flags["runes-and-remnants"].origin.creatureType).toBe("dragon");
  });

  it("leaves existing flags alone", () => {
    const data = stampOrigin(
      { name: "Heart", flags: { "runes-and-remnants": { keep: true }, other: {} } },
      { dc: 20 }
    );
    expect(data.flags["runes-and-remnants"].keep).toBe(true);
    expect(data.flags.other).toBeTruthy();
  });

  it("is a no-op when there is no origin to record", () => {
    expect(stampOrigin({ name: "Heart" }, null).flags).toBeUndefined();
  });
});

describe("partFromItem", () => {
  it("reads a stamped part at the DC it was actually cut at", () => {
    const part = partFromItem({
      name: "Heart",
      system: { quantity: 2 },
      flags: { "runes-and-remnants": { origin: { dc: 20, creatureType: "dragon", cr: 17 } } }
    });
    expect(part.dc).toBe(20);
    expect(part.creatureType).toBe("dragon");
    expect(part.quantity).toBe(2);
    expect(part.stamped).toBe(true);
  });

  it("falls back to the component's lowest DC when nothing is stamped", () => {
    // Generous defaults here would let a player launder scraps into
    // legendary reagents, so an unlabelled heart is a goblin's.
    const part = partFromItem({ name: "Heart" });
    expect(part.dc).toBe(lowestComponentDC("Heart"));
    expect(part.dc).toBe(15);
    expect(part.stamped).toBe(false);
  });

  it("ignores anything that is not a harvest component", () => {
    expect(partFromItem({ name: "Longsword" })).toBeNull();
    expect(partFromItem({})).toBeNull();
    expect(partFromItem(null)).toBeNull();
  });

  it("reads a whole inventory, keeping only what crafting can use", () => {
    const actor = { items: [{ name: "Heart" }, { name: "Longsword" }, { name: "Bone" }] };
    expect(partsFromActor(actor).map(p => p.name)).toEqual(["Heart", "Bone"]);
  });

  it("handles a Foundry collection as well as a plain array", () => {
    const actor = { items: { contents: [{ name: "Eye" }] } };
    expect(partsFromActor(actor)).toHaveLength(1);
  });

  it("survives an actor with nothing at all", () => {
    expect(partsFromActor(null)).toEqual([]);
    expect(partsFromActor({})).toEqual([]);
  });
});
