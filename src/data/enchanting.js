// =========================================================
// Runes & Remnants — Enchanting
//
// The third step of the loop: Kill → Harvest → Craft → **Enchant**.
//
// Three things go into an enchantment, and each answers a different question:
//
//   THE ITEM       what is being changed. It must already exist — you cannot
//                  enchant a sword you have not made.
//   THE COMPONENT  what it BECOMES. A venom gland makes a venomous blade; an
//                  eye makes a seeking one.
//   THE REMNANT    how STRONG it becomes. The creature's essence, gathered
//                  before it faded. A rarer remnant than the recipe asks for
//                  raises the item's rarity — and its DC and its hours with
//                  it.
//
// The check is the caster's ability and the corpse's skill: a wizard working
// a dragon's remnant rolls Intelligence (Survival). That is why harvest
// stamps the creature type onto everything it grants.
//
// Only mechanics and SRD-safe names here, same rule as the rest of the
// module. See src/craft/CraftDetails.md for why.
// =========================================================

import { ALL_PROPERTIES } from "./reagents.js";

/**
 * Remnant tier → what it makes and what it costs.
 *
 * The names match the essences the harvest table already drops, so a party's
 * loot is the input to this system without any translation step.
 *
 * Hours are for a non-attunement item. Attunement doubles them; consumables
 * take a fraction — see CONSUMABLE_TIME_DIVISOR.
 */
export const REMNANT_TIERS = [
  { remnant: null,      rarity: "common",    dc: 12, hours: 1 },
  { remnant: "Frail",   rarity: "uncommon",  dc: 15, hours: 10 },
  { remnant: "Robust",  rarity: "rare",      dc: 18, hours: 40 },
  { remnant: "Potent",  rarity: "very rare", dc: 21, hours: 160 },
  { remnant: "Mythic",  rarity: "legendary", dc: 25, hours: 640 },
  { remnant: "Deific",  rarity: "artifact",  dc: 30, hours: 100000 }
];

/** Weakest to strongest. Used to compare what a recipe asks against what you have. */
export const RARITY_ORDER = REMNANT_TIERS.map(t => t.rarity);

export const ATTUNEMENT_MULTIPLIER = 2;
export const CONSUMABLE_TIME_DIVISOR = 10;

/**
 * What the item is, which decides which enchantments can take.
 * Derived from the dnd5e item type where possible.
 */
export const ITEM_KINDS = ["weapon", "armour", "wondrous"];

/**
 * The enchantments themselves.
 *
 * Keyed to the component's *property* rather than to a specific part, for the
 * same reason crafting is: a venomous blade should take any venom gland, not
 * one particular monster's. See src/data/reagents.js.
 *
 * `rarity` is the floor the recipe asks for. Bring a stronger remnant and the
 * item comes out at that higher rarity instead.
 */
