// =========================================================
// Runes & Remnants — Alchemy Ingredients
//
// Potions, poisons and enchantment brews. Follows the Herbalism & Alchemy
// fan supplement (Dalagrath, v1.2), which is free/fan-made.
//
// The rule that drives everything here:
//
//   Alchemy Attempt DC = 10 + the DC modifiers of every ingredient used
//
// A concoction is one EFFECT plus up to three MODIFIERS. Enchantments are
// the exception: they need Elemental Water as their base and take no
// modifiers at all.
//
// Roles
//   potion-effect     base of a potion
//   potion-modifier   alters a potion's effect
//   toxin-effect      base of a poison
//   toxin-modifier    alters a poison's effect
//   both-modifier     works on either
//   enchantment       spell-like brew; needs the Elemental Water base
//   enchantment-base  Elemental Water itself
// =========================================================

/** Every role an ingredient can play. */
export const ROLES = [
  "potion-effect",
  "potion-modifier",
  "toxin-effect",
  "toxin-modifier",
  "both-modifier",
  "enchantment",
  "enchantment-base"
];

/** The one ingredient every enchantment must be built on. */
export const ENCHANTMENT_BASE = "Elemental Water";

/** How many modifiers a single concoction can carry. */
export const MAX_MODIFIERS = 3;

/**
 * @typedef {object} Ingredient
 * @property {string}   name
 * @property {string}   rarity     common | uncommon | rare | very-rare
 * @property {string}   role       one of ROLES
 * @property {number}   dc         DC modifier; can be negative
 * @property {string[]} terrain    where it is gathered
 * @property {string}   effect      what it does
 * @property {boolean} [locked]    true = cannot be combined with modifiers
 * @property {string}  [note]
 */
