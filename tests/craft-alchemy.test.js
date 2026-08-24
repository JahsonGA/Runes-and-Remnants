import { describe, it, expect } from "vitest";
import { ALCHEMY_INGREDIENTS, ROLES, ENCHANTMENT_BASE, MAX_MODIFIERS } from "../src/data/alchemy.js";
import {
  getIngredient,
  ingredientsByRole,
  computeAlchemyDC,
  analyseConcoction,
  poisonSaveDC,
  alchemyModifier
} from "../src/craft/logic.js";

// ─── Ingredient table ─────────────────────────────────────────────────────────

describe("ALCHEMY_INGREDIENTS — integrity", () => {
  it("every ingredient has a name, rarity, role, dc and terrain", () => {
    for (const i of ALCHEMY_INGREDIENTS) {
      expect(typeof i.name).toBe("string");
      expect(i.name.trim().length).toBeGreaterThan(0);
      expect(typeof i.rarity, `"${i.name}" missing rarity`).toBe("string");
      expect(ROLES, `"${i.name}" has unknown role "${i.role}"`).toContain(i.role);
      expect(typeof i.dc, `"${i.name}" missing dc`).toBe("number");
      expect(Array.isArray(i.terrain), `"${i.name}" missing terrain`).toBe(true);
      expect(i.terrain.length).toBeGreaterThan(0);
    }
  });

  it("names are unique", () => {
    const names = ALCHEMY_INGREDIENTS.map(i => i.name);
    const dupes = [...new Set(names.filter((n, idx) => names.indexOf(n) !== idx))];
    expect(dupes, `duplicates: ${dupes.join(", ")}`).toEqual([]);
  });

  it("there is exactly one enchantment base, and it is Elemental Water", () => {
    const bases = ingredientsByRole("enchantment-base");
    expect(bases).toHaveLength(1);
    expect(bases[0].name).toBe(ENCHANTMENT_BASE);
  });

  it("both potions and poisons have a base effect to build on", () => {
    expect(ingredientsByRole("potion-effect").length).toBeGreaterThan(0);
    expect(ingredientsByRole("toxin-effect").length).toBeGreaterThan(0);
  });

  it("Lavender Sprig is the only ingredient that lowers the DC", () => {
    const negative = ALCHEMY_INGREDIENTS.filter(i => i.dc < 0).map(i => i.name);
    expect(negative).toEqual(["Lavender Sprig"]);
  });
});

// ─── Lookup ───────────────────────────────────────────────────────────────────

describe("getIngredient", () => {
  it("finds by name, case-insensitively", () => {
    expect(getIngredient("wild sageroot")?.name).toBe("Wild Sageroot");
  });

  it("returns null for unknown or empty input", () => {
    expect(getIngredient("Unobtainium")).toBeNull();
    expect(getIngredient()).toBeNull();
  });
});

// ─── DC arithmetic ────────────────────────────────────────────────────────────

describe("computeAlchemyDC", () => {
  it("a bare effect sits at the base DC of 10", () => {
    expect(computeAlchemyDC(["Wild Sageroot"])).toBe(10);
  });

  it("reproduces the source's worked example — Potion of Delayed Potent Healing", () => {
    // Wild Sageroot (0) + Milkweed Seeds (+2) + Gengko Brush (+2) = DC 14
    expect(computeAlchemyDC(["Wild Sageroot", "Milkweed Seeds", "Gengko Brush"])).toBe(14);
  });

  it("reproduces Death's Bite", () => {
    // Wyrmtongue (0) + Arctic Creeper (+2) + Spineflower (+3) + Quicksilver (+3) = DC 18
    expect(computeAlchemyDC([
      "Wyrmtongue Petals", "Arctic Creeper", "Spineflower Berries", "Quicksilver Lichen"
    ])).toBe(18);
  });

  it("Widow Venom computes to 16, not the 17 the source prints", () => {
    // Wyrmtongue (0) + Amanita Cap (+1) + Cactus Juice (+2) + Spineflower (+3)
    // = 10 + 6 = 16. The supplement's worked example says DC 17, which does
    // not match its own ingredient table — an erratum in the source, not here.
    // The other two worked examples (DC 14 and DC 18) both check out.
    expect(computeAlchemyDC([
      "Wyrmtongue Petals", "Amanita Cap", "Cactus Juice", "Spineflower Berries"
    ])).toBe(16);
  });

  it("Lavender Sprig steadies a volatile mix", () => {
    const wild = computeAlchemyDC(["Wyrmtongue Petals", "Chromus Slime"]);
    const steadied = computeAlchemyDC(["Wyrmtongue Petals", "Chromus Slime", "Lavender Sprig"]);
    expect(steadied).toBe(wild - 2);
  });

  it("ignores unknown names rather than throwing", () => {
    expect(computeAlchemyDC(["Wild Sageroot", "Unobtainium"])).toBe(10);
  });

  it("an empty list is just the base", () => {
    expect(computeAlchemyDC([])).toBe(10);
  });
});

// ─── Potions ──────────────────────────────────────────────────────────────────

