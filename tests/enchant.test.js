import { describe, it, expect } from "vitest";
import {
  REMNANT_TIERS, RARITY_ORDER, ENCHANTMENTS, FLAWS, FLAW_BANDS,
  ITEM_KINDS, ATTUNEMENT_MULTIPLIER, CONSUMABLE_TIME_DIVISOR
} from "../src/data/enchanting.js";
import { ALL_PROPERTIES } from "../src/data/reagents.js";
import { ESSENCE_TABLE, HARVEST_SKILL_BY_TYPE } from "../src/harvest/logic.js";
import { componentsWithProperty } from "../src/craft/logic.js";
import {
  normaliseRarity, rarityRank, remnantTier, remnantsFrom,
  getEnchantment, itemKind, enchantmentsFor, componentsFor,
  enchantPlan, resolveEnchant
} from "../src/enchant/logic.js";

const caster = (over = {}) => ({
  ability: "int", abilityMod: 4, skills: ["Survival"], proficiency: 3, isCaster: true, ...over
});
const firstFlaw = list => list[0];

// ─── Data integrity ───────────────────────────────────────────────────────────

describe("enchanting tables", () => {
  it("remnant tiers climb in DC and in time together", () => {
    for (let i = 1; i < REMNANT_TIERS.length; i++) {
      expect(REMNANT_TIERS[i].dc, REMNANT_TIERS[i].rarity)
        .toBeGreaterThan(REMNANT_TIERS[i - 1].dc);
      expect(REMNANT_TIERS[i].hours, REMNANT_TIERS[i].rarity)
        .toBeGreaterThan(REMNANT_TIERS[i - 1].hours);
    }
  });

  it("matches the DCs and hours the panel has always printed", () => {
    const byRarity = Object.fromEntries(REMNANT_TIERS.map(t => [t.rarity, t]));
    expect(byRarity.common).toMatchObject({ dc: 12, hours: 1 });
    expect(byRarity.uncommon).toMatchObject({ dc: 15, hours: 10 });
    expect(byRarity.rare).toMatchObject({ dc: 18, hours: 40 });
    expect(byRarity["very rare"]).toMatchObject({ dc: 21, hours: 160 });
    expect(byRarity.legendary).toMatchObject({ dc: 25, hours: 640 });
    expect(byRarity.artifact).toMatchObject({ dc: 30, hours: 100000 });
  });

  it("every remnant tier is an essence the harvest table actually drops", () => {
    // Otherwise the loop breaks: a tier nobody can obtain is a dead branch.
    const dropped = ESSENCE_TABLE.map(e => e.name.toLowerCase());
    for (const tier of REMNANT_TIERS.filter(t => t.remnant)) {
      expect(dropped.some(n => n.includes(tier.remnant.toLowerCase())),
        `no essence drops a "${tier.remnant}" remnant`).toBe(true);
    }
  });

  it("every enchantment names a real property and a real item kind", () => {
    for (const e of ENCHANTMENTS) {
      expect(ALL_PROPERTIES, `"${e.name}" wants unknown property`).toContain(e.property);
      expect(e.kinds.length, `"${e.name}" fits nothing`).toBeGreaterThan(0);
      for (const k of e.kinds) expect(ITEM_KINDS, `"${e.name}"`).toContain(k);
      expect(RARITY_ORDER, `"${e.name}" has an off-ladder rarity`).toContain(e.rarity);
      expect(e.effect.length, `"${e.name}" has no effect text`).toBeGreaterThan(10);
    }
  });

  it("every enchantment can actually be made from parts that drop", () => {
    // The reason enchantments key off properties rather than named parts.
    for (const e of ENCHANTMENTS) {
      expect(componentsWithProperty(e.property).length, `nothing satisfies "${e.name}"`)
        .toBeGreaterThan(0);
    }
  });

  it("every item kind has something to make at the bottom of the ladder", () => {
    // A party that has only ever killed a wolf should still have an option.
    for (const kind of ITEM_KINDS) {
      const cheap = enchantmentsFor(kind).filter(e => rarityRank(e.rarity) <= 1);
      expect(cheap.length, `nothing low-rarity for ${kind}`).toBeGreaterThan(0);
    }
  });

  it("names are unique", () => {
    const names = ENCHANTMENTS.map(e => e.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it("flaws are distinct and readable", () => {
    expect(new Set(FLAWS).size).toBe(FLAWS.length);
    expect(FLAWS.length).toBeGreaterThanOrEqual(FLAW_BANDS[1].flaws);
    for (const f of FLAWS) expect(f.length).toBeGreaterThan(20);
  });
});

// ─── Rarity ───────────────────────────────────────────────────────────────────

describe("rarity", () => {
  it("reads the several spellings in play as the same thing", () => {
    // The essence table says veryRare, manufacturing says "very rare", dnd5e
    // says veryRare. Comparing raw would silently treat a very rare remnant
    // as unknown and downgrade an item the party worked for.
    for (const spelling of ["veryRare", "very rare", "Very Rare", "very_rare", "VERYRARE"]) {
      expect(normaliseRarity(spelling), spelling).toBe("very rare");
    }
  });

  it("returns null for something not on the ladder", () => {
    expect(normaliseRarity("mythical")).toBeNull();
    expect(normaliseRarity(null)).toBeNull();
  });

  it("ranks weakest to strongest", () => {
    expect(rarityRank("common")).toBeLessThan(rarityRank("uncommon"));
    expect(rarityRank("legendary")).toBeLessThan(rarityRank("artifact"));
  });

  it("every essence rarity is one the enchanting ladder recognises", () => {
    for (const e of ESSENCE_TABLE) {
      expect(rarityRank(e.rarity), `"${e.name}" rarity "${e.rarity}"`).toBeGreaterThan(-1);
    }
  });
});

// ─── Remnants ─────────────────────────────────────────────────────────────────

describe("remnants", () => {
  it("reads the essence names harvest actually grants", () => {
    expect(remnantTier("Essence (Potent)").rarity).toBe("very rare");
    expect(remnantTier("Essence (Deific)").rarity).toBe("artifact");
  });

  it("reads a bare tier word, for a GM handing one out by hand", () => {
    expect(remnantTier("Mythic").rarity).toBe("legendary");
    expect(remnantTier("a robust remnant").rarity).toBe("rare");
  });

  it("treats anything else as no remnant at all", () => {
    expect(remnantTier("Heart").remnant).toBeNull();
    expect(remnantTier(null).remnant).toBeNull();
  });

  it("picks remnants out of a pack, weakest first", () => {
    const found = remnantsFrom([
      { name: "Heart" },
      { name: "Essence (Mythic)" },
      { name: "Essence (Frail)" },
      { name: "Bone" }
    ]);
    expect(found.map(r => r.tier.remnant)).toEqual(["Frail", "Mythic"]);
  });
});

// ─── Item kinds ───────────────────────────────────────────────────────────────

describe("itemKind", () => {
  it("knows a weapon", () => {
    expect(itemKind({ type: "weapon" })).toBe("weapon");
  });

  it("knows armour, which dnd5e files under equipment", () => {
    expect(itemKind({ type: "equipment", system: { armor: { type: "heavy" } } })).toBe("armour");
  });

  it("treats a trinket as wondrous rather than armour", () => {
    expect(itemKind({ type: "equipment", system: { armor: { type: "trinket" } } })).toBe("wondrous");
  });

  it("falls back to wondrous rather than refusing", () => {
    expect(itemKind({ type: "consumable" })).toBe("wondrous");
    expect(itemKind(null)).toBeNull();
  });
});

// ─── enchantPlan ──────────────────────────────────────────────────────────────

describe("enchantPlan", () => {
  const sword = { name: "Longsword", type: "weapon" };

  it("builds the check from the caster's ability and the corpse's skill", () => {
    // A wizard working a dragon's remnant rolls Intelligence (Survival).
    const plan = enchantPlan({
      enchantment: "Keen", item: sword,
      remnant: { name: "Essence (Frail)", creatureType: "dragon" },
      component: { name: "Pouch of Teeth" }, caster: caster()
    });
    expect(plan.ability).toBe("int");
    expect(plan.skill).toBe(HARVEST_SKILL_BY_TYPE.dragon);
    expect(plan.bonus).toBe(7);            // +4 ability, +3 proficiency
  });

  it("takes the skill from the remnant's creature, not the caster's choice", () => {
    const plan = enchantPlan({
      enchantment: "Keen", item: sword,
      remnant: { name: "Essence (Frail)", creatureType: "undead" },
      component: { name: "Bone" }, caster: caster()
    });
    expect(plan.skill).toBe("Medicine");
    expect(plan.proficient).toBe(false);   // caster has Survival, not Medicine
    expect(plan.bonus).toBe(4);
  });

  it("uses the recipe's rarity when the remnant only just meets it", () => {
    const plan = enchantPlan({
      enchantment: "Keen", item: sword,                    // asks uncommon
      remnant: { name: "Essence (Frail)", creatureType: "dragon" },
      component: { name: "Bone" }, caster: caster()
    });
    expect(plan.rarity).toBe("uncommon");
    expect(plan.dc).toBe(15);
    expect(plan.upgraded).toBe(false);
  });

  it("a stronger remnant raises the rarity, the DC and the hours together", () => {
    const plan = enchantPlan({
      enchantment: "Keen", item: sword,                    // asks uncommon
      remnant: { name: "Essence (Potent)", creatureType: "dragon" },
      component: { name: "Bone" }, caster: caster()
    });
    expect(plan.rarity).toBe("very rare");
    expect(plan.upgraded).toBe(true);
    expect(plan.dc).toBe(21);
    expect(plan.hours).toBe(160);
  });

  it("a remnant too weak to hold the enchantment blocks it", () => {
    const plan = enchantPlan({
      enchantment: "Lifedrinker", item: sword,             // asks rare
      remnant: { name: "Essence (Frail)", creatureType: "dragon" },
      component: { name: "Heart" }, caster: caster()
    });
    expect(plan.valid).toBe(false);
    expect(plan.blockers.join(" ")).toMatch(/too weak/i);
  });

  it("refuses an enchantment the item cannot take", () => {
    const plan = enchantPlan({
      enchantment: "Shadowweave",                          // armour only
      item: sword,
      remnant: { name: "Essence (Frail)", creatureType: "beast" },
      component: { name: "Fur" }, caster: caster()
    });
    expect(plan.blockers.join(" ")).toMatch(/cannot be worked into a weapon/i);
  });

  it("refuses a component of the wrong property", () => {
    const plan = enchantPlan({
      enchantment: "Venomous", item: sword,
      remnant: { name: "Essence (Frail)", creatureType: "beast" },
      component: { name: "Bone" }, caster: caster()
    });
    expect(plan.blockers.join(" ")).toMatch(/not a virulent component/i);
  });

  it("only a spellcaster can bind a remnant", () => {
    const plan = enchantPlan({
      enchantment: "Keen", item: sword,
      remnant: { name: "Essence (Frail)", creatureType: "dragon" },
      component: { name: "Bone" }, caster: caster({ isCaster: false })
    });
    expect(plan.blockers.join(" ")).toMatch(/spellcaster/i);
  });

  it("reports every blocker at once, not one per reload", () => {
    const plan = enchantPlan({
      enchantment: "Lifedrinker",
      item: { name: "Plate", type: "equipment", system: { armor: { type: "heavy" } } },
      remnant: { name: "Essence (Frail)", creatureType: "beast" },
      component: { name: "Bone" }, caster: caster()
    });
    expect(plan.blockers.length).toBeGreaterThanOrEqual(3);
  });

  it("attunement doubles the hours; a consumable takes a fraction", () => {
    const base = { enchantment: "Keen", item: sword, component: { name: "Bone" },
                   remnant: { name: "Essence (Frail)", creatureType: "dragon" }, caster: caster() };
    const plain = enchantPlan(base);
    expect(enchantPlan({ ...base, attunement: true }).hours)
      .toBe(plain.hours * ATTUNEMENT_MULTIPLIER);
    expect(enchantPlan({ ...base, consumable: true }).hours)
      .toBe(Math.max(1, Math.round(plain.hours / CONSUMABLE_TIME_DIVISOR)));
  });

  it("asks for an item before anything else", () => {
    const plan = enchantPlan({ enchantment: "Keen", caster: caster() });
    expect(plan.blockers.join(" ")).toMatch(/cannot enchant what does not exist/i);
  });

  it("says so plainly when no enchantment is chosen", () => {
    expect(enchantPlan({}).valid).toBe(false);
    expect(enchantPlan({}).blockers).toEqual(["Choose an enchantment."]);
  });
});

// ─── componentsFor ────────────────────────────────────────────────────────────

describe("componentsFor", () => {
  it("offers only parts matching the enchantment's property", () => {
    const parts = [{ name: "Poison Gland (Poison)" }, { name: "Bone" }, { name: "Stinger" }];
    expect(componentsFor("Venomous", parts).map(p => p.name))
      .toEqual(["Poison Gland (Poison)", "Stinger"]);
  });

  it("never offers a remnant as a component — they do different jobs", () => {
    const parts = [{ name: "Essence (Mythic)" }, { name: "Bone" }];
    expect(componentsFor("Keen", parts).map(p => p.name)).toEqual(["Bone"]);
  });
});

// ─── resolveEnchant ───────────────────────────────────────────────────────────

describe("resolveEnchant", () => {
  it("binds cleanly when the check meets the DC", () => {
    const r = resolveEnchant({ total: 21, dc: 21, pick: firstFlaw });
    expect(r.clean).toBe(true);
    expect(r.flaws).toEqual([]);
  });

  it("still binds on a miss, but flawed — failure is not nothing", () => {
    // More interesting than "nothing happens", and it lets a party reach
    // above their level and live with the result.
    const r = resolveEnchant({ total: 18, dc: 21, pick: firstFlaw });
    expect(r.success).toBe(true);
    expect(r.destroyed).toBe(false);
    expect(r.flawCount).toBe(1);
  });

  it("matches the flaw bands the panel has always printed", () => {
    const at = margin => resolveEnchant({ total: 20 + margin, dc: 20, pick: firstFlaw });
    expect(at(0).flawCount).toBe(0);
    expect(at(-1).flawCount).toBe(1);
    expect(at(-4).flawCount).toBe(1);
    expect(at(-5).flawCount).toBe(2);
    expect(at(-8).flawCount).toBe(2);
    expect(at(-9).flawCount).toBe(3);
    expect(at(-12).flawCount).toBe(3);
    expect(at(-13).destroyed).toBe(true);
  });

  it("never picks the same flaw twice", () => {
    const r = resolveEnchant({ total: 8, dc: 20, pick: firstFlaw });
    expect(r.flawCount).toBe(3);
    expect(new Set(r.flaws).size).toBe(3);
  });

  it("a natural 1 ruins the work without destroying the remnant's worth", () => {
    // Losing a Deific remnant to one die roll is not a risk anyone would
    // take, so a fumble is three flaws rather than dust.
    const r = resolveEnchant({ total: 40, dc: 12, natural: 1, pick: firstFlaw });
    expect(r.destroyed).toBe(false);
    expect(r.flawCount).toBe(3);
  });

  it("consumes the materials however it went", () => {
    // The power left them the moment the binding began.
    for (const total of [30, 20, 5]) {
      expect(resolveEnchant({ total, dc: 20, pick: firstFlaw }).consumesMaterials).toBe(true);
    }
  });

  it("carries a label worth reading in chat", () => {
    expect(resolveEnchant({ total: 20, dc: 20, pick: firstFlaw }).label).toMatch(/cleanly/i);
    expect(resolveEnchant({ total: 19, dc: 20, pick: firstFlaw }).label).toMatch(/1 flaw$/);
    expect(resolveEnchant({ total: 12, dc: 20, pick: firstFlaw }).label).toMatch(/2 flaws$/);
    expect(resolveEnchant({ total: 0, dc: 20, pick: firstFlaw }).label).toMatch(/destroyed/i);
  });

  it("survives being called with nothing", () => {
    expect(() => resolveEnchant()).not.toThrow();
  });
});
