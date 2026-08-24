// =========================================================
// Runes & Remnants — Crafting Logic
//
// Pure functions, no Foundry globals at module scope, so everything here is
// unit-testable. Two separate systems live side by side:
//
//   MANUFACTURING — mundane gear. Tool + ability + time + a flat DC.
//   ALCHEMY       — potions and poisons. DC is built from the ingredients.
//
// Enchanting (turning a mundane item magical) is Phase 5 and is not here.
// =========================================================

import { MANUFACTURING_TABLE, MANUFACTURING_CATEGORIES, TOOL_ABILITY } from "../data/manufacturing.js";
import {
  ALCHEMY_INGREDIENTS,
  ALCHEMY_TOOLS,
  ENCHANTMENT_BASE,
  MAX_MODIFIERS
} from "../data/alchemy.js";

/* ---------------------------------------------
   MANUFACTURING
--------------------------------------------- */

/** Case-insensitive recipe lookup by item name. */
export function getRecipe(name) {
  if (!name) return null;
  const key = String(name).toLowerCase();
  return MANUFACTURING_TABLE.find(r => r.name.toLowerCase() === key) ?? null;
}

/** Recipes grouped for display, in MANUFACTURING_CATEGORIES order. */
export function getRecipesByCategory() {
  return MANUFACTURING_CATEGORIES
    .map(category => ({
      category,
      recipes: MANUFACTURING_TABLE.filter(r => r.category === category)
    }))
    .filter(group => group.recipes.length > 0);
}

/**
 * Every ability that could make this item, across all of its tools.
 * Carpenter's tools take Dex *or* Str, so a recipe often has a choice.
 */
export function abilitiesForRecipe(recipe) {
  if (!recipe?.tools) return [];
  const abilities = new Set();
  for (const tool of recipe.tools) {
    for (const ability of TOOL_ABILITY[tool] ?? []) abilities.add(ability);
  }
  return [...abilities];
}

/**
 * Picks the ability a crafter should actually roll — the best of those the
 * recipe allows.
 *
 * @param {string[]} abilities  candidates, e.g. ["con", "str"]
 * @param {Record<string, number>} mods  ability modifiers by key
 */
export function bestAbility(abilities = [], mods = {}) {
  let best = null;
  for (const key of abilities) {
    const mod = Number(mods[key] ?? 0);
    if (!best || mod > best.mod) best = { key, mod };
  }
  return best;
}

/**
 * What a manufacturing attempt looks like for a given crafter.
 *
 * Tool proficiency is NOT required — an unproficient crafter simply rolls at
 * disadvantage, which is what `disadvantage` reports. Proficiency adds the
 * bonus instead.
 *
 * @param {object} recipe
 * @param {object} crafter  { abilities: {str,dex,...}, tools: string[], proficiency: number }
 */
export function planManufacture(recipe, crafter = {}) {
  if (!recipe) return null;

  const { abilities = {}, tools = [], proficiency = 2 } = crafter;
  const usableTools = recipe.tools.filter(t => tools.includes(t));
  const proficient = usableTools.length > 0;

  const ability = bestAbility(abilitiesForRecipe(recipe), abilities) ?? { key: null, mod: 0 };
  const bonus = ability.mod + (proficient ? proficiency : 0);

  return {
    item: recipe.name,
    dc: recipe.dc,
    hours: recipe.hours,
    tools: recipe.tools,
    tool: usableTools[0] ?? recipe.tools[0] ?? null,
    ability: ability.key,
    abilityMod: ability.mod,
    proficient,
    disadvantage: !proficient,
    bonus,
    materialGp: materialYardstick(recipe)
  };
}

/**
 * How much material the build should take, in gp.
 *
 * The table gives an explicit figure for most items; where it does not, the
 * book's rule of thumb is one third of the finished value.
 *
 * In this campaign the gp figure is a *yardstick*, not a price — the GM
 * swaps in the monster parts the build actually needs. See the house-rule
 * note in src/data/manufacturing.js.
 */
export function materialYardstick(recipe) {
  if (!recipe) return null;
  if (recipe.materialGp !== null && recipe.materialGp !== undefined) return recipe.materialGp;
  if (recipe.valueGp) return Math.round((recipe.valueGp / 3) * 100) / 100;
  return null;
}

/* ---------------------------------------------
   ALCHEMY
--------------------------------------------- */

/** Case-insensitive ingredient lookup. */
export function getIngredient(name) {
  if (!name) return null;
  const key = String(name).toLowerCase();
  return ALCHEMY_INGREDIENTS.find(i => i.name.toLowerCase() === key) ?? null;
}

/** Ingredients filtered by the role they play. */
export function ingredientsByRole(role) {
  return ALCHEMY_INGREDIENTS.filter(i => i.role === role);
}

