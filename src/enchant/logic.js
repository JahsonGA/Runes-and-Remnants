// =========================================================
// Runes & Remnants — Enchanting logic
//
// Pure functions, no Foundry globals at module scope, so every rule here is
// testable without a world. The Foundry side lives in execute.js.
// =========================================================

import {
  REMNANT_TIERS,
  RARITY_ORDER,
  ENCHANTMENTS,
  FLAW_BANDS,
  FLAWS,
  ATTUNEMENT_MULTIPLIER,
  CONSUMABLE_TIME_DIVISOR,
  ITEM_KINDS
} from "../data/enchanting.js";
import { componentProperties } from "../craft/logic.js";
import { HARVEST_SKILL_BY_TYPE } from "../harvest/logic.js";

/* ---------------------------------------------
   Rarity
--------------------------------------------- */

/**
 * Normalise the several spellings of a rarity in play.
 *
 * The essence table says "veryRare", the manufacturing table says
 * "very rare", and dnd5e itself uses "veryRare". Comparing them raw silently
 * treats a very rare remnant as unknown, which would quietly downgrade an
 * item the party worked hard for.
 */
export function normaliseRarity(rarity) {
  if (!rarity) return null;
  const key = String(rarity).trim().toLowerCase().replace(/[\s_-]+/g, "");
  const found = RARITY_ORDER.find(r => r.replace(/\s+/g, "") === key);
  return found ?? null;
}

/** Where a rarity sits on the ladder, or -1 if it is not on it. */
export function rarityRank(rarity) {
  return RARITY_ORDER.indexOf(normaliseRarity(rarity));
}

/* ---------------------------------------------
   Remnants
--------------------------------------------- */

/**
 * The tier a remnant belongs to.
 *
 * Accepts the essence item's name as harvest grants it — "Remnant (Potent)" —
 * or the bare tier word, so a GM handing one out by hand still works.
 */
export function remnantTier(name) {
  if (!name) return REMNANT_TIERS[0];
  const text = String(name).toLowerCase();
  return REMNANT_TIERS.find(t => t.remnant && text.includes(t.remnant.toLowerCase()))
      ?? REMNANT_TIERS[0];
}

/** Every remnant in a pile of carried parts, strongest last. */
export function remnantsFrom(parts = []) {
  return (parts ?? [])
    .filter(p => p?.name && remnantTier(p.name).remnant)
    .map(p => ({ ...p, tier: remnantTier(p.name) }))
    .sort((a, b) => rarityRank(a.tier.rarity) - rarityRank(b.tier.rarity));
}

/* ---------------------------------------------
   Enchantments
--------------------------------------------- */

export function getEnchantment(name) {
  if (!name) return null;
  const key = String(name).toLowerCase();
  return ENCHANTMENTS.find(e => e.name.toLowerCase() === key) ?? null;
}

/** What kind of thing this is, for deciding which enchantments can take. */
export function itemKind(item) {
  if (!item) return null;
  const type = String(item.type ?? "").toLowerCase();
  if (type === "weapon") return "weapon";
  // dnd5e files armour under `equipment` with an armour subtype.
  const armourType = item.system?.armor?.type ?? item.system?.type?.value;
  if (type === "equipment" && armourType && armourType !== "trinket") return "armour";
  if (type === "equipment") return "wondrous";
  return ITEM_KINDS.includes(type) ? type : "wondrous";
}

/** Enchantments a given kind of item can take, grouped for the UI. */
export function enchantmentsFor(kind) {
  if (!kind) return ENCHANTMENTS.slice();
  return ENCHANTMENTS.filter(e => e.kinds.includes(kind));
}

/** Components in a pile that would satisfy an enchantment's property. */
export function componentsFor(enchantment, parts = []) {
  const spec = typeof enchantment === "string" ? getEnchantment(enchantment) : enchantment;
  if (!spec) return [];
  return (parts ?? []).filter(p =>
    !remnantTier(p?.name).remnant &&                       // a remnant is not a component
    componentProperties(p?.name).includes(spec.property));
}

/* ---------------------------------------------
   The plan
--------------------------------------------- */

/**
 * Work out the whole attempt: rarity, DC, hours, the check, and everything
 * still missing.
 *
 * Every blocker is collected rather than returning on the first, so the panel
 * can show all of them at once instead of revealing them one reload at a time.
 *
 * @param {object} args
 * @param {object} args.enchantment  the chosen enchantment, or its name
 * @param {object} [args.item]       what is being enchanted
 * @param {object} [args.remnant]    { name, creatureType }
 * @param {object} [args.component]  { name }
 * @param {object} [args.caster]     { ability, abilityMod, skills, proficiency, isCaster }
 * @param {boolean} [args.attunement]
 * @param {boolean} [args.consumable]
 */
