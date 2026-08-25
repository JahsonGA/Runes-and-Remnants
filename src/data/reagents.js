// =========================================================
// Runes & Remnants — Reagents
//
// The join between Harvest and Craft. Without this the two systems merely
// share a window; with it, what you hunted decides what you can brew.
//
// Three ideas, layered:
//
//   PROPERTY  What kind of part it is. A recipe asks for a property, never a
//             specific item, so many monsters can satisfy it and a party is
//             never locked out for want of one creature.
//
//   POTENCY   How impressive the kill was, derived from the part's harvest
//             DC. Nothing new to author: the harvest table already grades
//             every component 5–25, and the essence table grades by CR.
//
//   BUDGET    A recipe needs a potency *total*, not one qualifying part. Two
//             lesser hearts substitute for one great one, so a low-level
//             party grinds where a high-level one takes a single trophy.
//
// Creature theme is a bonus, never a gate — brewing Giant Strength from an
// actual giant's heart should feel better than using a troll's, but the
// troll's must still work.
// =========================================================

/** What each property means, for the UI. */
export const PROPERTY_LABELS = {
  vital:      "Vital",
  virulent:   "Virulent",
  elemental:  "Elemental",
  arcane:     "Arcane",
  perceptive: "Perceptive",
  structural: "Structural",
  viscous:    "Viscous",
  fibrous:    "Fibrous"
};

export const PROPERTY_HINTS = {
  vital:      "Organs and blood — the seat of a creature's life",
  virulent:   "Venom, acid, spore and rot",
  elemental:  "Parts that still hold the energy that animated them",
  arcane:     "Mind, soul and the residue of magic",
  perceptive: "Sense organs",
  structural: "Bone, shell, plate and horn",
  viscous:    "Fat, oil, sap and mucus",
  fibrous:    "Fur, feather, silk and leaf"
};

/**
 * Component name → its properties.
 *
 * Keyed by *name*, not by creature type: the harvest table reuses these 65
 * names across 215 type rows, so a Heart is a Heart whether it came out of a
 * dragon or a goblin. Most parts carry more than one property — an ooze
 * membrane is both a container and a solvent — which widens what qualifies.
 */
export const COMPONENT_PROPERTIES = {
  // ---- vital ----
  "Heart":                    ["vital"],
  "Undying Heart":            ["vital", "arcane"],
  "Liver":                    ["vital"],
  "Marrow":                   ["vital", "structural"],
  "Flesh":                    ["vital"],
  "Undying Flesh":            ["vital", "arcane"],
  "Phial of Blood":           ["vital"],
  "Phial of Congealed Blood": ["vital", "virulent"],
  "Egg":                      ["vital"],
  "Tentacle":                 ["vital", "structural"],
  "Tuber":                    ["vital", "fibrous"],

  // ---- virulent ----
  "Poison Gland (Poison)":    ["virulent"],
  "Poison Gland (Material)":  ["virulent"],
  "Stinger":                  ["virulent", "structural"],
  "Spider Milk":              ["virulent", "viscous"],
  "Phial of acid":            ["virulent", "viscous"],
  "Pouch of Spore":           ["virulent", "fibrous"],
  "Vesicle":                  ["virulent", "viscous"],

  // ---- elemental ----
  "Breath Sac":               ["elemental", "vital"],
  "Lifespark":                ["elemental", "arcane"],
  "Ethereal Ichor":           ["elemental", "arcane", "viscous"],
  "Stone":                    ["elemental", "structural"],
  "Pouch of Dust":            ["elemental", "arcane"],
  "Phial of Oil":             ["elemental", "viscous"],

  // ---- arcane ----
  "Brain":                    ["arcane", "perceptive"],
  "Psyche":                   ["arcane"],
  "Soul":                     ["arcane"],
  "Instructions":             ["arcane"],
  "Pouch of Pollen":          ["arcane", "fibrous"],

  // ---- perceptive ----
  "Eye":                      ["perceptive"],
  "Main Eye":                 ["perceptive", "arcane"],
  "Antenna":                  ["perceptive"],
  "Tongue":                   ["perceptive"],
  "Beak":                     ["perceptive", "structural"],

  // ---- structural ----
  "Bone":                     ["structural"],
  "Bone Shards":              ["structural"],
  "Chitin":                   ["structural"],
  "Plating":                  ["structural"],
  "Gears":                    ["structural"],
  "Bark":                     ["structural", "fibrous"],
  "Hide":                     ["structural"],
  "Skin":                     ["structural", "fibrous"],
  "Pelt":                     ["structural", "fibrous"],
  "Horn":                     ["structural"],
  "Antler":                   ["structural"],
  "Tusk":                     ["structural"],
  "Talon":                    ["structural"],
  "Pincer":                   ["structural"],
  "Fin":                      ["structural"],
  "Pouch of Claws":           ["structural"],
  "Pouch of Teeth":           ["structural"],
  "Pouch of Scales":          ["structural"],
  "Membrane (Ooze)":          ["structural", "viscous"],
  "Membrane (Plant)":         ["structural", "fibrous"],

  // ---- viscous ----
  "Fat":                      ["viscous"],
  "Rancid Fat":               ["viscous", "virulent"],
  "Phial of Wax":             ["viscous"],
  "Phial of Mucus":           ["viscous", "virulent"],
  "Phial of Sap":             ["viscous", "vital"],

  // ---- fibrous ----
  "Fur":                      ["fibrous"],
  "Hair":                     ["fibrous"],
  "Silk Sack":                ["fibrous", "viscous"],
  "Pouch of Feathers":        ["fibrous"],
  "Pouch of Leaves":          ["fibrous"],
  "Pouch of Hyphae":          ["fibrous"]
};