export const ALCHEMY_INGREDIENTS = [
  // ---------------- Potion ----------------
  { name: "Wild Sageroot", rarity: "common", role: "potion-effect", dc: 0,
    terrain: ["Most Terrain"], effect: "Heals 2d4 + Alchemy modifier." },
  { name: "Mandrake Root", rarity: "common", role: "potion-effect", dc: 0, locked: true,
    terrain: ["Most Terrain"], effect: "Halves the potency of an existing disease or poison for 2d12 hours." },
  { name: "Hyancinth Nectar", rarity: "common", role: "potion-effect", dc: 1,
    terrain: ["Coastal", "Grasslands"], effect: "Removes 1d6 rounds of poison already in the system; one round always remains." },
  { name: "Fennel Silk", rarity: "common", role: "potion-effect", dc: 2, locked: true,
    terrain: ["Arctic", "Underdark"], effect: "Stabilises body heat against cold or wet conditions for 1 hour." },
  { name: "Bloodgrass", rarity: "common", role: "potion-effect", dc: 0, locked: true,
    terrain: ["Most Terrain"], effect: "Combines with any other potion effect to also feed a creature for a day.",
    note: "The one effect that stacks with another effect." },

  { name: "Milkweed Seeds", rarity: "common", role: "potion-modifier", dc: 2,
    terrain: ["Most Terrain"], effect: "Doubles the healing dice rolled, but drops all Alchemy modifier bonuses. Stacks." },
  { name: "Dried Ephedra", rarity: "uncommon", role: "potion-modifier", dc: 2,
    terrain: ["Desert", "Mountain"], effect: "Steps the healing die up one size." },
  { name: "Gengko Brush", rarity: "uncommon", role: "potion-modifier", dc: 2,
    terrain: ["Hills", "Underdark"], effect: "Doubles the healing dice, halves the total, then heals that much per round for 2 rounds." },

  // ---------------- Poison ----------------
  { name: "Wyrmtongue Petals", rarity: "common", role: "toxin-effect", dc: 0,
    terrain: ["Most Terrain"], effect: "1d4 + Alchemy modifier poison damage per round; target is poisoned for 1 minute." },
  { name: "Basilisk Breath", rarity: "very-rare", role: "toxin-effect", dc: 5, locked: true,
    terrain: ["Mountain"], effect: "Slowed for 4 turns; a failed save paralyses for 4 rounds. Save DC 5 + Alchemy modifier." },

  { name: "Amanita Cap", rarity: "common", role: "toxin-modifier", dc: 1,
    terrain: ["Coastal", "Swamp"], effect: "Makes the poison non-lethal — it incapacitates instead of killing." },
  { name: "Harrada Leaf", rarity: "common", role: "toxin-modifier", dc: 1, locked: true,
    terrain: ["Forest"], effect: "While poisoned, the target has disadvantage on ability checks." },
  { name: "Arctic Creeper", rarity: "common", role: "toxin-modifier", dc: 2,
    terrain: ["Arctic", "Mountain"], effect: "Changes the damage to cold or necrotic. Still counts as poison damage while crafting." },
  { name: "Drakus Flower", rarity: "common", role: "toxin-modifier", dc: 2,
    terrain: ["Desert", "Grasslands", "Mountain"], effect: "Changes the damage to fire or acid. Still counts as poison damage while crafting." },
  { name: "Cactus Juice", rarity: "common", role: "toxin-modifier", dc: 2,
    terrain: ["Desert", "Grasslands"], effect: "The target does not notice the poison until it has taken 5 rounds of damage." },
  { name: "Radiant Synthseed", rarity: "rare", role: "toxin-modifier", dc: 2,
    terrain: ["Underdark"], effect: "Changes the damage to radiant. Still counts as poison damage while crafting." },
  { name: "Quicksilver Lichen", rarity: "uncommon", role: "toxin-modifier", dc: 3,
    terrain: ["Most Terrain"], effect: "Doubles the toxin dice but halves its duration. Stacks." },
  { name: "Spineflower Berries", rarity: "uncommon", role: "toxin-modifier", dc: 3,
    terrain: ["Desert", "Swamp"], effect: "Steps the toxin die up one size." },
  { name: "Frozen Seedlings", rarity: "rare", role: "toxin-modifier", dc: 4, locked: true,
    terrain: ["Arctic", "Mountain"], effect: "While poisoned, the target's speed drops by 10 ft for 1 minute." },

  // ---------------- Works on either ----------------
  { name: "Lavender Sprig", rarity: "common", role: "both-modifier", dc: -2,
    terrain: ["Coastal", "Grasslands", "Hills"], effect: "Steadies the mixture, making it safer to craft.",
    note: "The only ingredient that lowers the DC." },
  { name: "Emetic Wax", rarity: "common", role: "both-modifier", dc: 2,
    terrain: ["Forest", "Swamp"], effect: "Delays the effect of the ingredient it was combined with by 1d6 rounds.",
    note: "The source lists +1 on the potion table and +2 on the poison table; +2 is used here." },
  { name: "Chromus Slime", rarity: "rare", role: "both-modifier", dc: 4,
    terrain: ["Coastal", "Underdark"], effect: "Inverts the final effect entirely — GM adjudicates the specifics." },

  // ---------------- Enchantment ----------------
  { name: ENCHANTMENT_BASE, rarity: "rare", role: "enchantment-base", dc: 3,
    terrain: ["Special"], effect: "Required base for every enchantment. Without it the brew is tainted." },

  { name: "Scillia Beans", rarity: "common", role: "enchantment", dc: 1,
    terrain: ["Desert", "Grasslands"], effect: "Potion of climbing." },
  { name: "Arrow Root", rarity: "uncommon", role: "enchantment", dc: 2,
    terrain: ["Desert", "Forest", "Grasslands"], effect: "+1 to attack rolls for 1 minute, applied to a weapon." },
  { name: "Hydrathistle", rarity: "uncommon", role: "enchantment", dc: 2,
    terrain: ["Coastal", "Swamp"], effect: "Potion of water breathing." },
  { name: "Verdant Nettle", rarity: "uncommon", role: "enchantment", dc: 2,
    terrain: ["Forest"], effect: "Potion of animal friendship." },
  { name: "Ironwood Heart", rarity: "uncommon", role: "enchantment", dc: 3,
    terrain: ["Arctic", "Forest", "Hills"], effect: "Potion of growth." },
  { name: "Nightshade Berries", rarity: "uncommon", role: "enchantment", dc: 3,
    terrain: ["Forest", "Hills"], effect: "Acts as oil of slipperiness." },
  { name: "Blue Toadshade", rarity: "rare", role: "enchantment", dc: 3,
    terrain: ["Coastal", "Forest", "Swamp"], effect: "Potion of gaseous form." },
  { name: "Cosmos Glond", rarity: "rare", role: "enchantment", dc: 3,
    terrain: ["Coastal", "Desert"], effect: "Potion of clairvoyance." },
  { name: "Fiend's Ivy", rarity: "rare", role: "enchantment", dc: 4,
    terrain: ["Arctic", "Underdark"], effect: "Potion of mind reading." },
  { name: "Luminous Cap Dust", rarity: "rare", role: "enchantment", dc: 4,
    terrain: ["Mountain", "Underdark"], effect: "Potion of heroism." },
  { name: "Primordial Balm", rarity: "rare", role: "enchantment", dc: 4,
    terrain: ["Mountain", "Swamp", "Underdark"], effect: "Potion of frost / fire / stone giant strength." },
  { name: "Rock Vine", rarity: "rare", role: "enchantment", dc: 4,
    terrain: ["Hills", "Mountain"], effect: "Potion of invulnerability." },
  { name: "Wrackwort Bulbs", rarity: "rare", role: "enchantment", dc: 4,
    terrain: ["Coastal", "Swamp"], effect: "Potion of diminution." },
  { name: "Silver Hibiscus", rarity: "rare", role: "enchantment", dc: 4, locked: true,
    terrain: ["Arctic", "Underdark"], effect: "Grants a random elemental breath weapon, 3 uses." },
  { name: "Devil's Bloodleaf", rarity: "very-rare", role: "enchantment", dc: 5,
    terrain: ["Hills", "Swamp", "Underdark"], effect: "Potion of vitality." },
  { name: "Mortflesh Powder", rarity: "very-rare", role: "enchantment", dc: 5,
    terrain: ["Arctic", "Underdark"], effect: "Potion of longevity." },
  { name: "Tail Leaf", rarity: "very-rare", role: "enchantment", dc: 5,
    terrain: ["Grasslands", "Hills"], effect: "Potion of speed." },
  { name: "Voidroot", rarity: "very-rare", role: "enchantment", dc: 5,
    terrain: ["Arctic", "Desert"], effect: "Potion of flying." },
  { name: "Wisp Stalks", rarity: "very-rare", role: "enchantment", dc: 5,
    terrain: ["Forest", "Underdark"], effect: "Potion of invisibility." }
];

