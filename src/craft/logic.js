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
import { MODULE_ID, lowestComponentDC } from "../harvest/logic.js";
import {
  COMPONENT_PROPERTIES,
  POTENCY_BY_DC,
  ESSENCE_POTENCY_BY_DC,
  RARITY_POTENCY,
  POTION_PROPERTY,
  CONSUMABLE_REAGENT,
  CATEGORY_REAGENT,
  ITEM_REAGENT,
  MATERIAL_POTENCY,
  UNPRICED_POTENCY
} from "../data/reagents.js";

/* ---------------------------------------------
   THIRD-PARTY RECIPES

   The module ships SRD-safe names and mechanics only. Grim Hollow, Ryoko's,
   Heliana's and the rest are commercial books — their item text cannot ride
   along in a publicly listed package. So they load at runtime from a
   compendium the table populates itself, from books it owns.

   The registry lives here, in the pure layer, so it is testable without a
   world. src/craft/extras.js does the Foundry-side reading and calls
   registerExtraRecipes().
--------------------------------------------- */

/** @type {Recipe[]} */
let EXTRA_RECIPES = [];

/**
 * Add recipes loaded from the world. Later calls replace earlier ones for the
 * same name, so a world can override a shipped recipe rather than duplicate
 * it — a table using Grim Hollow's armour rules wants *its* Plate, not two.
 *
 * @param {object[]} recipes
 * @param {string}   [source] Where they came from, shown in the UI
 * @returns {number} how many were accepted
 */
export function registerExtraRecipes(recipes = [], source = "world") {
  const accepted = (recipes ?? []).filter(r => r?.name && r?.category)
    .map(r => ({ srd: false, source, ...r }));
  const names = new Set(accepted.map(r => r.name.toLowerCase()));
  EXTRA_RECIPES = EXTRA_RECIPES
    .filter(r => !names.has(r.name.toLowerCase()))
    .concat(accepted);
  return accepted.length;
}

/** Everything loaded from the world, in load order. */
export function getExtraRecipes() {
  return EXTRA_RECIPES.slice();
}

/** Drop every world-loaded recipe. Used on reload and by tests. */
export function clearExtraRecipes() {
  EXTRA_RECIPES = [];
}

/**
 * Shipped recipes plus world-loaded ones, with world entries winning on a
 * name collision.
 */
export function allRecipes() {
  const overridden = new Set(EXTRA_RECIPES.map(r => r.name.toLowerCase()));
  return MANUFACTURING_TABLE
    .filter(r => !overridden.has(r.name.toLowerCase()))
    .concat(EXTRA_RECIPES);
}

/* ---------------------------------------------
   MANUFACTURING
--------------------------------------------- */

/** Case-insensitive recipe lookup by item name. */
export function getRecipe(name) {
  if (!name) return null;
  const key = String(name).toLowerCase();
  return allRecipes().find(r => r.name.toLowerCase() === key) ?? null;
}

/**
 * Recipes grouped for display, in MANUFACTURING_CATEGORIES order.
 * A world-loaded recipe may invent its own category; those follow the known
 * ones rather than being dropped or silently folded into "Gear".
 */
