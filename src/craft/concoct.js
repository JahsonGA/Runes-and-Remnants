// =========================================================
// Runes & Remnants — Composing a brew into a rollable effect
//
// Pure. Takes a base effect and the modifiers stacked on it and works out
// what the finished vial actually does: how many dice, what size, what
// damage type, how long, and every rider that changes play without changing
// a number.
//
// The point of the modifier system is that the combination does something
// none of the parts do alone. Until this existed the granted item described
// its ingredients and left the drinker to work it out.
// =========================================================

import { EFFECT_FORMULA, MODIFIER_TRANSFORM, DIE_LADDER } from "../data/alchemy-effects.js";

/** Next die up the ladder. Nothing in 5e steps past d12, so it stops there. */
export function stepDie(die, steps = 1) {
  const at = DIE_LADDER.indexOf(die);
  if (at === -1) return die;
  return DIE_LADDER[Math.min(at + steps, DIE_LADDER.length - 1)];
}

/** Whether stepping would have gone further, so the panel can say so. */
export function dieCapped(die, steps = 1) {
  const at = DIE_LADDER.indexOf(die);
  return at !== -1 && at + steps > DIE_LADDER.length - 1;
}

/**
 * How many times each modifier applies.
 *
 * Only two ingredients say they stack. Everything else applies once however
 * many times it is on the bench — otherwise a player could stack three
 * Spineflower Berries and step a d4 to a d12, which the rules do not allow.
 */
export function applyCounts(modifierNames = []) {
  const seen = new Map();
  for (const name of modifierNames) seen.set(name, (seen.get(name) ?? 0) + 1);

  const counts = new Map();
  for (const [name, n] of seen) {
    counts.set(name, MODIFIER_TRANSFORM[name]?.stacks ? n : 1);
  }
  return counts;
}

/**
 * Work out what the finished brew does.
 *
 * @param {string} effectName
 * @param {string[]} modifierNames  bench order; repeats respected where the rules allow
 * @param {number|null} alchemyMod  the crafter's Alchemy modifier, if known
 */
export function composeEffect(effectName, modifierNames = [], alchemyMod = null) {
  const base = EFFECT_FORMULA[effectName];
  if (!base) return null;

  const out = {
    kind: base.kind,
    count: base.count ?? null,
    die: base.die ?? null,
    mod: Boolean(base.mod),
    damageType: base.damageType ?? null,
    perRound: Boolean(base.perRound),
    condition: base.condition ?? null,
    duration: base.duration ?? null,
    save: base.save ?? null,
    uses: base.uses ?? null,
    bonus: base.bonus ?? null,
    target: base.target ?? null,
    halveTotal: false,
    delay: null,
    inverted: false,
    riders: base.rider ? [base.rider] : [],
    notes: []
  };

  for (const [name, times] of applyCounts(modifierNames)) {
    const t = MODIFIER_TRANSFORM[name];
    if (!t) continue;

    // Lavender Sprig only ever steadied the brewing; it changes nothing here.
    if (t.craftingOnly) { if (t.rider) out.riders.push(t.rider); continue; }

    for (let i = 0; i < times; i++) {
      if (t.doubleDice && out.count) out.count *= 2;
      if (t.stepDie && out.die) {
        if (dieCapped(out.die, t.stepDie)) out.notes.push("The die is already as large as it steps.");
        out.die = stepDie(out.die, t.stepDie);
      }
      if (t.halveDuration && out.duration?.flat) out.duration = { ...out.duration, flat: out.duration.flat / 2 };
    }

    if (t.dropMod) out.mod = false;
    if (t.halveTotal) out.halveTotal = true;
    if (t.perRound) out.perRound = true;
    if (t.damageType) out.damageType = t.damageType;
    if (t.delay) out.delay = t.delay;
    if (t.inverts) out.inverted = true;
    if (t.rider) out.riders.push(times > 1 ? `${t.rider} (×${times})` : t.rider);
  }

  out.formula = renderFormula(out, alchemyMod);
  return out;
}

/**
 * The dice expression, as Foundry would roll it.
 *
 * Returns null when the effect has no dice — plenty do their work through a
 * condition or a duration, and inventing a formula for those would be making
 * up rules rather than encoding them.
 */
export function renderFormula(effect, alchemyMod = null) {
  if (!effect?.count || !effect?.die) return null;

  let expr = `${effect.count}d${effect.die}`;
  if (effect.mod && Number.isFinite(alchemyMod)) {
    expr += alchemyMod >= 0 ? ` + ${alchemyMod}` : ` - ${Math.abs(alchemyMod)}`;
  } else if (effect.mod) {
    expr += " + the Alchemy modifier";
  }

  // Gengko Brush halves the total after doubling the dice, then spreads it
  // over rounds — floor() so it can never round up into free healing.
  if (effect.halveTotal) expr = `floor((${expr}) / 2)`;
  return expr;
}

/**
 * One line a player can act on, for the item's description and the chat card.
 */
export function describeEffect(effect) {
  if (!effect) return "";

  const verb = { heal: "Heals", damage: "Deals", buff: "Grants", control: "", utility: "" }[effect.kind] ?? "";
  const parts = [];

  if (effect.formula) {
    const type = effect.damageType ? ` ${effect.damageType}` : "";
    const per = effect.perRound ? " per round" : "";
    parts.push(`${verb} ${effect.formula}${type}${effect.kind === "damage" ? " damage" : ""}${per}.`.trim());
  }
  if (effect.bonus && effect.target) parts.push(`+${effect.bonus} to ${effect.target}.`);
  if (effect.condition) parts.push(`Target is ${effect.condition}.`);
  if (effect.save) {
    const dc = effect.save.mod ? `${effect.save.base} + the Alchemy modifier` : effect.save.base;
    parts.push(`Save DC ${dc} (${effect.save.ability}).`);
  }
  if (effect.duration) parts.push(`Lasts ${formatDuration(effect.duration)}.`);
  if (effect.delay) parts.push(`Takes hold after ${effect.delay.count}d${effect.delay.die} ${effect.delay.unit}.`);
  if (effect.uses) parts.push(`${effect.uses} uses.`);

  return parts.join(" ");
}

/** 5e rounds in a minute — how a halved duration stays sayable. */
const ROUNDS_PER_MINUTE = 10;

function formatDuration(d) {
  if (!d) return "";
  const unit = d.unit ?? "";
  if (d.flat == null) return `${d.count}d${d.die} ${unit}`;

  // Quicksilver Lichen stacks, so a 1-minute toxin halves to "0.25 minute",
  // which is not something anyone can act on at a table. Rounds are.
  if (d.flat < 1 && /^minutes?$/.test(unit)) {
    const rounds = Math.floor(d.flat * ROUNDS_PER_MINUTE);
    return `${rounds} round${rounds === 1 ? "" : "s"}`;
  }

  const plural = d.flat === 1 ? unit.replace(/s$/, "") : unit.replace(/([^s])$/, "$1s");
  return `${d.flat} ${plural}`;
}
