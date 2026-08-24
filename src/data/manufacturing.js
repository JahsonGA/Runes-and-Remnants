// =========================================================
// Runes & Remnants — Manufacturing Table
//
// Mundane item crafting: what tool, which ability, how long, what DC.
// Follows the Manufacturing DC & Time table in Ryoko's Guide.
//
// Only game mechanics (DC, time, tool, ability) and SRD item names are
// encoded here. Third-party items — Grim Hollow, L'Arsene's Ledger and the
// like — are loaded from the world's own compendium at runtime so nothing
// copyrighted ships with the module. See getExtraRecipes() in craft/logic.js.
//
// HOUSE RULE (Crafting Rules doc): the gold material cost is a *guideline*.
// In this campaign it is replaced by the monster parts and equipment the
// build actually needs, which the GM adjudicates. `materialCost` is kept as
// the yardstick for how much material a thing should take, not as a price.
// =========================================================

/**
 * Tool → the ability its checks use.
 * Several tools offer a choice, hence the array.
 */
export const TOOL_ABILITY = {
  "Alchemist's supplies":    ["int"],
  "Brewer's supplies":       ["con"],
  "Calligrapher's supplies": ["dex"],
  "Carpenter's tools":       ["dex", "str"],
  "Cartographer's tools":    ["dex", "int"],
  "Cobbler's tools":         ["dex", "int"],
  "Cook's utensils":         ["con"],
  "Glassblower's tools":     ["con", "dex"],
  "Herbalism kit":           ["int"],
  "Jeweller's tools":        ["dex"],
  "Leatherworker's tools":   ["dex"],
  "Mason's tools":           ["str"],
  "Painter's supplies":      ["dex"],
  "Poisoner's kit":          ["dex", "int"],
  "Potter's tools":          ["dex"],
  "Smith's tools":           ["con", "str"],
  "Tinker's tools":          ["dex"],
  "Weaver's tools":          ["con", "dex"],
  "Woodcarver's tools":      ["dex", "str"]
};

/** Shorthand used in the table below, expanded to full tool names. */
const T = {
  alchemist: "Alchemist's supplies",
  brewer: "Brewer's supplies",
  calligrapher: "Calligrapher's supplies",
  carpenter: "Carpenter's tools",
  cartographer: "Cartographer's tools",
  glassblower: "Glassblower's tools",
  herbalism: "Herbalism kit",
  jeweller: "Jeweller's tools",
  leatherworker: "Leatherworker's tools",
  mason: "Mason's tools",
  painter: "Painter's supplies",
  smith: "Smith's tools",
  tinker: "Tinker's tools",
  weaver: "Weaver's tools",
  woodcarver: "Woodcarver's tools"
};

/**
 * @typedef {object} Recipe
 * @property {string}   name       Item name — the join key into a compendium
 * @property {string}   category   Grouping for the UI
 * @property {string[]} tools      Any one of these can make it
 * @property {number}   hours      Crafting time; need not be continuous
 * @property {number}   dc         Manufacturing check DC
 * @property {number}   materialGp Material yardstick in gp (see house rule above)
 * @property {number}   valueGp    Finished item value in gp
 * @property {boolean} [srd]       false = name comes from a third-party book
 */

/** gp helpers so the table reads like the book. */
const cp = n => n / 100;
const sp = n => n / 10;

