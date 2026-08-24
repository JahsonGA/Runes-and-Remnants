import { describe, it, expect } from "vitest";
import { MANUFACTURING_TABLE, MANUFACTURING_CATEGORIES, TOOL_ABILITY } from "../src/data/manufacturing.js";
import {
  getRecipe,
  getRecipesByCategory,
  abilitiesForRecipe,
  bestAbility,
  planManufacture,
  materialYardstick
} from "../src/craft/logic.js";

// ─── Table integrity ──────────────────────────────────────────────────────────

describe("MANUFACTURING_TABLE — integrity", () => {
  it("every recipe has a name, category, tools, hours and dc", () => {
    for (const r of MANUFACTURING_TABLE) {
      expect(typeof r.name, "missing name").toBe("string");
      expect(r.name.trim().length).toBeGreaterThan(0);
      expect(typeof r.category, `"${r.name}" missing category`).toBe("string");
      expect(Array.isArray(r.tools), `"${r.name}" tools should be an array`).toBe(true);
      expect(r.tools.length, `"${r.name}" has no tools`).toBeGreaterThan(0);
      expect(typeof r.hours, `"${r.name}" missing hours`).toBe("number");
      expect(typeof r.dc, `"${r.name}" missing dc`).toBe("number");
    }
  });

  it("item names are unique", () => {
    const names = MANUFACTURING_TABLE.map(r => r.name);
    const dupes = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
    expect(dupes, `duplicates: ${dupes.join(", ")}`).toEqual([]);
  });

  it("every tool named by a recipe has an ability mapping", () => {
    // A tool with no ability would leave the crafter with nothing to roll.
    for (const r of MANUFACTURING_TABLE) {
      for (const tool of r.tools) {
        expect(TOOL_ABILITY[tool], `"${r.name}" uses unknown tool "${tool}"`).toBeDefined();
      }
    }
  });

  it("every category is declared in MANUFACTURING_CATEGORIES", () => {
    for (const r of MANUFACTURING_TABLE) {
      expect(MANUFACTURING_CATEGORIES, `"${r.name}" has stray category`).toContain(r.category);
    }
  });

  it("DCs sit in a sane 5e band", () => {
    for (const r of MANUFACTURING_TABLE) {
      expect(r.dc, `"${r.name}" DC ${r.dc}`).toBeGreaterThanOrEqual(10);
      expect(r.dc, `"${r.name}" DC ${r.dc}`).toBeLessThanOrEqual(20);
    }
  });

  it("martial weapons are harder than simple ones", () => {
    const simple  = MANUFACTURING_TABLE.filter(r => r.category === "Simple Melee");
    const martial = MANUFACTURING_TABLE.filter(r => r.category === "Martial Melee");
    expect(Math.max(...simple.map(r => r.dc))).toBeLessThan(Math.min(...martial.map(r => r.dc)));
  });
});

// ─── Lookup ───────────────────────────────────────────────────────────────────

