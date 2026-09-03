// =========================================================
// Runes & Remnants — Alchemy, made mechanical
//
// The ingredient table says what each thing does in prose. That is enough to
// read at a table and not enough to roll, so a brewed potion arrived as a
// description its drinker had to interpret.
//
// This encodes the same rules as numbers a transform can act on. A base
// effect becomes { count, die, mod } — 2d4 + the Alchemy modifier — and a
// modifier becomes an operation on it: double the dice, step the die up,
// drop the modifier, change the damage type. Composing them produces a real
// formula, which is the whole point of the modifier system: the combination
// does something none of the parts do alone.
//
// Only mechanics live here. The prose stays in alchemy.js.
// =========================================================

/** The die ladder a "step up" walks. Nothing in 5e steps past d12. */
export const DIE_LADDER = [4, 6, 8, 10, 12];

/**
 * What a base effect rolls.
 *
 * `mod: true` means the crafter's Alchemy modifier is added — that is what
 * makes a good alchemist's potions better than a poor one's, so a modifier
 * that drops it (Milkweed Seeds) is a real trade rather than a downside.
 *
 * An effect with no dice is not broken; some do their work through a
 * condition or a duration, and `rider` carries that instead.
 */
export const EFFECT_FORMULA = {
  // ---- potions ----
  "Wild Sageroot": {
    kind: "heal", count: 2, die: 4, mod: true
  },
  "Mandrake Root": {
    kind: "utility", duration: { count: 2, die: 12, unit: "hours" },
    rider: "Halves the potency of a disease or poison already in the system."
  },
  "Hyancinth Nectar": {
    kind: "utility", count: 1, die: 6, unit: "rounds",
    rider: "Removes that many rounds of poison already in the system. One round always remains."
  },
  "Fennel Silk": {
    kind: "utility", duration: { flat: 1, unit: "hour" },
    rider: "Stabilises body heat against cold or wet conditions."
  },
  "Bloodgrass": {
    kind: "utility",
    rider: "Also feeds a creature for a day. Rides alongside another potion effect rather than replacing it."
  },

  // ---- poisons ----
  "Wyrmtongue Petals": {
    kind: "damage", damageType: "poison", count: 1, die: 4, mod: true,
    perRound: true, condition: "poisoned", duration: { flat: 1, unit: "minute" }
  },
  "Basilisk Breath": {
    kind: "control", save: { ability: "con", base: 5, mod: true },
    rider: "Slowed for 4 turns. On a failed save, paralysed for 4 rounds."
  },

  // ---- enchantment brews with no SRD item ----
  "Arrow Root": {
    kind: "buff", bonus: 1, target: "attack rolls",
    duration: { flat: 1, unit: "minute" },
    rider: "Applied to a weapon."
  },
  "Primordial Balm": {
    kind: "utility",
    rider: "Frost, fire or stone giant strength — the brewer chooses which."
  },
  "Silver Hibiscus": {
    kind: "utility", uses: 3,
    rider: "Grants a random elemental breath weapon."
  }
};

/**
 * What a modifier does to the formula.
 *
 * `stacks: true` means two of the same ingredient apply twice — the source
 * says so for exactly two of them, and it is the difference between a
 * modifier being a choice and being a checkbox.
 *
 * A modifier with only `rider` changes no numbers. That is not a gap: half
 * of them add a condition rather than more dice, and pretending otherwise
 * would invent mechanics the rules do not have.
 */
export const MODIFIER_TRANSFORM = {
  // ---- potion ----
  "Milkweed Seeds":      { doubleDice: true, dropMod: true, stacks: true },
  "Dried Ephedra":       { stepDie: 1 },
  "Gengko Brush":        { doubleDice: true, halveTotal: true, perRound: true },

  // ---- toxin ----
  "Amanita Cap":         { rider: "Non-lethal — the target is incapacitated rather than killed." },
  "Harrada Leaf":        { rider: "While poisoned, the target has disadvantage on ability checks." },
  "Arctic Creeper":      { damageType: "cold", rider: "Or necrotic, brewer's choice. Still counts as poison while crafting." },
  "Drakus Flower":       { damageType: "fire", rider: "Or acid, brewer's choice. Still counts as poison while crafting." },
  "Radiant Synthseed":   { damageType: "radiant", rider: "Still counts as poison while crafting." },
  "Cactus Juice":        { rider: "The target does not notice the poison until it has taken 5 rounds of damage." },
  "Quicksilver Lichen":  { doubleDice: true, halveDuration: true, stacks: true },
  "Spineflower Berries": { stepDie: 1 },
  "Frozen Seedlings":    { rider: "While poisoned, the target's speed drops by 10 feet for 1 minute." },

  // ---- either ----
  "Lavender Sprig":      { craftingOnly: true, rider: "Steadied during brewing — no change to the finished effect." },
  "Emetic Wax":          { delay: { count: 1, die: 6, unit: "rounds" } },
  "Chromus Slime":       { inverts: true, rider: "The effect is inverted entirely — the GM adjudicates what that means here." }
};
