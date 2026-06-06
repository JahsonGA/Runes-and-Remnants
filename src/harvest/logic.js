// =========================================================
// Runes & Remnants — Harvest Logic
// =========================================================

import { HARVEST_TABLE } from "../data/harvest-table.js";

export const MODULE_ID = "runes-and-remnants";

/* ---------------------------------------------
   TYPE & RARITY MODIFIERS
--------------------------------------------- */
export const TYPE_MOD = {
  aberration: 2, beast: 0, celestial: 2, construct: 3, dragon: 4, elemental: 2,
  fey: 2, fiend: 3, giant: 1, humanoid: 0, monstrosity: 2, ooze: 1,
  plant: 1, undead: 3, other: 0
};

/** Mapping creature types to their associated harvest skills */
export const HARVEST_SKILL_BY_TYPE = {
  aberration: "Arcana",
  beast: "Survival",
  celestial: "Religion",
  construct: "Investigation",
  dragon: "Survival",
  elemental: "Arcana",
  fey: "Arcana",
  fiend: "Religion",
  giant: "Medicine",
  humanoid: "Medicine",
  monstrosity: "Survival",
  ooze: "Nature",
  plant: "Nature",
  undead: "Medicine",
  other: "Survival"
};

/** Rarity difficulty modifiers */
export const RARITY_MOD = {
  common: 0,
  uncommon: 2,
  rare: 5,
  "very-rare": 8,
  legendary: 10
};

/* ---------------------------------------------
   DATA LOADERS  (legacy — no longer used)
--------------------------------------------- */

/**
 * @deprecated  Harvest data now comes from HARVEST_TABLE (src/data/harvest-table.js)
 *              and the "runes-and-remnants.harvest-items" compendium.
 *              The JSON files this function fetched no longer exist.
 */
export async function loadHarvestData() {
  console.warn(`[${MODULE_ID}] loadHarvestData() is deprecated and does nothing.`);
}

/* ---------------------------------------------
   ESSENCE / REMNANT TABLE
--------------------------------------------- */
// Names match compendium item names exactly (runes-and-remnants.harvest-items).
export const ESSENCE_TABLE = [
  { crMin: 3,  crMax: 6,  dc: 25, name: "Essence (Frail)",  rarity: "uncommon" },
  { crMin: 7,  crMax: 11, dc: 30, name: "Essence (Robust)", rarity: "rare"      },
  { crMin: 12, crMax: 17, dc: 35, name: "Essence (Potent)", rarity: "veryRare"  },
  { crMin: 18, crMax: 24, dc: 40, name: "Essence (Mythic)", rarity: "legendary" },
  { crMin: 25, crMax: 99, dc: 50, name: "Essence (Deific)", rarity: "artifact"  }
];

/**
 * Determines which essence type drops based on CR.
 * CR 0-2 creatures drop the lowest tier by default.
 */
export function getEssenceByCR(cr) {
  const entry = ESSENCE_TABLE.find(e => cr >= e.crMin && cr <= e.crMax);
  return entry ?? { name: "Essence (Frail)", rarity: "uncommon", dc: 20 };
}

/* ---------------------------------------------
   DIFFICULTY COMPUTATION
--------------------------------------------- */

/**
 * Computes the DC for harvesting based on CR, rarity, and type.
 */
export function computeHarvestDC({
  cr = 0,
  type = "other",
  rarity = "common",
  rarityMultiplier = null,
  baseDC = 10
}) {
  const t = (String(type || "other").toLowerCase());
  const typeMod = TYPE_MOD[t] ?? TYPE_MOD.other;

  let rarityMod;
  if (rarityMultiplier !== null && !Number.isNaN(Number(rarityMultiplier))) {
    rarityMod = Number(rarityMultiplier);
  } else {
    const r = (String(rarity || "common").toLowerCase());
    rarityMod = RARITY_MOD[r] ?? 0;
  }

  const crMod = Math.floor(Number(cr || 0) / 2);
  return Math.max(5, baseDC + crMod + typeMod + rarityMod);
}