export const ENCHANTMENTS = [
  // ---- vital ----
  { name: "Lifedrinker",   property: "vital", kinds: ["weapon"], rarity: "rare",
    effect: "On a hit, regain hit points equal to the weapon's damage die." },
  { name: "Enduring",      property: "vital", kinds: ["armour"], rarity: "uncommon",
    effect: "Your hit point maximum increases while worn." },
  { name: "Second Heart",  property: "vital", kinds: ["wondrous"], rarity: "very rare",
    effect: "Once per long rest, drop to 1 hit point instead of 0." },

  // ---- virulent ----
  { name: "Venomous",      property: "virulent", kinds: ["weapon"], rarity: "uncommon",
    effect: "On a hit, the target saves against poison or takes extra poison damage." },
  { name: "Caustic Hide",  property: "virulent", kinds: ["armour"], rarity: "rare",
    effect: "A creature that hits you with a melee attack takes acid damage." },
  { name: "Antivenom Charm", property: "virulent", kinds: ["wondrous"], rarity: "uncommon",
    effect: "Advantage on saving throws against poison." },

  // ---- elemental ----
  { name: "Elemental Brand", property: "elemental", kinds: ["weapon"], rarity: "uncommon",
    effect: "The weapon deals extra damage of the creature's element." },
  { name: "Elemental Ward",  property: "elemental", kinds: ["armour"], rarity: "rare",
    effect: "Resistance to the creature's damage type." },
  { name: "Ember Focus",     property: "elemental", kinds: ["wondrous"], rarity: "rare",
    effect: "Spells you cast of the creature's element gain a damage bonus." },

  // ---- arcane ----
  { name: "Spellbreaker",  property: "arcane", kinds: ["weapon"], rarity: "very rare",
    effect: "On a hit, the target has disadvantage on concentration saves." },
  { name: "Warding Sigils", property: "arcane", kinds: ["armour"], rarity: "rare",
    effect: "Advantage on saving throws against spells." },
  { name: "Arcane Focus",  property: "arcane", kinds: ["wondrous"], rarity: "uncommon",
    effect: "Serves as a spellcasting focus and adds a bonus to spell attack rolls." },

  // ---- perceptive ----
  { name: "Seeking",       property: "perceptive", kinds: ["weapon"], rarity: "rare",
    effect: "Ignores half and three-quarters cover." },
  { name: "Watchful",      property: "perceptive", kinds: ["armour"], rarity: "uncommon",
    effect: "You cannot be surprised while conscious." },
  { name: "Farsight Lens", property: "perceptive", kinds: ["wondrous"], rarity: "uncommon",
    effect: "Darkvision, or advantage on sight-based Perception checks." },

  // ---- structural ----
  { name: "Keen",          property: "structural", kinds: ["weapon"], rarity: "uncommon",
    effect: "The weapon scores a critical hit on a roll of 19 or 20." },
  { name: "Adamant Plating", property: "structural", kinds: ["armour"], rarity: "rare",
    effect: "Resistance to non-magical bludgeoning, piercing and slashing damage." },
  { name: "Bulwark Charm", property: "structural", kinds: ["wondrous"], rarity: "uncommon",
    effect: "Your Armour Class increases while worn." },

  // ---- viscous ----
  { name: "Ensnaring",     property: "viscous", kinds: ["weapon"], rarity: "uncommon",
    effect: "On a hit, the target's speed is reduced until the end of its next turn." },
  { name: "Slick",         property: "viscous", kinds: ["armour"], rarity: "uncommon",
    effect: "Advantage on checks to escape a grapple or squeeze through a space." },
  { name: "Tarblood Flask", property: "viscous", kinds: ["wondrous"], rarity: "common",
    effect: "Coats a surface or creature in clinging fluid once per short rest." },

  // ---- fibrous ----
  { name: "Silent",        property: "fibrous", kinds: ["weapon"], rarity: "common",
    effect: "The weapon makes no sound when drawn or when it strikes." },
  { name: "Shadowweave",   property: "fibrous", kinds: ["armour"], rarity: "uncommon",
    effect: "Advantage on Stealth checks while worn." },
  { name: "Feathered Cloak", property: "fibrous", kinds: ["wondrous"], rarity: "rare",
    effect: "You fall slowly, and take no damage from falling." }
];

/**
 * What goes wrong when the check misses.
 *
 * Failure does not simply stop the work — the enchantment still takes, badly.
 * That is more interesting than "nothing happens", and it means a party can
 * choose to attempt something above their level and live with the result.
 */
export const FLAW_BANDS = [
  { maxMargin: -13, flaws: 0, destroyed: true },
  { maxMargin: -9,  flaws: 3, destroyed: false },
  { maxMargin: -5,  flaws: 2, destroyed: false },
  { maxMargin: -1,  flaws: 1, destroyed: false },
  { maxMargin: Infinity, flaws: 0, destroyed: false }
];

/** Drawn from when a check misses. Deliberately playable rather than punishing. */
export const FLAWS = [
  "Hungry — the item demands a drop of the wielder's blood after each rest, or goes dormant.",
  "Loud — the enchantment sings when used, giving away your position.",
  "Brittle — on a natural 1, the item cannot be used until the next dawn.",
  "Heavy — the item weighs three times what it should.",
  "Cold — the item is painfully cold to hold; you have disadvantage on the first attack each combat.",
  "Wilful — the item resists a wielder who has not killed its creature's kin.",
  "Leaking — the enchantment fades for an hour after each use.",
  "Marked — creatures of the remnant's type sense the item within 60 feet.",
  "Twinned — the enchantment also affects the wielder, for good or ill.",
  "Unstable — the effect's damage type changes each dawn."
];

/** Sanity check for the data above; the tests assert it too. */
export const ENCHANT_PROPERTIES = ALL_PROPERTIES;
