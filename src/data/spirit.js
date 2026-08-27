// =========================================================
// Runes & Remnants — Ancestral Weapons: spirit points
//
// The last step of the loop: Kill → Harvest → Craft → Enchant → **Evolve**.
//
// One weapon per character, grown rather than replaced. Its abilities are
// bought with SPIRIT POINTS, which are earned through deeds rather than
// harvested — that is the whole point of them. They are the one currency in
// this module that a party cannot go and farm.
//
// THE COSTS BELOW ARE THIS MODULE'S OWN SCALE, NOT A BOOK'S.
//
// Ancestral Weapons (DMs Guild) is a commercial product. Its ability list and
// point costs are its text, not a formula, and shipping them inside a public
// Foundry module is the same risk the project already declined to take with
// Grim Hollow and Ryoko's. So this file carries a ladder built to the two
// numbers the campaign already fixed — 20 points to awaken, 5 more to finish
// — and a table shaped to be replaced.
//
// A table that owns the book overrides these in one of two ways:
//   • edit SPIRIT_ABILITIES here, or
//   • register its own via registerSpiritAbilities() in src/enchant/spirit.js,
//     the same seam third-party recipes use.
// =========================================================

/** Points to awaken the weapon. Fixed by the campaign's own rules. */
export const SPIRIT_AWAKEN = 20;

/** Points it takes after awakening, at which point it is finished. */
export const SPIRIT_FINAL = 5;

/** Everything a weapon can ever hold. */
export const SPIRIT_TOTAL = SPIRIT_AWAKEN + SPIRIT_FINAL;

/**
 * Tier → what an ability at that tier costs.
 *
 * Calibrated against the 25-point budget: a weapon can hold roughly eight
 * lesser abilities, or three greater ones and a couple of small, or one of
 * everything at the top. Enough room for a real choice, not enough for all
 * of it — which is what makes it a choice.
 */
export const SPIRIT_TIERS = {
  lesser:  { cost: 1,  label: "Lesser" },
  greater: { cost: 3,  label: "Greater" },
  major:   { cost: 5,  label: "Major" },
  apex:    { cost: 8,  label: "Apex", requiresAwakened: true }
};

/**
 * The ability ladder.
 *
 * `kinds` follows the enchanting panel's item kinds. `requires` names another
 * ability that must be unlocked first, so a weapon grows along a path rather
 * than picking the best few in isolation.
 */
export const SPIRIT_ABILITIES = [
  // ---- lesser (1) ----
  { name: "Whetted",      tier: "lesser", kinds: ["weapon"],
    effect: "+1 to damage rolls." },
  { name: "Bonded",       tier: "lesser", kinds: ["weapon"],
    effect: "The weapon returns to your hand at the start of your turn if it is within 30 feet." },
  { name: "Waking Edge",  tier: "lesser", kinds: ["weapon"],
    effect: "You know the direction to the weapon while on the same plane." },
  { name: "Bloodscent",   tier: "lesser", kinds: ["weapon"],
    effect: "Advantage on tracking a creature the weapon has wounded within the last day." },
  { name: "Unbreaking",   tier: "lesser", kinds: ["weapon", "armour"],
    effect: "The item cannot be broken by non-magical means." },

  // ---- greater (3) ----
  { name: "Keen Spirit",  tier: "greater", kinds: ["weapon"], requires: "Whetted",
    effect: "Critical hits land on a 19 or 20." },
  { name: "Kinbane",      tier: "greater", kinds: ["weapon"], requires: "Bloodscent",
    effect: "Extra damage against creatures of the type the weapon was bound to." },
  { name: "Warding Spirit", tier: "greater", kinds: ["weapon", "armour"],
    effect: "+1 to Armour Class while the weapon is drawn." },
  { name: "Second Wind",  tier: "greater", kinds: ["weapon"], requires: "Bonded",
    effect: "Once per long rest, regain hit points when you reduce a creature to 0." },

  // ---- major (5) ----
  { name: "Devouring",    tier: "major", kinds: ["weapon"], requires: "Kinbane",
    effect: "A creature slain by the weapon yields its remnant automatically." },
  { name: "Spiritstrike", tier: "major", kinds: ["weapon"], requires: "Keen Spirit",
    effect: "The weapon counts as magical and its damage ignores resistance." },
  { name: "Guardian",     tier: "major", kinds: ["weapon", "armour"], requires: "Warding Spirit",
    effect: "Impose disadvantage on one attack against you per round." },

  // ---- apex (8) — only after awakening ----
  { name: "Ancestral Voice", tier: "apex", kinds: ["weapon"],
    effect: "The weapon speaks. It has a personality, a goal, and an opinion about yours." },
  { name: "Soulrend",     tier: "apex", kinds: ["weapon"], requires: "Spiritstrike",
    effect: "On a critical hit, the target makes a saving throw or suffers a lasting wound." }
];

/**
 * How points are earned, for the panel's reference.
 *
 * Deeds, not drops. A GM awards these; nothing in the module hands them out,
 * because a spirit point you can farm is just another material.
 */
export const SPIRIT_DEEDS = [
  "Slaying a creature of a kind the weapon has never tasted",
  "Slaying something far above your level",
  "Carrying the weapon through a milestone in its wielder's story",
  "Recovering a piece of its history, or avenging the line it came from",
  "A remnant, spent in place of a deed — see the warning below"
];

/**
 * Spending a remnant in place of points is allowed, and it is a one-way door:
 * the weapon can never be enchanted again afterwards.
 */
export const REMNANT_SPIRIT_VALUE = {
  Frail: 1, Robust: 3, Potent: 5, Mythic: 8, Deific: 12
};