export function enchantPlan({
  enchantment, item = null, remnant = null, component = null,
  caster = null, attunement = false, consumable = false
} = {}) {
  const spec = typeof enchantment === "string" ? getEnchantment(enchantment) : enchantment;
  const blockers = [];

  if (!spec) return { valid: false, blockers: ["Choose an enchantment."] };
  if (!item) blockers.push("Choose a mundane item to enchant — you cannot enchant what does not exist.");

  const kind = itemKind(item);
  if (item && !spec.kinds.includes(kind)) {
    blockers.push(`${spec.name} cannot be worked into ${kind === "armour" ? "armour" : `a ${kind}`}.`);
  }

  if (!component) blockers.push(`Needs a ${spec.property} component — that is what decides the effect.`);
  else if (!componentProperties(component.name).includes(spec.property)) {
    blockers.push(`${component.name} is not a ${spec.property} component.`);
  }

  // The remnant decides rarity: the recipe's floor, or the remnant's own tier
  // if it is stronger. A weaker one cannot carry the enchantment at all.
  const tier = remnant ? remnantTier(remnant.name) : REMNANT_TIERS[0];
  const askedRank = rarityRank(spec.rarity);
  const heldRank = rarityRank(tier.rarity);

  if (heldRank < askedRank) {
    blockers.push(
      `${spec.name} needs at least a ${REMNANT_TIERS[askedRank].remnant ?? "common"} remnant; `
      + `${tier.remnant ?? "no remnant"} is too weak to hold it.`
    );
  }

  const finalTier = REMNANT_TIERS[Math.max(askedRank, heldRank)] ?? REMNANT_TIERS[askedRank];

  // "Only a spellcaster can do it" — the panel has said so from the start.
  if (caster && !caster.isCaster) blockers.push("Only a spellcaster can bind a remnant.");

  const skill = HARVEST_SKILL_BY_TYPE[String(remnant?.creatureType ?? "").toLowerCase()] ?? "Survival";
  const bonus = caster
    ? (caster.abilityMod ?? 0) + (caster.skills?.includes(skill) ? (caster.proficiency ?? 2) : 0)
    : 0;

  let hours = finalTier.hours;
  if (attunement) hours *= ATTUNEMENT_MULTIPLIER;
  if (consumable) hours = Math.max(1, Math.round(hours / CONSUMABLE_TIME_DIVISOR));

  return {
    valid: blockers.length === 0,
    blockers,
    enchantment: spec.name,
    effect: spec.effect,
    property: spec.property,
    kind,
    item: item?.name ?? null,
    rarity: finalTier.rarity,
    // True when a stronger remnant pushed the item past what the recipe asked.
    upgraded: heldRank > askedRank,
    askedRarity: spec.rarity,
    dc: finalTier.dc,
    hours,
    attunement,
    consumable,
    remnant: remnant?.name ?? null,
    remnantTier: tier.remnant,
    component: component?.name ?? null,
    creatureType: remnant?.creatureType ?? null,
    // The caster's ability, the corpse's skill.
    ability: caster?.ability ?? null,
    skill,
    proficient: Boolean(caster?.skills?.includes(skill)),
    bonus
  };
}

/* ---------------------------------------------
   The outcome
--------------------------------------------- */

/**
 * Read an enchanting check.
 *
 * Unlike crafting, a miss does not simply waste the attempt — the enchantment
 * takes hold badly, and the item comes out flawed in proportion to the miss.
 * The remnant and component are consumed either way, because the power left
 * them the moment the binding began.
 *
 * @param {object} args
 * @param {number} args.total
 * @param {number} args.dc
 * @param {number} [args.natural]
 * @param {Function} [args.pick]  chooser for flaws, injected so tests are not random
 */
export function resolveEnchant({ total = 0, dc = 12, natural = null, pick = null } = {}) {
  const margin = total - dc;

  // A natural 1 always spoils the work, but it ruins rather than destroys —
  // losing a Deific remnant to one die roll is not a risk anyone would take.
  const band = natural === 1
    ? FLAW_BANDS.find(b => b.flaws === 3)
    : FLAW_BANDS.find(b => margin <= b.maxMargin);

  const flawCount = band.destroyed ? 0 : band.flaws;
  const chooser = pick ?? (list => list[Math.floor(Math.random() * list.length)]);

  const flaws = [];
  const pool = [...FLAWS];
  for (let i = 0; i < flawCount && pool.length; i++) {
    const chosen = chooser(pool);
    flaws.push(chosen);
    pool.splice(pool.indexOf(chosen), 1);      // never the same flaw twice
  }

  return {
    margin,
    destroyed: band.destroyed,
    // "Clean" means no flaws. A flawed item is still an enchanted item.
    clean: !band.destroyed && flawCount === 0,
    success: !band.destroyed,
    flawCount,
    flaws,
    // Consumed however it went — the power left them when the binding began.
    consumesMaterials: true,
    label: band.destroyed ? "Destroyed"
         : flawCount === 0 ? "Bound cleanly"
         : `Bound, with ${flawCount} flaw${flawCount > 1 ? "s" : ""}`
  };
}