export const MANUFACTURING_TABLE = [
  // ---------------- Adventuring gear ----------------
  { name: "Adventuring gear (generic)", category: "Gear", tools: Object.keys(TOOL_ABILITY), hours: 2, dc: 11, materialGp: null, valueGp: null },

  // ---------------- Ammunition ----------------
  { name: "Arrows (20)",        category: "Ammunition", tools: [T.carpenter, T.woodcarver], hours: 1, dc: 13, materialGp: sp(3), valueGp: 1 },
  { name: "Bolts (20)",         category: "Ammunition", tools: [T.carpenter, T.woodcarver], hours: 1, dc: 13, materialGp: sp(3), valueGp: 1 },
  { name: "Blowgun needles (50)", category: "Ammunition", tools: [T.carpenter, T.woodcarver], hours: 1, dc: 13, materialGp: sp(3), valueGp: 1 },
  { name: "Sling bullets (20)", category: "Ammunition", tools: [T.mason, T.smith], hours: 1, dc: 13, materialGp: cp(1), valueGp: cp(4) },
  { name: "Firearm shot (20)",  category: "Ammunition", tools: [T.smith], hours: 1, dc: 13, materialGp: 1, valueGp: 3, srd: false },

  // ---------------- Armour ----------------
  { name: "Shield",         category: "Armour", tools: [T.carpenter, T.smith, T.woodcarver], hours: 8,   dc: 13, materialGp: 3,   valueGp: 10 },
  { name: "Padded",         category: "Armour", tools: [T.leatherworker, T.weaver], hours: 8,  dc: 13, materialGp: 2,   valueGp: 5 },
  { name: "Leather",        category: "Armour", tools: [T.leatherworker], hours: 16, dc: 15, materialGp: 3,   valueGp: 10 },
  { name: "Studded Leather",category: "Armour", tools: [T.leatherworker], hours: 24, dc: 17, materialGp: 15,  valueGp: 45 },
  { name: "Hide",           category: "Armour", tools: [T.leatherworker], hours: 8,  dc: 13, materialGp: 3,   valueGp: 10 },
  { name: "Chain Shirt",    category: "Armour", tools: [T.smith], hours: 16,  dc: 15, materialGp: 17,  valueGp: 50 },
  { name: "Scale Mail",     category: "Armour", tools: [T.smith], hours: 24,  dc: 17, materialGp: 17,  valueGp: 50 },
  { name: "Breastplate",    category: "Armour", tools: [T.smith], hours: 40,  dc: 18, materialGp: 130, valueGp: 400 },
  { name: "Half Plate",     category: "Armour", tools: [T.smith], hours: 80,  dc: 19, materialGp: 250, valueGp: 750 },
  { name: "Ring Mail",      category: "Armour", tools: [T.smith], hours: 16,  dc: 15, materialGp: 10,  valueGp: 30 },
  { name: "Chain Mail",     category: "Armour", tools: [T.smith], hours: 32,  dc: 16, materialGp: 25,  valueGp: 75 },
  { name: "Splint",         category: "Armour", tools: [T.smith], hours: 40,  dc: 18, materialGp: 70,  valueGp: 200 },
  { name: "Plate",          category: "Armour", tools: [T.smith], hours: 200, dc: 20, materialGp: 500, valueGp: 1500 },

  // ---------------- Simple melee weapons ----------------
  { name: "Club",         category: "Simple Melee", tools: [T.carpenter, T.woodcarver], hours: 0.25, dc: 14, materialGp: cp(3), valueGp: sp(1) },
  { name: "Dagger",       category: "Simple Melee", tools: [T.smith], hours: 1,   dc: 14, materialGp: sp(7), valueGp: 2 },
  { name: "Greatclub",    category: "Simple Melee", tools: [T.carpenter], hours: 0.5, dc: 14, materialGp: cp(7), valueGp: sp(2) },
  { name: "Handaxe",      category: "Simple Melee", tools: [T.smith], hours: 3,   dc: 14, materialGp: 2,     valueGp: 5 },
  { name: "Javelin",      category: "Simple Melee", tools: [T.carpenter, T.smith, T.woodcarver], hours: 1, dc: 14, materialGp: sp(3), valueGp: 1 },
  { name: "Light Hammer", category: "Simple Melee", tools: [T.mason, T.smith], hours: 1, dc: 14, materialGp: sp(7), valueGp: 2 },
  { name: "Mace",         category: "Simple Melee", tools: [T.mason, T.smith], hours: 3, dc: 14, materialGp: 2,     valueGp: 5 },
  { name: "Quarterstaff", category: "Simple Melee", tools: [T.carpenter, T.smith, T.woodcarver], hours: 0.5, dc: 14, materialGp: sp(2), valueGp: sp(5) },
  { name: "Sickle",       category: "Simple Melee", tools: [T.smith], hours: 1, dc: 14, materialGp: sp(3), valueGp: 1 },
  { name: "Spear",        category: "Simple Melee", tools: [T.carpenter, T.smith, T.woodcarver], hours: 1, dc: 14, materialGp: sp(3), valueGp: 1 },

  // ---------------- Simple ranged weapons ----------------
  { name: "Crossbow, Light", category: "Simple Ranged", tools: [T.tinker], hours: 12, dc: 14, materialGp: 8, valueGp: 25 },
  { name: "Dart (20)",       category: "Simple Ranged", tools: [T.carpenter, T.woodcarver], hours: 1, dc: 14, materialGp: cp(3), valueGp: sp(1) },
  { name: "Shortbow",        category: "Simple Ranged", tools: [T.carpenter, T.woodcarver], hours: 12, dc: 14, materialGp: 8, valueGp: 25 },
  { name: "Sling",           category: "Simple Ranged", tools: [T.weaver, T.leatherworker], hours: 0.25, dc: 14, materialGp: cp(3), valueGp: sp(1) },

  // ---------------- Martial melee weapons ----------------
  { name: "Battleaxe",   category: "Martial Melee", tools: [T.smith], hours: 6,  dc: 17, materialGp: 3,  valueGp: 10 },
  { name: "Flail",       category: "Martial Melee", tools: [T.smith], hours: 6,  dc: 17, materialGp: 3,  valueGp: 10 },
  { name: "Glaive",      category: "Martial Melee", tools: [T.carpenter, T.smith, T.woodcarver], hours: 12, dc: 17, materialGp: 7, valueGp: 20 },
  { name: "Greataxe",    category: "Martial Melee", tools: [T.smith], hours: 18, dc: 17, materialGp: 10, valueGp: 30 },
  { name: "Greatsword",  category: "Martial Melee", tools: [T.smith], hours: 24, dc: 17, materialGp: 17, valueGp: 50 },
  { name: "Halberd",     category: "Martial Melee", tools: [T.carpenter, T.smith, T.woodcarver], hours: 12, dc: 17, materialGp: 7, valueGp: 20 },
  { name: "Lance",       category: "Martial Melee", tools: [T.carpenter, T.smith, T.woodcarver], hours: 6, dc: 17, materialGp: 3, valueGp: 10 },
  { name: "Longsword",   category: "Martial Melee", tools: [T.smith], hours: 8,  dc: 17, materialGp: 5,  valueGp: 15 },
  { name: "Maul",        category: "Martial Melee", tools: [T.mason, T.smith], hours: 6, dc: 17, materialGp: 3, valueGp: 10 },
  { name: "Morningstar", category: "Martial Melee", tools: [T.smith], hours: 6,  dc: 17, materialGp: 3,  valueGp: 10 },
  { name: "Pike",        category: "Martial Melee", tools: [T.carpenter, T.smith, T.woodcarver], hours: 6, dc: 17, materialGp: 3, valueGp: 10 },
  { name: "Rapier",      category: "Martial Melee", tools: [T.smith], hours: 12, dc: 17, materialGp: 8,  valueGp: 25 },
  { name: "Scimitar",    category: "Martial Melee", tools: [T.smith], hours: 6,  dc: 17, materialGp: 3,  valueGp: 10 },
  { name: "Shortsword",  category: "Martial Melee", tools: [T.smith], hours: 6,  dc: 17, materialGp: 3,  valueGp: 10 },
  { name: "Trident",     category: "Martial Melee", tools: [T.carpenter, T.smith], hours: 3, dc: 17, materialGp: 2, valueGp: 5 },
  { name: "War Pick",    category: "Martial Melee", tools: [T.smith], hours: 3,  dc: 17, materialGp: 2,  valueGp: 5 },
  { name: "Warhammer",   category: "Martial Melee", tools: [T.mason, T.smith], hours: 8, dc: 17, materialGp: 5, valueGp: 15 },
  { name: "Whip",        category: "Martial Melee", tools: [T.leatherworker], hours: 1, dc: 17, materialGp: sp(7), valueGp: 2 },

  // ---------------- Martial ranged weapons ----------------
  { name: "Blowgun",         category: "Martial Ranged", tools: [T.carpenter, T.woodcarver], hours: 6,  dc: 17, materialGp: 3,  valueGp: 10 },
  { name: "Crossbow, Hand",  category: "Martial Ranged", tools: [T.tinker], hours: 40, dc: 17, materialGp: 25, valueGp: 75 },
  { name: "Crossbow, Heavy", category: "Martial Ranged", tools: [T.tinker], hours: 24, dc: 17, materialGp: 17, valueGp: 50 },
  { name: "Longbow",         category: "Martial Ranged", tools: [T.carpenter, T.woodcarver], hours: 18, dc: 17, materialGp: 17, valueGp: 50 },
  { name: "Net",             category: "Martial Ranged", tools: [T.weaver], hours: 1,  dc: 17, materialGp: sp(3), valueGp: 1 },

  // ---------------- Consumable bases ----------------
  // These are the mundane vessels. What goes IN them is Alchemy or
  // Enchanting — see src/data/alchemy.js.
  { name: "Potion base",      category: "Consumable Base", tools: [T.alchemist, T.brewer, T.herbalism], hours: 2, dc: 15, materialGp: 2, valueGp: 5 },
  { name: "Spell scroll base",category: "Consumable Base", tools: [T.calligrapher, T.cartographer, T.painter], hours: 2, dc: 15, materialGp: 3, valueGp: 10 },

  // ---------------- Focus & wondrous ----------------
  { name: "Instrument",     category: "Focus & Wondrous", tools: [T.carpenter, T.tinker, T.woodcarver], hours: 16, dc: 15, materialGp: 20, valueGp: 60 },
  { name: "Ring",           category: "Focus & Wondrous", tools: [T.jeweller], hours: 8, dc: 15, materialGp: null, valueGp: null },
  { name: "Rod, staff, wand",category: "Focus & Wondrous", tools: [T.carpenter, T.glassblower, T.smith, T.tinker, T.woodcarver], hours: 8, dc: 17, materialGp: null, valueGp: null },
  { name: "Wondrous item",  category: "Focus & Wondrous", tools: Object.keys(TOOL_ABILITY), hours: 8, dc: 15, materialGp: null, valueGp: null }
];

/** Categories in the order the UI should show them. */
export const MANUFACTURING_CATEGORIES = [
  "Simple Melee",
  "Martial Melee",
  "Simple Ranged",
  "Martial Ranged",
  "Armour",
  "Ammunition",
  "Consumable Base",
  "Focus & Wondrous",
  "Gear"
];