/** Tools that can make each kind of concoction. */
/**
 * Ingredients whose brew IS a named SRD item.
 *
 * Where one exists, granting the real dnd5e item beats building our own: it
 * arrives with its own description, activation and rolls already wired, and a
 * table gets a potion that works rather than one they have to read.
 *
 * Only the ones whose own effect text names an SRD item are here. Wild
 * Sageroot heals 2d4 + Alchemy modifier, which is NOT a Potion of Healing —
 * mapping it would quietly swap the mechanics for something similar-looking,
 * so it is left to be built (or overridden by a world item of that name).
 *
 * Applied only to an UNMODIFIED brew. A modifier makes it something the SRD
 * has no item for, and substituting the vanilla potion would throw away the
 * very thing the alchemist added.
 */
export const ALCHEMY_SRD_ITEM = {
  "Scillia Beans":      "Potion of Climbing",
  "Hydrathistle":       "Potion of Water Breathing",
  "Verdant Nettle":     "Potion of Animal Friendship",
  "Ironwood Heart":     "Potion of Growth",
  "Nightshade Berries": "Oil of Slipperiness",
  "Blue Toadshade":     "Potion of Gaseous Form",
  "Cosmos Glond":       "Potion of Clairvoyance",
  "Fiend's Ivy":        "Potion of Mind Reading",
  "Luminous Cap Dust":  "Potion of Heroism",
  "Rock Vine":          "Potion of Invulnerability",
  "Wrackwort Bulbs":    "Potion of Diminution",
  "Devil's Bloodleaf":  "Potion of Vitality",
  "Mortflesh Powder":   "Potion of Longevity",
  "Tail Leaf":          "Potion of Speed",
  "Voidroot":           "Potion of Flying",
  "Wisp Stalks":        "Potion of Invisibility"
};

export const ALCHEMY_TOOLS = {
  potion:      ["Alchemist's supplies", "Herbalism kit"],
  enchantment: ["Alchemist's supplies", "Herbalism kit"],
  poison:      ["Poisoner's kit"]
};

/** Terrains the gathering tables are keyed on. */
export const TERRAINS = [
  "Arctic", "Coastal", "Desert", "Forest", "Grasslands",
  "Hills", "Mountain", "Swamp", "Underdark"
];