export function getRecipesByCategory() {
  const recipes = allRecipes();
  const extraCategories = [...new Set(recipes.map(r => r.category))]
    .filter(c => !MANUFACTURING_CATEGORIES.includes(c));

  return [...MANUFACTURING_CATEGORIES, ...extraCategories]
    .map(category => ({
      category,
      recipes: recipes.filter(r => r.category === category)
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
export function planManufacture(recipe, crafter = {}, parts = []) {
  if (!recipe) return null;

  const { abilities = {}, tools = [], proficiency = 2 } = crafter;
  const usableTools = recipe.tools.filter(t => tools.includes(t));
  const proficient = usableTools.length > 0;

  const ability = bestAbility(abilitiesForRecipe(recipe), abilities) ?? { key: null, mod: 0 };
  const bonus = ability.mod + (proficient ? proficiency : 0);

  // Potions and consumables need monster parts on the bench. A fitting
  // creature discounts the DC; a missing reagent blocks the attempt outright,
  // since there is nothing to brew from.
  const reagents = checkReagents(recipe, parts);

  return {
    item: recipe.name,
    dc: recipe.dc + reagents.dcAdjust,
    baseDc: recipe.dc,
    hours: recipe.hours,
    tools: recipe.tools,
    tool: usableTools[0] ?? recipe.tools[0] ?? null,
    ability: ability.key,
    abilityMod: ability.mod,
    proficient,
    disadvantage: !proficient,
    bonus,
    materialGp: materialYardstick(recipe),
    reagents,
    blocked: reagents.required && !reagents.met
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
   REAGENTS — the Harvest ➜ Craft join

   A potion or consumable needs monster parts, not just tools and time. See
   src/data/reagents.js for the model; this is the arithmetic.
--------------------------------------------- */

/** Properties a harvested component carries. Unknown parts carry none. */
export function componentProperties(name) {
  if (!name) return [];
  const key = Object.keys(COMPONENT_PROPERTIES)
    .find(k => k.toLowerCase() === String(name).toLowerCase());
  return key ? COMPONENT_PROPERTIES[key].slice() : [];
}

/**
 * How much a single harvested part is worth to a brew.
 *
 * @param {object} part { name, dc, essence?, quantity? }
 *   `dc` is the component's harvest DC, stamped on the item when it was cut
 *   free. Essences use their own, heavier scale.
 */
export function componentPotency(part) {
  if (!part) return 0;
  const table = part.essence ? ESSENCE_POTENCY_BY_DC : POTENCY_BY_DC;
  // A part handed over without a DC is valued at the least that component
  // could be worth — the same conservative rule partFromItem applies, kept
  // here too so a caller cannot bypass it by skipping that step.
  const dc = Number(part.dc) || lowestComponentDC(part.name);
  const each = table[dc] ?? 0;
  return each * Math.max(1, Number(part.quantity) || 1);
}

/**
 * Potency a build's worth of material comes to.
 *
 * Read off the material yardstick rather than invented: the table already
 * grades how much stuff each item takes, and a ladder keeps a breastplate
 * from demanding a hundred hearts the way a linear gp conversion would.
 */
export function materialPotency(recipe) {
  const gp = materialYardstick(recipe);
  if (gp === null) return UNPRICED_POTENCY;
  return MATERIAL_POTENCY.find(tier => gp <= tier.maxGp)?.potency ?? UNPRICED_POTENCY;
}

/**
 * What a recipe demands in monster parts.
 *
 * Everything in the catalogue demands something — that is the house rule
 * that replaced gold with monster parts. Potions want a specific kind of
 * part; gear accepts *any of* several, because a blade can be talon or bone
 * or chitin and picking one would be wrong most of the time.
 *
 * @returns {{properties: string[], potency: number, theme: string[]}|null}
 */
export function reagentRequirement(recipe) {
  if (!recipe?.name) return null;

  const consumable = CONSUMABLE_REAGENT[recipe.name];
  if (consumable) {
    return {
      properties: [consumable.property],
      potency: consumable.potency,
      theme: consumable.theme ?? []
    };
  }

  const potion = POTION_PROPERTY[recipe.name];
  if (potion) {
    return {
      properties: [potion.property],
      potency: RARITY_POTENCY[recipe.rarity] ?? RARITY_POTENCY.common,
      theme: potion.theme ?? []
    };
  }

  // Gear: an item override if there is one, else the category default.
  const properties = ITEM_REAGENT[recipe.name] ?? CATEGORY_REAGENT[recipe.category];
  if (properties?.length) {
    return { properties: properties.slice(), potency: materialPotency(recipe), theme: [] };
  }

  // A world-loaded recipe in an invented category. Rather than block a build
  // on a category this module has never heard of, let it through.
  return null;
}

/**
 * Weigh a pile of harvested parts against what a recipe wants.
 *
 * Only parts carrying the required property count toward the budget —
 * everything else is set aside rather than silently ignored, so a player can
 * see *why* their heap of bones won't brew a healing potion.
 *
 * A part from a thematically apt creature is not required and does not count
 * for more; it discounts the DC. Flavour should reward, not gate.
 *
 * @param {object}   recipe
 * @param {object[]} parts  [{ name, dc, creatureType?, essence?, quantity? }]
 */
export function checkReagents(recipe, parts = []) {
  const need = reagentRequirement(recipe);
  if (!need) {
    return {
      required: false, met: true, potency: 0, needed: 0,
      properties: [], used: [], rejected: [], theme: [], themed: false, dcAdjust: 0, shortfall: 0
    };
  }

  const used = [];
  const rejected = [];
  for (const part of parts ?? []) {
    const props = componentProperties(part?.name);
    const potency = componentPotency(part);
    // Any one of the accepted properties will do; a chitin plate satisfies
    // armour whether the recipe calls it structural or fibrous.
    const matches = props.some(p => need.properties.includes(p));
    if (matches && potency > 0) used.push({ ...part, potency });
    else rejected.push({ ...part, potency, reason: potency > 0 ? "wrong property" : "not a harvested component" });
  }

  const potency = used.reduce((sum, p) => sum + p.potency, 0);
  const themed = need.theme.length > 0
    && used.some(p => need.theme.includes(String(p.creatureType ?? "").toLowerCase()));

  return {
    required: true,
    properties: need.properties,
    needed: need.potency,
    potency,
    met: potency >= need.potency,
    shortfall: Math.max(0, need.potency - potency),
    used,
    rejected,
    theme: need.theme,
    themed,
    // A fitting creature makes the work go easier, worth two points of DC.
    dcAdjust: themed ? -2 : 0
  };
}

/**
 * Read a carried item back into a weighable part.
 *
 * Harvest stamps origin on everything it grants. Parts that predate that —
 * or were handed out by a GM — fall back to the component's lowest DC
 * anywhere in the harvest table, so an unlabelled heart is treated as a
 * goblin's rather than a dragon's. Generous defaults here would let a player
 * launder scraps into legendary reagents.
 *
 * @param {object} item A dnd5e item, or anything with name/flags/system
 */
export function partFromItem(item) {
  if (!item?.name) return null;
  const origin = item.flags?.[MODULE_ID]?.origin ?? {};
  const dc = Number(origin.dc) || lowestComponentDC(item.name);
  if (!dc) return null;

  return {
    name: item.name,
    dc,
    creatureType: origin.creatureType ?? null,
    cr: origin.cr ?? null,
    essence: Boolean(origin.essence),
    quantity: Number(item.system?.quantity) || 1,
    stamped: Boolean(origin.dc),
    id: item.id ?? item._id ?? null
  };
}

/** Everything in an actor's inventory that crafting could use as a reagent. */
export function partsFromActor(actor) {
  const items = actor?.items?.contents ?? actor?.items ?? [];
  return [...items].map(partFromItem).filter(Boolean);
}

/**
 * Every component in the harvest table that would satisfy a requirement.
 * Feeds the "what should I be hunting?" hint in the panel.
 *
 * @param {string|string[]} properties One property, or any-of several
 */
export function componentsWithProperty(properties) {
  const wanted = Array.isArray(properties) ? properties : [properties];
  return Object.entries(COMPONENT_PROPERTIES)
    .filter(([, props]) => props.some(p => wanted.includes(p)))
    .map(([name]) => name);
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
