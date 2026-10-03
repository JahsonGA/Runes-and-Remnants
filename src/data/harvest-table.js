// =========================================================
// Runes & Remnants — Harvest Table
// Maps each D&D 5e creature type to its harvestable components.
//
// Follows the harvest tables in Ryoko's Guide "Harvesting and Crafting Lite".
//
// Each entry is { dc, items[] } where:
//   dc    — the COMPONENT DC: how hard that single component is to extract
//   items — exact item names matching the harvest-items compendium
//
// IMPORTANT — these are component DCs, not thresholds.
// Harvesters pick the components they want AND the order they want them in.
// The Harvest DC for each entry is the running total of every component DC
// before it, so a list of cheap parts is reachable while a single expensive
// one near the front pushes everything after it out of range:
//
//   Pouch of Teeth  (10)  ->  Harvest DC 10
//   Eye             ( 5)  ->  Harvest DC 15
//   Breath Sac      (25)  ->  Harvest DC 40
//
// The Harvesting check (assessment + carving + helpers) is compared against
// those running totals. See getComponentDC / buildHarvestList in logic.js.
//
// Essence is appended to every table and gated by CR, not creature type —
// see ESSENCE_TABLE in logic.js.
//
// Items marked "house" are not in the source tables; the source permits extra
// components under its "Unusual Anatomy" and boss-component allowances.
// =========================================================

/**
 * @typedef {{ dc: number, items: string[] }} HarvestTier
 * @type {Record<string, HarvestTier[]>}
 */
