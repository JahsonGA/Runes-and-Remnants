// =========================================================
// Runes & Remnants — Harvest Table
// Maps each D&D 5e creature type to harvestable material tiers.
//
// Each tier is { dc, items[] } where:
//   dc    — flat roll total the harvester must meet or exceed
//   items — exact item names matching the harvest-items compendium
//
// Tiers are additive: meeting DC 15 also grants DC 10 items.
// Essence drops are handled separately by getEssenceByCR().
// =========================================================

/**
 * @typedef {{ dc: number, items: string[] }} HarvestTier
 * @type {Record<string, HarvestTier[]>}
 */
export const HARVEST_TABLE = {

  // ----------------------------------------------------------
  // ABERRATION  |  Arcana
  // Alien anatomy: warped organs, alien sensory tissue,
  // psychic matter, and corrosive fluids.
  // ----------------------------------------------------------
  aberration: [
    { dc: 10, items: ["Tentacle", "Eye", "Phial of Blood"] },
    { dc: 15, items: ["Antenna", "Main Eye", "Ethereal Ichor"] },
    { dc: 20, items: ["Brain", "Phial of Mucus"] }
  ],

  // ----------------------------------------------------------
  // BEAST  |  Survival
  // Natural animals: hides, bones, blood, and useful organs.
  // ----------------------------------------------------------
  beast: [
    { dc: 10, items: ["Hide", "Flesh", "Bone", "Fin"] },
    { dc: 15, items: ["Pelt", "Phial of Blood", "Heart", "Pouch of Claws", "Egg"] },
    { dc: 20, items: ["Marrow", "Liver", "Fat", "Antler"] }
  ],

  // ----------------------------------------------------------
  // CELESTIAL  |  Religion
  // Divine flesh: radiant blood, sacred feathers, and
  // pure essence.
  // ----------------------------------------------------------
  celestial: [
    { dc: 10, items: ["Phial of Blood", "Pouch of Feathers", "Flesh"] },
    { dc: 15, items: ["Lifespark", "Ethereal Ichor", "Heart"] },
    { dc: 20, items: ["Soul", "Bone"] }
  ],

  // ----------------------------------------------------------
  // CONSTRUCT  |  Investigation
  // Mechanical assembly: gears, plating, and arcane
  // schematics recovered from the frame.
  // ----------------------------------------------------------
  construct: [
    { dc: 10, items: ["Gears", "Stone"] },
    { dc: 15, items: ["Plating", "Instructions"] },
    { dc: 20, items: ["Phial of Oil", "Lifespark"] }
  ],

  // ----------------------------------------------------------
  // DRAGON  |  Survival
  // Apex predators: dense scale, volatile breath organs,
  // and corrosive blood.
  // ----------------------------------------------------------
  dragon: [
    { dc: 10, items: ["Pouch of Scales", "Bone", "Flesh"] },
    { dc: 15, items: ["Talon", "Breath Sac", "Phial of Blood", "Phial of acid"] },
    { dc: 20, items: ["Horn", "Heart", "Marrow"] }
  ],

  // ----------------------------------------------------------
  // ELEMENTAL  |  Arcana
  // Living elemental matter: volatile essence,
  // raw stone, and pure energy residue.
  // ----------------------------------------------------------
  elemental: [
    { dc: 10, items: ["Stone", "Phial of Blood"] },
    { dc: 15, items: ["Lifespark", "Phial of acid"] },
    { dc: 20, items: ["Ethereal Ichor", "Soul"] }
  ],

  // ----------------------------------------------------------
  // FEY  |  Arcana
  // Otherworldly matter: dream-dust, volatile
  // consciousness, and glamour-saturated tissue.
  // ----------------------------------------------------------
  fey: [
    { dc: 10, items: ["Hair", "Pouch of Feathers", "Phial of Blood"] },
    { dc: 15, items: ["Pouch of Dust", "Phial of Wax", "Skin"] },
    { dc: 20, items: ["Psyche", "Eye"] }
  ],

  // ----------------------------------------------------------
  // FIEND  |  Religion
  // Infernal flesh: corrupted blood, hellbound souls,
  // and calcified demonic bone.
  // ----------------------------------------------------------
  fiend: [
    { dc: 10, items: ["Bone", "Phial of Blood", "Flesh", "Rancid Fat"] },
    { dc: 15, items: ["Phial of Congealed Blood", "Hide", "Pouch of Teeth"] },
    { dc: 20, items: ["Soul", "Heart", "Tusk"] }
  ],

  // ----------------------------------------------------------
  // GIANT  |  Medicine
  // Oversized humanoid anatomy: dense bone, massive
  // organs, and thick tissue.
  // ----------------------------------------------------------
  giant: [
    { dc: 10, items: ["Bone", "Flesh", "Fat"] },
    { dc: 15, items: ["Tusk", "Horn", "Hair", "Marrow"] },
    { dc: 20, items: ["Heart", "Liver", "Phial of Blood"] }
  ],

  // ----------------------------------------------------------
  // HUMANOID  |  Medicine
  // Mortal anatomy: blood, soft tissue, nervous
  // matter, and sensory organs.
  // ----------------------------------------------------------
  humanoid: [
    { dc: 10, items: ["Bone", "Flesh", "Phial of Blood"] },
    { dc: 15, items: ["Hair", "Skin", "Liver"] },
    { dc: 20, items: ["Brain", "Heart", "Tongue"] }
  ],

  // ----------------------------------------------------------
  // MONSTROSITY  |  Survival
  // Unnatural predators: chitin, venom glands,
  // silk organs, and biological weapons.
  // ----------------------------------------------------------
  monstrosity: [
    { dc: 10, items: ["Hide", "Chitin", "Flesh", "Fin"] },
    { dc: 15, items: ["Stinger", "Pincer", "Beak", "Poison Gland (Material)"] },
    { dc: 20, items: ["Silk Sack", "Heart", "Poison Gland (Poison)", "Spider Milk"] }
  ],

  // ----------------------------------------------------------
  // OOZE  |  Nature
  // Amorphous matter: caustic acids, unstable membranes,
  // and congealed cellular residue.
  // ----------------------------------------------------------
  ooze: [
    { dc: 10, items: ["Phial of Mucus", "Membrane"] },
    { dc: 15, items: ["Vesicle", "Phial of acid"] },
    { dc: 20, items: ["Phial of Blood", "Rancid Fat"] }
  ],

  // ----------------------------------------------------------
  // PLANT  |  Nature
  // Vegetative anatomy: bark, sap, and reproductive
  // spores or fungal structures.
  // ----------------------------------------------------------
  plant: [
    { dc: 10, items: ["Bark", "Pouch of Leaves"] },
    { dc: 15, items: ["Phial of Sap", "Tuber", "Membrane"] },
    { dc: 20, items: ["Pouch of Pollen", "Pouch of Spore", "Pouch of Hyphae"] }
  ],

  // ----------------------------------------------------------
  // UNDEAD  |  Medicine
  // Animate corpse matter: necrotic tissue, congealed
  // blood, and trapped souls.
  // ----------------------------------------------------------
  undead: [
    { dc: 10, items: ["Bone", "Undying Flesh"] },
    { dc: 15, items: ["Phial of Congealed Blood", "Marrow", "Rancid Fat"] },
    { dc: 20, items: ["Undying Heart", "Soul", "Brain"] }
  ],

  // ----------------------------------------------------------
  // OTHER  |  Survival
  // Fallback for unrecognized or unusual creature types.
  // ----------------------------------------------------------
  other: [
    { dc: 10, items: ["Flesh", "Bone", "Phial of Blood"] },
    { dc: 15, items: ["Hide", "Heart"] },
    { dc: 20, items: ["Marrow"] }
  ]
};