const EFFECT_ROLES = ["potion-effect", "toxin-effect"];
const MODIFIER_ROLES = ["potion-modifier", "toxin-modifier", "both-modifier"];

/**
 * Alchemy Attempt DC = 10 + every ingredient's DC modifier.
 *
 * Lavender Sprig is the only negative, so a careful alchemist can steady a
 * volatile mix rather than simply piling on power.
 */
export function computeAlchemyDC(names = []) {
  return names.reduce((dc, name) => {
    const ing = getIngredient(name);
    return dc + (ing ? Number(ing.dc) || 0 : 0);
  }, 10);
}

/**
 * Works out what a set of ingredients actually makes, and whether the
 * combination is legal.
 *
 * @returns {{ kind, valid, errors, dc, effects, modifiers, unknown, tools, locked }}
 */
export function analyseConcoction(names = []) {
  const unknown = names.filter(n => !getIngredient(n));
  const found = names.map(getIngredient).filter(Boolean);

  const base       = found.filter(i => i.role === "enchantment-base");
  const enchants   = found.filter(i => i.role === "enchantment");
  const effects    = found.filter(i => EFFECT_ROLES.includes(i.role));
  const modifiers  = found.filter(i => MODIFIER_ROLES.includes(i.role));

  const errors = [];
  for (const name of unknown) errors.push(`"${name}" is not a known ingredient.`);

  // --- Enchantments are their own path entirely ---
  if (enchants.length || base.length) {
    if (!base.length) errors.push(`Enchantments need ${ENCHANTMENT_BASE} as their base.`);
    if (!enchants.length) errors.push(`${ENCHANTMENT_BASE} needs an enchantment ingredient to carry.`);
    if (enchants.length > 1) errors.push("Only one enchantment ingredient per brew.");
    if (modifiers.length || effects.length) {
      errors.push("Enchantments cannot take modifiers — the magic is too volatile.");
    }
    return {
      kind: "enchantment",
      valid: errors.length === 0,
      errors,
      dc: computeAlchemyDC(names),
      effects: enchants,
      modifiers: [],
      unknown,
      tools: ALCHEMY_TOOLS.enchantment,
      locked: true
    };
  }

  // --- Potion or poison ---
  if (!effects.length) {
    errors.push("A concoction needs one effect ingredient as its base.");
  }

  // Bloodgrass is the documented exception: it rides along with another
  // potion effect rather than replacing it.
  const stackable = effects.filter(i => i.name === "Bloodgrass");
  const primary   = effects.filter(i => i.name !== "Bloodgrass");
  if (primary.length > 1) {
    errors.push("Only one effect ingredient per concoction.");
  }

  const kind = primary.some(i => i.role === "toxin-effect") ? "poison"
             : effects.length ? "potion"
             : "unknown";

  if (kind === "poison" && stackable.length) {
    errors.push("Bloodgrass only combines with a potion effect.");
  }

  if (modifiers.length > MAX_MODIFIERS) {
    errors.push(`At most ${MAX_MODIFIERS} modifiers — this has ${modifiers.length}.`);
  }

  // A modifier has to suit what it is being mixed into.
  const wanted = kind === "poison" ? "toxin-modifier" : "potion-modifier";
  for (const mod of modifiers) {
    if (mod.role !== wanted && mod.role !== "both-modifier") {
      errors.push(`${mod.name} cannot be used in a ${kind}.`);
    }
  }

  // Some effects are simply not open to alteration.
  const lockedEffect = [...primary, ...stackable].find(i => i.locked);
  if (lockedEffect && modifiers.length) {
    errors.push(`${lockedEffect.name} cannot be altered by other ingredients.`);
  }
  const lockedMod = modifiers.find(i => i.locked);
  if (lockedMod && modifiers.length > 1) {
    errors.push(`${lockedMod.name} cannot be combined with other modifiers.`);
  }

  return {
    kind,
    valid: errors.length === 0,
    errors,
    dc: computeAlchemyDC(names),
    effects,
    modifiers,
    unknown,
    tools: kind === "poison" ? ALCHEMY_TOOLS.poison : ALCHEMY_TOOLS.potion,
    locked: Boolean(lockedEffect)
  };
}

/**
 * The save DC a finished poison imposes on its victim.
 * Note this is the *poison's* DC, not the DC to brew it.
 */
export function poisonSaveDC(alchemyModifier = 0) {
  return 8 + Number(alchemyModifier || 0);
}

/**
 * Alchemy modifier = the better of INT or WIS, plus proficiency with a
 * relevant tool. Herbalism uses the same shape.
 */
export function alchemyModifier({ int = 0, wis = 0, proficient = false, proficiency = 2 } = {}) {
  return Math.max(Number(int) || 0, Number(wis) || 0) + (proficient ? proficiency : 0);
}