describe("getRecipe", () => {
  it("finds a recipe by exact name", () => {
    expect(getRecipe("Longsword")?.dc).toBe(17);
  });

  it("is case-insensitive", () => {
    expect(getRecipe("longsword")).toBe(getRecipe("Longsword"));
  });

  it("returns null for an unknown item", () => {
    expect(getRecipe("Vorpal Sword")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(getRecipe()).toBeNull();
    expect(getRecipe("")).toBeNull();
  });
});

describe("getRecipesByCategory", () => {
  it("groups in declared order and drops empty groups", () => {
    const groups = getRecipesByCategory();
    const order = groups.map(g => g.category);
    expect(order).toEqual(MANUFACTURING_CATEGORIES.filter(c => order.includes(c)));
    for (const g of groups) expect(g.recipes.length).toBeGreaterThan(0);
  });

  it("accounts for every recipe exactly once", () => {
    const total = getRecipesByCategory().reduce((n, g) => n + g.recipes.length, 0);
    expect(total).toBe(MANUFACTURING_TABLE.length);
  });
});

// ─── Abilities ────────────────────────────────────────────────────────────────

describe("abilitiesForRecipe", () => {
  it("smith's tools offer Con or Str", () => {
    expect(abilitiesForRecipe(getRecipe("Longsword")).sort()).toEqual(["con", "str"]);
  });

  it("unions abilities across every tool a recipe allows", () => {
    // Javelin: carpenter (dex/str), smith (con/str), woodcarver (dex/str)
    expect(abilitiesForRecipe(getRecipe("Javelin")).sort()).toEqual(["con", "dex", "str"]);
  });

  it("returns an empty list for a missing recipe", () => {
    expect(abilitiesForRecipe(null)).toEqual([]);
  });
});

describe("bestAbility", () => {
  it("picks the highest modifier among the options", () => {
    expect(bestAbility(["con", "str"], { con: 1, str: 4 })).toEqual({ key: "str", mod: 4 });
  });

  it("treats missing modifiers as zero", () => {
    expect(bestAbility(["con", "str"], { str: -1 })).toEqual({ key: "con", mod: 0 });
  });

  it("returns null when there are no options", () => {
    expect(bestAbility([], { str: 5 })).toBeNull();
  });
});

// ─── planManufacture ──────────────────────────────────────────────────────────

describe("planManufacture", () => {
  const smith = { abilities: { str: 3, con: 1 }, tools: ["Smith's tools"], proficiency: 3 };

  it("adds proficiency when the crafter has the right tool", () => {
    const plan = planManufacture(getRecipe("Longsword"), smith);
    expect(plan.proficient).toBe(true);
    expect(plan.disadvantage).toBe(false);
    expect(plan.ability).toBe("str");
    expect(plan.bonus).toBe(6); // str 3 + prof 3
  });

  it("an unproficient crafter rolls at disadvantage without the bonus", () => {
    const plan = planManufacture(getRecipe("Longsword"), { abilities: { str: 3 }, tools: [], proficiency: 3 });
    expect(plan.proficient).toBe(false);
    expect(plan.disadvantage).toBe(true);
    expect(plan.bonus).toBe(3);
  });

  it("carries the recipe's DC, time and tool through", () => {
    const plan = planManufacture(getRecipe("Plate"), smith);
    expect(plan.dc).toBe(20);
    expect(plan.hours).toBe(200);
    expect(plan.tool).toBe("Smith's tools");
  });

  it("falls back to a listed tool when the crafter owns none of them", () => {
    const plan = planManufacture(getRecipe("Longsword"), { abilities: {}, tools: ["Cook's utensils"] });
    expect(plan.tool).toBe("Smith's tools");
    expect(plan.proficient).toBe(false);
  });

  it("returns null for a missing recipe", () => {
    expect(planManufacture(null, smith)).toBeNull();
  });

  it("handles a crafter with no data at all", () => {
    const plan = planManufacture(getRecipe("Club"));
    expect(plan.bonus).toBe(0);
    expect(plan.disadvantage).toBe(true);
  });
});

// ─── Material yardstick ───────────────────────────────────────────────────────

describe("materialYardstick", () => {
  it("uses the table's explicit figure when there is one", () => {
    expect(materialYardstick(getRecipe("Breastplate"))).toBe(130);
  });

  it("falls back to a third of the item value", () => {
    const madeUp = { name: "Test", valueGp: 90, materialGp: null };
    expect(materialYardstick(madeUp)).toBe(30);
  });

  it("returns null when neither figure exists", () => {
    expect(materialYardstick({ name: "Ring", materialGp: null, valueGp: null })).toBeNull();
  });

  it("every priced recipe costs less in materials than it is worth", () => {
    for (const r of MANUFACTURING_TABLE) {
      if (r.materialGp == null || r.valueGp == null) continue;
      expect(r.materialGp, `"${r.name}" materials cost more than the item`).toBeLessThan(r.valueGp);
    }
  });
});