describe("analyseConcoction — potions", () => {
  it("recognises a simple healing potion", () => {
    const r = analyseConcoction(["Wild Sageroot"]);
    expect(r.kind).toBe("potion");
    expect(r.valid).toBe(true);
    expect(r.tools).toContain("Alchemist's supplies");
  });

  it("accepts up to three modifiers", () => {
    const r = analyseConcoction(["Wild Sageroot", "Milkweed Seeds", "Gengko Brush", "Dried Ephedra"]);
    expect(r.modifiers).toHaveLength(3);
    expect(r.valid).toBe(true);
  });

  it("rejects a fourth modifier", () => {
    const r = analyseConcoction([
      "Wild Sageroot", "Milkweed Seeds", "Gengko Brush", "Dried Ephedra", "Emetic Wax"
    ]);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(new RegExp(`most ${MAX_MODIFIERS} modifiers`, "i"));
  });

  it("rejects a concoction with no effect base", () => {
    const r = analyseConcoction(["Milkweed Seeds"]);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/needs one effect ingredient/i);
  });

  it("rejects two competing effects", () => {
    const r = analyseConcoction(["Wild Sageroot", "Hyancinth Nectar"]);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/only one effect/i);
  });

  it("Bloodgrass is the exception and rides along with another effect", () => {
    const r = analyseConcoction(["Wild Sageroot", "Bloodgrass"]);
    expect(r.valid).toBe(true);
    expect(r.kind).toBe("potion");
  });

  it("refuses a toxin modifier in a potion", () => {
    const r = analyseConcoction(["Wild Sageroot", "Spineflower Berries"]);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/cannot be used in a potion/i);
  });

  it("a locked effect refuses all modifiers", () => {
    const r = analyseConcoction(["Fennel Silk", "Milkweed Seeds"]);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/cannot be altered/i);
  });

  it("a locked effect on its own is fine", () => {
    expect(analyseConcoction(["Fennel Silk"]).valid).toBe(true);
  });
});

// ─── Poisons ──────────────────────────────────────────────────────────────────

describe("analyseConcoction — poisons", () => {
  it("Wyrmtongue Petals make a poison and call for a poisoner's kit", () => {
    const r = analyseConcoction(["Wyrmtongue Petals"]);
    expect(r.kind).toBe("poison");
    expect(r.valid).toBe(true);
    expect(r.tools).toEqual(["Poisoner's kit"]);
  });

  it("validates the source's Death's Bite recipe", () => {
    const r = analyseConcoction([
      "Wyrmtongue Petals", "Arctic Creeper", "Spineflower Berries", "Quicksilver Lichen"
    ]);
    expect(r.valid).toBe(true);
    expect(r.dc).toBe(18);
  });

  it("refuses a potion modifier in a poison", () => {
    const r = analyseConcoction(["Wyrmtongue Petals", "Milkweed Seeds"]);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/cannot be used in a poison/i);
  });

  it("both-modifiers work in either direction", () => {
    expect(analyseConcoction(["Wyrmtongue Petals", "Lavender Sprig"]).valid).toBe(true);
    expect(analyseConcoction(["Wild Sageroot", "Lavender Sprig"]).valid).toBe(true);
  });

  it("Bloodgrass cannot be mixed into a poison", () => {
    const r = analyseConcoction(["Wyrmtongue Petals", "Bloodgrass"]);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/only combines with a potion/i);
  });

  it("Basilisk Breath cannot be altered", () => {
    const r = analyseConcoction(["Basilisk Breath", "Quicksilver Lichen"]);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/cannot be altered/i);
  });
});

// ─── Enchantments ─────────────────────────────────────────────────────────────

describe("analyseConcoction — enchantments", () => {
  it("Elemental Water plus an enchantment is a valid brew", () => {
    const r = analyseConcoction([ENCHANTMENT_BASE, "Wisp Stalks"]);
    expect(r.kind).toBe("enchantment");
    expect(r.valid).toBe(true);
    expect(r.dc).toBe(18); // 10 + 3 base + 5
  });

  it("an enchantment without the base is rejected", () => {
    const r = analyseConcoction(["Wisp Stalks"]);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(new RegExp(`need ${ENCHANTMENT_BASE}`, "i"));
  });

  it("the base without an enchantment is rejected", () => {
    const r = analyseConcoction([ENCHANTMENT_BASE]);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/needs an enchantment ingredient/i);
  });

  it("enchantments refuse modifiers — the magic is too volatile", () => {
    const r = analyseConcoction([ENCHANTMENT_BASE, "Wisp Stalks", "Lavender Sprig"]);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/cannot take modifiers/i);
  });

  it("only one enchantment per brew", () => {
    const r = analyseConcoction([ENCHANTMENT_BASE, "Wisp Stalks", "Voidroot"]);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/only one enchantment/i);
  });
});

// ─── Unknown input ────────────────────────────────────────────────────────────

describe("analyseConcoction — unknown ingredients", () => {
  it("flags unknown names without throwing", () => {
    const r = analyseConcoction(["Wild Sageroot", "Unobtainium"]);
    expect(r.unknown).toEqual(["Unobtainium"]);
    expect(r.valid).toBe(false);
  });

  it("an empty list is invalid, not a crash", () => {
    const r = analyseConcoction([]);
    expect(r.valid).toBe(false);
    expect(r.kind).toBe("unknown");
  });
});

// ─── Derived numbers ──────────────────────────────────────────────────────────

describe("poisonSaveDC", () => {
  it("is 8 + the alchemist's modifier", () => {
    expect(poisonSaveDC(5)).toBe(13);
    expect(poisonSaveDC(0)).toBe(8);
    expect(poisonSaveDC()).toBe(8);
  });
});

describe("alchemyModifier", () => {
  it("takes the better of INT or WIS", () => {
    expect(alchemyModifier({ int: 4, wis: 1 })).toBe(4);
    expect(alchemyModifier({ int: 1, wis: 4 })).toBe(4);
  });

  it("adds proficiency when a relevant tool is used", () => {
    expect(alchemyModifier({ int: 3, proficient: true, proficiency: 3 })).toBe(6);
  });

  it("defaults to zero with no input", () => {
    expect(alchemyModifier()).toBe(0);
  });
});