/**
 * Harvest DC → potency. Roughly half the DC, so the numbers stay small
 * enough to add up in your head at the table.
 *
 * The curve steepens deliberately: a DC 25 part is worth six DC 5 parts, not
 * five, because getting to the fifth component on a harvest list costs far
 * more than five times what the first did (the DCs are cumulative).
 */
export const POTENCY_BY_DC = { 5: 2, 10: 5, 15: 7, 20: 10, 25: 12 };

/** Essence DCs run 25–50 by CR and carry the heaviest potency in the game. */
export const ESSENCE_POTENCY_BY_DC = { 25: 12, 30: 15, 35: 17, 40: 20, 50: 25 };

/**
 * Potency a rarity's reagents must add up to.
 *
 * Calibrated against what is actually reachable:
 *   common    2  — a single DC 5 scrap
 *   uncommon  5  — one DC 10 part, or three scraps
 *   rare     10  — one DC 20 part, or two DC 15
 *   very rare 17 — a CR 11+ essence, or two DC 20 parts
 *   legendary 25 — a CR 21+ essence, or a small mountain of trophies
 */
export const RARITY_POTENCY = {
  common: 2,
  uncommon: 5,
  rare: 10,
  "very rare": 17,
  legendary: 25
};

/**
 * Which property each potion demands.
 * One line per recipe — the property does the work of naming thirty
 * different acceptable parts.
 */
export const POTION_PROPERTY = {
  "Potion of Healing":                 { property: "vital" },
  "Potion of Climbing":                { property: "structural" },
  "Potion of Greater Healing":         { property: "vital" },
  "Potion of Animal Friendship":       { property: "fibrous",    theme: ["beast"] },
  "Potion of Fire Breath":             { property: "elemental",  theme: ["dragon", "elemental"] },
  "Potion of Growth":                  { property: "vital",      theme: ["giant"] },
  "Potion of Hill Giant Strength":     { property: "vital",      theme: ["giant"] },
  "Potion of Poison":                  { property: "virulent" },
  "Potion of Resistance":              { property: "structural" },
  "Potion of Water Breathing":         { property: "structural", theme: ["beast", "monstrosity"] },
  "Philter of Love":                   { property: "arcane",     theme: ["fey"] },
  "Oil of Slipperiness":               { property: "viscous",    theme: ["ooze"] },
  "Potion of Superior Healing":        { property: "vital" },
  "Potion of Diminution":              { property: "arcane",     theme: ["fey"] },
  "Potion of Gaseous Form":            { property: "elemental",  theme: ["elemental"] },
  "Potion of Frost Giant Strength":    { property: "vital",      theme: ["giant"] },
  "Potion of Stone Giant Strength":    { property: "vital",      theme: ["giant"] },
  "Potion of Fire Giant Strength":     { property: "vital",      theme: ["giant"] },
  "Potion of Heroism":                 { property: "vital",      theme: ["celestial"] },
  "Potion of Invulnerability":         { property: "structural" },
  "Potion of Mind Reading":            { property: "arcane",     theme: ["aberration"] },
  "Oil of Etherealness":               { property: "arcane",     theme: ["undead", "elemental"] },
  "Potion of Supreme Healing":         { property: "vital" },
  "Potion of Cloud Giant Strength":    { property: "vital",      theme: ["giant"] },
  "Potion of Flying":                  { property: "fibrous",    theme: ["celestial"] },
  "Potion of Invisibility":            { property: "arcane",     theme: ["fey", "aberration"] },
  "Potion of Longevity":               { property: "vital",      theme: ["undead"] },
  "Potion of Speed":                   { property: "vital",      theme: ["monstrosity"] },
  "Potion of Vitality":                { property: "vital",      theme: ["celestial"] },
  "Oil of Sharpness":                  { property: "structural" },
  "Potion of Storm Giant Strength":    { property: "vital",      theme: ["giant"] }
};

/**
 * Mundane consumables carry their own requirement rather than a rarity
 * scale — they are not magic, so nothing about them keys off rarity.
 */
export const CONSUMABLE_REAGENT = {
  "Acid (vial)":              { property: "virulent",   potency: 2,  theme: ["ooze"] },
  "Alchemist's Fire (flask)": { property: "elemental",  potency: 5,  theme: ["elemental", "dragon"] },
  "Antitoxin (vial)":         { property: "virulent",   potency: 5 },
  "Holy Water (flask)":       { property: "arcane",     potency: 5,  theme: ["celestial"] },
  "Oil (flask)":              { property: "viscous",    potency: 2 },
  "Poison, Basic (vial)":     { property: "virulent",   potency: 7,  theme: ["monstrosity"] },
  "Healer's Kit":             { property: "vital",      potency: 2 }
};

/** Every property a component in the harvest table can have. */
export const ALL_PROPERTIES = Object.keys(PROPERTY_LABELS);
