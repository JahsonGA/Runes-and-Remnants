// =========================================================
// Runes & Remnants — Ancestral weapon progression
//
// Pure. Reads a weapon's spirit state off its flags, works out what it can
// afford, and returns the flag patch to apply — but never touches Foundry
// itself, so every rule here is testable without a world.
// =========================================================

import {
  SPIRIT_ABILITIES, SPIRIT_TIERS, SPIRIT_AWAKEN, SPIRIT_FINAL, SPIRIT_TOTAL,
  REMNANT_SPIRIT_VALUE
} from "../data/spirit.js";
import { remnantTier, itemKind } from "./logic.js";

export const MODULE_ID = "runes-and-remnants";

/* ---------------------------------------------
   The ability list, and overriding it
--------------------------------------------- */

let EXTRA_ABILITIES = [];

/**
 * Replace or extend the shipped ladder with a table's own.
 *
 * The costs this module ships are its own scale, not a book's. A table that
 * owns Ancestral Weapons puts the real ones in here — same seam third-party
 * recipes use, and for the same licensing reason.
 */
export function registerSpiritAbilities(abilities = [], { replace = false } = {}) {
  const clean = (abilities ?? []).filter(a => a?.name && a?.tier);
  EXTRA_ABILITIES = replace ? clean : EXTRA_ABILITIES.concat(clean);
  return EXTRA_ABILITIES.length;
}

export function clearSpiritAbilities() {
  EXTRA_ABILITIES = [];
}

/** Shipped abilities plus any registered, with registered winning by name. */
export function allAbilities() {
  const overridden = new Set(EXTRA_ABILITIES.map(a => a.name.toLowerCase()));
  return SPIRIT_ABILITIES
    .filter(a => !overridden.has(a.name.toLowerCase()))
    .concat(EXTRA_ABILITIES);
}

export function getAbility(name) {
  if (!name) return null;
  const key = String(name).toLowerCase();
  return allAbilities().find(a => a.name.toLowerCase() === key) ?? null;
}

/** What an ability costs. An explicit cost wins over its tier's. */
export function abilityCost(ability) {
  const spec = typeof ability === "string" ? getAbility(ability) : ability;
  if (!spec) return 0;
  if (Number.isFinite(spec.cost)) return spec.cost;
  return SPIRIT_TIERS[spec.tier]?.cost ?? 0;
}

/* ---------------------------------------------
   A weapon's state
--------------------------------------------- */

/**
 * Read the spirit state off an item.
 *
 * Everything lives under the module's own flag namespace so it survives
 * export, import and a system update.
 */
export function spiritState(item) {
  const flags = item?.flags?.[MODULE_ID]?.spirit ?? {};
  const unlocked = Array.isArray(flags.unlocked) ? flags.unlocked.slice() : [];
  const earned = Math.max(0, Number(flags.earned) || 0);
  const spent = unlocked.reduce((sum, name) => sum + abilityCost(name), 0);

  return {
    isAncestral: Boolean(flags.ancestral),
    earned,
    spent,
    available: Math.max(0, earned - spent),
    unlocked,
    // Awakening is a threshold on what has been EARNED, not what is left —
    // a weapon that has been carried through twenty points of deeds has
    // woken whether or not its wielder spent them.
    awakened: earned >= SPIRIT_AWAKEN,
    // The one-way door. Spending a remnant for points forecloses enchanting.
    remnantSpent: Boolean(flags.remnantSpent),
    finished: earned >= SPIRIT_TOTAL && spent >= SPIRIT_TOTAL,
    toAwaken: Math.max(0, SPIRIT_AWAKEN - earned),
    toFinish: Math.max(0, SPIRIT_TOTAL - earned)
  };
}

/**
 * Can this weapon take this ability?
 *
 * Every reason it cannot, not the first — a player choosing what to aim for
 * needs to see the whole gate, not discover it one refusal at a time.
 */