/* ---------------------------------------------
   SKILL ROLL HELPERS
--------------------------------------------- */

/**
 * Returns the best of a list of skill keys for an actor.
 */
export function bestSkillFor(actor, skills = ["sur"]) {
  const bag = actor?.system?.skills || {};
  let best = { key: skills[0], mod: -Infinity };
  for (const k of skills) {
    const s = bag[k];
    const mod = (s?.total ?? s?.mod ?? -Infinity);
    if (mod > best.mod) best = { key: k, mod };
  }
  return best;
}

/**
 * Rolls a skill check generically.
 */
export async function rollSkillCheck(actor, skillKey, label = "Harvest Check") {
  const bag = actor?.system?.skills || {};
  const mod = (bag[skillKey]?.total ?? bag[skillKey]?.mod ?? 0);
  const roll = await (new Roll("1d20 + @mod", { mod })).evaluate({ async: true });
  await roll.toMessage({
    flavor: `${label} — ${actor.name} (${skillKey.toUpperCase()})`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
  return { total: roll.total, roll };
}

/* ---------------------------------------------
   ROLE-SPECIFIC ROLLS
--------------------------------------------- */

/**
 * Performs the Assessment (Intelligence-based) roll.
 * This roll identifies harvesting method and weak points.
 */
export async function rollAssessment(actor, creatureType = "other", options = {}) {
  const skillName = HARVEST_SKILL_BY_TYPE[String(creatureType).toLowerCase()] ?? "Survival";
  const skillKey = skillName.toLowerCase().slice(0, 3);

  const intMod = actor.system?.abilities?.int?.mod ?? 0;
  const skill = actor.system?.skills?.[skillKey];
  const prof = skill?.prof > 0 ? (actor.system?.attributes?.prof ?? 2) : 0;
  const mod = intMod + prof;

  const formula = options.disadvantage ? "2d20kl1 + @mod" : "1d20 + @mod";
  const roll = await (new Roll(formula, { mod })).evaluate({ async: true });

  await roll.toMessage({
    flavor: `${options.disadvantage ? "Disadvantaged " : ""}Assessment Check (${skillName}) — ${actor.name}`,
    speaker: ChatMessage.getSpeaker({ actor })
  });

  return { total: roll.total, skillName };
}


/**
 * Performs the Carving (Dexterity-based) roll.
 * This roll extracts materials from the target.
 */
export async function rollCarving(actor, creatureType = "other", options = {}) {
  const skillName = HARVEST_SKILL_BY_TYPE[String(creatureType).toLowerCase()] ?? "Survival";
  const skillKey = skillName.toLowerCase().slice(0, 3);

  const dexMod = actor.system?.abilities?.dex?.mod ?? 0;
  const skill = actor.system?.skills?.[skillKey];
  const prof = skill?.prof > 0 ? (actor.system?.attributes?.prof ?? 2) : 0;
  const mod = dexMod + prof;

  // Only applies disadvantage if passed from menu.js
  const formula = options.disadvantage ? "2d20kl1 + @mod" : "1d20 + @mod";
  const roll = await (new Roll(formula, { mod })).evaluate({ async: true });

  await roll.toMessage({
    flavor: `${options.disadvantage ? "Disadvantaged " : ""}Carving Check (${skillName}) — ${actor.name}`,
    speaker: ChatMessage.getSpeaker({ actor })
  });

  return { total: roll.total, skillName };
}

/* ---------------------------------------------
   HELPER BONUS COMPUTATION
--------------------------------------------- */

/**
 * Computes total helper contribution and cap based on size.
 * Helpers add full proficiency if trained, half if untrained.
 */
export function computeHelperBonus(helpers = [], skillKey = "sur", sizeKey = "med") {
  const sizeCap = { tiny: 0, sm: 1, med: 2, lg: 4, huge: 6, grg: 10 }[sizeKey?.toLowerCase?.()] ?? 3;
  const breakdown = [];
  let total = 0;

  for (let i = 0; i < Math.min(helpers.length, sizeCap); i++) {
    const helper = helpers[i];
    const actor = game.actors.get(helper.actorId);
    if (!actor) continue;

    const prof = actor.system?.attributes?.prof ?? 2;
    const skill = actor.system?.skills?.[skillKey];
    const proficient = skill?.prof > 0;
    const contribution = proficient ? prof : Math.floor(prof / 2);

    total += contribution;
    breakdown.push({ name: helper.name, contribution, proficient });
  }

  return { total, breakdown, cap: sizeCap };
}

/* ---------------------------------------------
   MATERIAL GRANTING
--------------------------------------------- */

/**
 * Grants harvested materials to an actor or drops them on the map.
 */
export async function grantMaterial({ item, qty = 1, toActor = null, dropAt = null }) {
  let q = Number(qty);
  if (Number.isNaN(q)) {
    try { q = await (await new Roll(String(qty)).evaluate({ async: true })).total; }
    catch { q = 1; }
  }
  q = Math.max(1, Math.floor(q));

  const pilesActive = game.modules.get("item-piles")?.active;
  if (dropAt && pilesActive) {
    const api = game.modules.get("item-piles")?.api;
    if (api?.createItemPile) {
      const data = item.toObject();
      data.system = data.system || {};
      data.system.quantity = q;
      await api.createItemPile(dropAt, { items: [data] });
      return;
    }
  }

  if (toActor) {
    const data = item.toObject();
    data.system = data.system || {};
    data.system.quantity = q;
    await toActor.createEmbeddedDocuments("Item", [data]);
  }
}

/* ---------------------------------------------
   COMPENDIUM DUPLICATE RESOLUTION
--------------------------------------------- */

/**
 * Some compendium items share a name but represent different things
 * (e.g. "Membrane" for ooze vs. plant). This map provides type-hints
 * so findCompendiumEntry can pick the right variant.
 *
 * Structure: { itemName: { creatureType: { fieldKey: expectedValue } } }
 */
export const DUPLICATE_RESOLVER = {
  "Membrane": {
    ooze:  { type: "loot"       }, // "The balloon-like surface of the Ooze"
    plant: { type: "consumable" }  // "The membrane of a plant."
  }
};

/**
 * Finds the best matching compendium index entry for an item name,
 * using DUPLICATE_RESOLVER to pick the correct variant when multiple
 * entries share the same name.
 *
 * @param {object[]} loot         - compendium index array (from pack.getIndex())
 * @param {string}   itemName     - exact item name to find
 * @param {string}   creatureType - creature type being harvested (for disambiguation)
 * @returns {object|null}
 */
export function findCompendiumEntry(loot, itemName, creatureType) {
  const candidates = loot.filter(i => i.name === itemName);
  if (candidates.length <= 1) return candidates[0] ?? null;

  const t = String(creatureType || "other").toLowerCase();
  const hints = DUPLICATE_RESOLVER[itemName]?.[t];
  if (hints) {
    const match = candidates.find(c =>
      Object.entries(hints).every(([k, v]) => c[k] === v)
    );
    if (match) return match;
  }

  return candidates[0];
}

/* ---------------------------------------------
   HARVEST TABLE LOOKUP
--------------------------------------------- */

/**
 * Retrieves harvestable DC tiers for a given creature type.
 * Returns an array of { dc, items[] } tiers sourced from HARVEST_TABLE.
 * Falls back to "other" if the type is unrecognized.
 */
export function getHarvestOptions(type) {
  const t = String(type || "other").toLowerCase();
  return HARVEST_TABLE[t] ?? HARVEST_TABLE.other ?? [];
}

/* ---------------------------------------------
   RESULT INTERPRETATION
--------------------------------------------- */

/**
 * Determines success level based on DC and total roll.
 */
export function finalHarvestResult(dc, total) {
  if (total >= dc + 10) return "critical-success";
  if (total >= dc) return "success";
  if (total <= dc - 10) return "critical-failure";
  return "failure";
}

/**
 * Legacy alias for tests or older macros.
 */
export function rollOutcome({ rollTotal, dc }) {
  return finalHarvestResult(dc, rollTotal);
}