export const HARVEST_TABLE = {

  // ----------------------------------------------------------
  // ABERRATION  |  Arcana
  // ----------------------------------------------------------
  aberration: [
    { dc: 5,  items: ["Antenna", "Eye", "Flesh", "Phial of Blood"] },
    { dc: 10, items: ["Bone", "Egg", "Fat", "Pouch of Claws", "Pouch of Teeth", "Tentacle"] },
    { dc: 15, items: ["Heart", "Phial of Mucus", "Liver", "Stinger"] },
    { dc: 20, items: ["Brain", "Chitin", "Hide", "Main Eye"] }
  ],

  // ----------------------------------------------------------
  // BEAST  |  Survival
  // ----------------------------------------------------------
  beast: [
    { dc: 5,  items: ["Antenna", "Eye", "Flesh", "Hair", "Phial of Blood"] },
    { dc: 10, items: ["Antler", "Beak", "Bone", "Egg", "Fat", "Fin", "Horn", "Pincer", "Pouch of Claws", "Pouch of Teeth", "Talon", "Tusk"] },
    { dc: 15, items: ["Heart", "Liver", "Poison Gland (Material)", "Pouch of Feathers", "Pouch of Scales", "Stinger", "Tentacle"] },
    { dc: 20, items: ["Chitin", "Pelt", "Fur"] } // Fur — house
  ],

  // ----------------------------------------------------------
  // CELESTIAL  |  Religion
  // ----------------------------------------------------------
  celestial: [
    { dc: 5,  items: ["Eye", "Flesh", "Hair", "Phial of Blood", "Pouch of Dust"] },
    { dc: 10, items: ["Bone", "Fat", "Horn", "Pouch of Teeth"] },
    { dc: 15, items: ["Heart", "Liver", "Pouch of Feathers", "Pouch of Scales"] },
    { dc: 20, items: ["Brain", "Skin"] },
    { dc: 25, items: ["Soul"] }
  ],

  // ----------------------------------------------------------
  // CONSTRUCT  |  Investigation
  // ----------------------------------------------------------
  construct: [
    { dc: 5,  items: ["Phial of Blood", "Phial of Oil"] },
    { dc: 10, items: ["Flesh", "Plating", "Stone"] },
    { dc: 15, items: ["Bone", "Heart", "Liver", "Gears"] },
    { dc: 20, items: ["Brain", "Instructions"] },
    { dc: 25, items: ["Lifespark"] }
  ],

  // ----------------------------------------------------------
  // DRAGON  |  Survival
  // ----------------------------------------------------------
  dragon: [
    { dc: 5,  items: ["Eye", "Flesh", "Phial of Blood"] },
    { dc: 10, items: ["Bone", "Egg", "Fat", "Pouch of Claws", "Pouch of Teeth"] },
    { dc: 15, items: ["Horn", "Liver", "Pouch of Scales"] },
    { dc: 20, items: ["Heart"] },
    { dc: 25, items: ["Breath Sac"] }
  ],

  // ----------------------------------------------------------
  // ELEMENTAL  |  Arcana
  // Source uses Primordial Dust (5), Volatile Mote (15) and Core (25);
  // none exist in the compendium yet, so pack-available stand-ins are used.
  // See docs/ROADMAP.md § 1.8.
  // ----------------------------------------------------------
  elemental: [
    { dc: 5,  items: ["Eye", "Stone"] },
    { dc: 10, items: ["Bone"] },
    { dc: 15, items: ["Ethereal Ichor"] },
    { dc: 25, items: ["Lifespark"] }
  ],

  // ----------------------------------------------------------
  // FEY  |  Arcana
  // ----------------------------------------------------------
  fey: [
    { dc: 5,  items: ["Antenna", "Eye", "Flesh", "Hair", "Phial of Blood"] },
    { dc: 10, items: ["Antler", "Beak", "Bone", "Egg", "Horn", "Pouch of Claws", "Pouch of Teeth", "Talon", "Tusk"] },
    { dc: 15, items: ["Heart", "Fat", "Liver", "Poison Gland (Material)", "Pouch of Feathers", "Pouch of Scales", "Tentacle", "Tongue"] },
    { dc: 20, items: ["Brain", "Skin", "Pelt"] },
    { dc: 25, items: ["Psyche"] }
  ],

  // ----------------------------------------------------------
  // FIEND  |  Religion
  // ----------------------------------------------------------
  fiend: [
    { dc: 5,  items: ["Eye", "Flesh", "Hair", "Phial of Blood", "Pouch of Dust"] },
    { dc: 10, items: ["Bone", "Horn", "Pouch of Claws", "Pouch of Teeth"] },
    { dc: 15, items: ["Heart", "Fat", "Liver", "Poison Gland (Material)", "Pouch of Feathers", "Pouch of Scales"] },
    { dc: 20, items: ["Brain", "Skin"] },
    { dc: 25, items: ["Soul"] }
  ],

  // ----------------------------------------------------------
  // GIANT  |  Medicine
  // Source lists "nail" (5) and "tooth" (10); neither is in the compendium,
  // so Pouch of Teeth covers the DC 10 slot.
  // ----------------------------------------------------------
  giant: [
    { dc: 5,  items: ["Flesh", "Phial of Blood"] },
    { dc: 10, items: ["Bone", "Fat", "Pouch of Teeth"] },
    { dc: 15, items: ["Heart", "Liver"] },
    { dc: 20, items: ["Skin"] }
  ],

  // ----------------------------------------------------------
  // HUMANOID  |  Medicine
  // ----------------------------------------------------------
  humanoid: [
    { dc: 5,  items: ["Eye", "Phial of Blood"] },
    { dc: 10, items: ["Bone", "Egg", "Pouch of Teeth"] },
    { dc: 15, items: ["Heart", "Liver", "Pouch of Feathers", "Pouch of Scales"] },
    { dc: 20, items: ["Brain", "Skin"] }
  ],

  // ----------------------------------------------------------
  // MONSTROSITY  |  Survival
  // Source mirrors the Beast table; Silk Sack, Spider Milk and the poison
  // variant are house additions.
  // ----------------------------------------------------------
  monstrosity: [
    { dc: 5,  items: ["Antenna", "Eye", "Flesh", "Hair", "Phial of Blood"] },
    { dc: 10, items: ["Antler", "Beak", "Bone", "Egg", "Fat", "Fin", "Horn", "Pincer", "Pouch of Claws", "Pouch of Teeth", "Talon", "Tusk"] },
    { dc: 15, items: ["Heart", "Liver", "Poison Gland (Material)", "Pouch of Feathers", "Pouch of Scales", "Stinger", "Tentacle"] },
    { dc: 20, items: ["Chitin", "Pelt", "Silk Sack", "Spider Milk", "Poison Gland (Poison)"] } // house
  ],

  // ----------------------------------------------------------
  // OOZE  |  Nature
  // ----------------------------------------------------------
  ooze: [
    { dc: 5,  items: ["Phial of acid"] },
    { dc: 10, items: ["Phial of Mucus"] },
    { dc: 15, items: ["Vesicle"] },
    { dc: 20, items: ["Membrane (Ooze)"] }
  ],

  // ----------------------------------------------------------
  // PLANT  |  Nature
  // Source lists "bundle of roots" at DC 10; not yet in the compendium.
  // ----------------------------------------------------------
  plant: [
    { dc: 5,  items: ["Phial of Sap", "Tuber"] },
    { dc: 10, items: ["Phial of Wax", "Pouch of Hyphae", "Pouch of Leaves"] },
    { dc: 15, items: ["Poison Gland (Material)", "Pouch of Pollen", "Pouch of Spore"] },
    { dc: 20, items: ["Bark", "Membrane (Plant)"] }
  ],

  // ----------------------------------------------------------
  // UNDEAD  |  Medicine
  // ----------------------------------------------------------
  undead: [
    { dc: 5,  items: ["Eye", "Bone", "Phial of Congealed Blood"] },
    { dc: 10, items: ["Marrow", "Pouch of Teeth", "Rancid Fat", "Bone Shards"] }, // Bone Shards — house
    { dc: 15, items: ["Ethereal Ichor", "Undying Flesh"] },
    { dc: 20, items: ["Undying Heart"] }
  ],

  // ----------------------------------------------------------
  // OTHER  |  Survival
  // Not in the source — fallback for unrecognised or homebrew types.
  // ----------------------------------------------------------
  other: [
    { dc: 5,  items: ["Flesh", "Phial of Blood"] },
    { dc: 10, items: ["Bone", "Fat"] },
    { dc: 15, items: ["Heart", "Liver"] },
    { dc: 20, items: ["Hide", "Skin"] }
  ]
};