export function canUnlock(ability, item) {
  const spec = typeof ability === "string" ? getAbility(ability) : ability;
  const state = spiritState(item);
  const reasons = [];

  if (!spec) return { ok: false, reasons: ["No such ability."], cost: 0 };

  const cost = abilityCost(spec);
  const kind = itemKind(item);

  if (state.unlocked.some(n => n.toLowerCase() === spec.name.toLowerCase())) {
    reasons.push(`${spec.name} is already awakened in this weapon.`);
  }
  if (kind && spec.kinds && !spec.kinds.includes(kind)) {
    reasons.push(`${spec.name} cannot take hold in ${kind === "armour" ? "armour" : `a ${kind}`}.`);
  }
  if (cost > state.available) {
    reasons.push(`Needs ${cost} spirit ${cost === 1 ? "point" : "points"}; ${state.available} available.`);
  }
  if (spec.requires && !state.unlocked.some(n => n.toLowerCase() === spec.requires.toLowerCase())) {
    reasons.push(`${spec.requires} must come first.`);
  }
  if (SPIRIT_TIERS[spec.tier]?.requiresAwakened && !state.awakened) {
    reasons.push(`The weapon must awaken first — ${state.toAwaken} more points.`);
  }
  if (state.spent + cost > SPIRIT_TOTAL) {
    reasons.push(`A weapon holds ${SPIRIT_TOTAL} points in all; this would be ${state.spent + cost}.`);
  }

  return { ok: reasons.length === 0, reasons, cost, state };
}

/**
 * The flag patch that unlocks an ability.
 * Returns null when it cannot, so a caller cannot apply a refused change.
 */
export function unlockPatch(ability, item) {
  const check = canUnlock(ability, item);
  if (!check.ok) return null;

  const spec = typeof ability === "string" ? getAbility(ability) : ability;
  const state = spiritState(item);

  return {
    [`flags.${MODULE_ID}.spirit`]: {
      ancestral: true,
      earned: state.earned,
      unlocked: [...state.unlocked, spec.name],
      remnantSpent: state.remnantSpent
    }
  };
}

/* ---------------------------------------------
   Earning
--------------------------------------------- */

/**
 * Award points for a deed. GM-side; nothing in the module hands these out on
 * its own, because a spirit point you can farm is just another material.
 */
export function earnPatch(item, points = 1) {
  const state = spiritState(item);
  const n = Math.max(0, Math.round(Number(points) || 0));
  // A weapon cannot be carried past what it can hold.
  const earned = Math.min(SPIRIT_TOTAL, state.earned + n);

  return {
    [`flags.${MODULE_ID}.spirit`]: {
      ancestral: true,
      earned,
      unlocked: state.unlocked,
      remnantSpent: state.remnantSpent
    }
  };
}

/** What a remnant is worth if spent in place of a deed. */
export function remnantValue(name) {
  const tier = remnantTier(name);
  return tier.remnant ? (REMNANT_SPIRIT_VALUE[tier.remnant] ?? 0) : 0;
}

/**
 * Spend a remnant for points.
 *
 * This is a one-way door: afterwards the weapon can never be enchanted
 * again. Returned as part of the patch rather than left to a caller to
 * remember, because forgetting it silently would be the worst kind of bug —
 * the player would only find out much later, with no way back.
 */
export function spendRemnantPatch(item, remnantName) {
  const value = remnantValue(remnantName);
  if (!value) return null;

  const state = spiritState(item);
  return {
    [`flags.${MODULE_ID}.spirit`]: {
      ancestral: true,
      earned: Math.min(SPIRIT_TOTAL, state.earned + value),
      unlocked: state.unlocked,
      remnantSpent: true
    }
  };
}

/** Whether this weapon may still be enchanted. */
export function canStillEnchant(item) {
  return !spiritState(item).remnantSpent;
}

/* ---------------------------------------------
   For the panel
--------------------------------------------- */

/** The ladder grouped by tier, each entry carrying its cost and its gate. */
export function abilityLadder(item) {
  const byTier = new Map();

  for (const ability of allAbilities()) {
    const check = canUnlock(ability, item);
    const tier = SPIRIT_TIERS[ability.tier] ?? { cost: 0, label: ability.tier };
    if (!byTier.has(ability.tier)) {
      byTier.set(ability.tier, {
        tier: ability.tier,
        label: tier.label,
        cost: tier.cost,
        requiresAwakened: Boolean(tier.requiresAwakened),
        items: []
      });
    }
    byTier.get(ability.tier).items.push({
      name: ability.name,
      effect: ability.effect,
      requires: ability.requires ?? null,
      cost: check.cost,
      unlocked: spiritState(item).unlocked
        .some(n => n.toLowerCase() === ability.name.toLowerCase()),
      available: check.ok,
      reason: check.reasons[0] ?? null
    });
  }

  const order = Object.keys(SPIRIT_TIERS);
  return [...byTier.values()]
    .sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier));
}

export { SPIRIT_AWAKEN, SPIRIT_FINAL, SPIRIT_TOTAL };
