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
   ESSENCE / REMNANT TABLE
--------------------------------------------- */
// Names match compendium item names exactly (runes-and-remnants.harvest-items).
/**
 * The remnant a corpse yields, by CR.
 *
 * Called "Essence" until the module was named for these; `legacyName` keeps
 * items already in a world working, since everything here is matched by name
 * and a rename would otherwise make a party's hard-won essences invisible.
 */
export const ESSENCE_TABLE = [
  { crMin: 3,  crMax: 6,  dc: 25, name: "Remnant (Frail)",  legacyName: "Essence (Frail)",  rarity: "uncommon"  },
  { crMin: 7,  crMax: 11, dc: 30, name: "Remnant (Robust)", legacyName: "Essence (Robust)", rarity: "rare"      },
  { crMin: 12, crMax: 17, dc: 35, name: "Remnant (Potent)", legacyName: "Essence (Potent)", rarity: "veryRare"  },
  { crMin: 18, crMax: 24, dc: 40, name: "Remnant (Mythic)", legacyName: "Essence (Mythic)", rarity: "legendary" },
  { crMin: 25, crMax: 99, dc: 50, name: "Remnant (Deific)", legacyName: "Essence (Deific)", rarity: "artifact"  }
];

/**
 * Which remnant a corpse yields, by CR.
 *
 * CR 0–2 falls through to the weakest tier — at a slightly easier DC, since
 * nothing that small is hiding much. Taken from the table rather than written
 * out again, so a rename can never leave this one line behind.
 */
export function getEssenceByCR(cr) {
  const entry = ESSENCE_TABLE.find(e => cr >= e.crMin && cr <= e.crMax);
  if (entry) return entry;
  return { ...ESSENCE_TABLE[0], dc: 20 };
}

/* ---------------------------------------------
   DIFFICULTY COMPUTATION
--------------------------------------------- */

/**
 * Computes a CR/type/rarity-scaled DC.
 *
 * NOTE: This is **not** used by the harvest workflow. Harvesting is gated by
 * the cumulative Harvest DCs built from per-component costs — see
 * buildHarvestList. This helper remains exported for macros and third-party
 * callers that want a single scaled difficulty number.
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
  const roll = await (new Roll("1d20 + @mod", { mod })).evaluate();
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
  const roll = await (new Roll(formula, { mod })).evaluate();

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
  const roll = await (new Roll(formula, { mod })).evaluate();

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
/**
 * Lowest DC this component is ever worth, across every creature type.
 *
 * Used when a part in someone's pack predates origin stamping, or was made
 * by hand. Deliberately the *lowest* — an unlabelled heart should not be
 * assumed to have come off a dragon.
 */
export function lowestComponentDC(name) {
  if (!name) return null;
  const key = String(name).toLowerCase();
  let lowest = null;
  for (const tiers of Object.values(HARVEST_TABLE)) {
    for (const tier of tiers) {
      if (!tier.items.some(i => i.toLowerCase() === key)) continue;
      if (lowest === null || tier.dc < lowest) lowest = tier.dc;
    }
  }

  // Essences are not in HARVEST_TABLE — they have their own CR-scaled ladder.
  // Without this an unstamped essence returned null, partFromItem dropped it,
  // and the Enchanting tab reported no remnants while one sat in the pack.
  if (lowest === null) return essenceDC(name);
  return lowest;
}

/** True when this name is one of the essences, whatever its origin says. */
export function isEssenceName(name) {
  return essenceDC(name) !== null;
}

/**
 * The DC of a named remnant, or null if it is not one.
 *
 * Matches the old "Essence (…)" spelling as well, so a party's existing
 * remnants keep working after the rename.
 */
export function essenceDC(name) {
  if (!name) return null;
  const key = String(name).toLowerCase();
  const found = ESSENCE_TABLE.find(e =>
    e.name.toLowerCase() === key || e.legacyName?.toLowerCase() === key);
  return found?.dc ?? null;
}

/**
 * @param {object} [origin] Where the part came from — { creatureType, cr, dc,
 *   essence }. Stamped onto the granted item so crafting can weigh it later
 *   without guessing; a Heart is worth more off a dragon than off a goblin.
 */
export async function grantMaterial({ item, qty = 1, toActor = null, dropAt = null, origin = null }) {
  let q = Number(qty);
  if (Number.isNaN(q)) {
    try { q = (await new Roll(String(qty)).evaluate()).total; }
    catch { q = 1; }
  }
  q = Math.max(1, Math.floor(q));

  const pilesActive = game.modules.get("item-piles")?.active;
  if (dropAt && pilesActive) {
    const api = game.modules.get("item-piles")?.api;
    if (api?.createItemPile) {
      const data = stampOrigin(item.toObject(), origin);
      data.system = data.system || {};
      data.system.quantity = q;
      await api.createItemPile(dropAt, { items: [data] });
      return;
    }
  }

  if (toActor) {
    const data = stampOrigin(item.toObject(), origin);
    data.system = data.system || {};
    data.system.quantity = q;
    await toActor.createEmbeddedDocuments("Item", [data]);
  }
}

/**
 * Record where a component came from, in the module's own flag namespace so
 * it survives export/import and never collides with the system's fields.
 */
export function stampOrigin(data, origin) {
  if (!origin) return data;
  data.flags = data.flags || {};
  data.flags[MODULE_ID] = { ...(data.flags[MODULE_ID] ?? {}), origin };
  return data;
}

/* ---------------------------------------------
   COMPENDIUM DUPLICATE RESOLUTION
--------------------------------------------- */

/**
 * Type-hints for disambiguating compendium items that share a name.
 *
 * Structure: { itemName: { creatureType: { fieldKey: expectedValue } } }
 *
 * The shipped pack no longer has duplicate names — the former collisions
 * ("Bone", "Hair", "Membrane") were renamed to "Bone Shards", "Fur",
 * "Membrane (Ooze)" and "Membrane (Plant)", because item names are the join
 * key between HARVEST_TABLE and the compendium. This map is kept empty as an
 * extension point for worlds that add their own same-named variants.
 */
export const DUPLICATE_RESOLVER = {};

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
   EXECUTION AUTHORITY
--------------------------------------------- */

/**
 * Picks the single client responsible for executing a harvest.
 *
 * The menu is broadcast to every connected client, so without one designated
 * executor any of them could run the harvest and grant the loot again. The
 * rule is "the active GM with the lowest user id" — deterministic, so every
 * client independently agrees on the same answer without needing to negotiate.
 *
 * Foundry exposes `game.users.activeGM`, but it is not present on every
 * version, so this resolves the same rule from a plain user list.
 *
 * @param {Array<{id: string, active: boolean, isGM: boolean}>} users
 * @returns {string|null} the executor's user id, or null if no GM is connected
 */
export function pickExecutorId(users = []) {
  const gmIds = (users ?? [])
    .filter(u => u?.active && u?.isGM && u?.id)
    .map(u => u.id);

  if (!gmIds.length) return null;
  return gmIds.sort((a, b) => String(a).localeCompare(String(b)))[0];
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
   HARVEST LIST  (cumulative DCs)
--------------------------------------------- */

/**
 * Looks up the component DC for a single component name.
 *
 * Essence is not in HARVEST_TABLE — it is appended to every creature's table
 * and priced by CR instead, so it is resolved separately.
 *
 * @returns {number|null} null when the name belongs to neither source
 */
export function getComponentDC(type, name, cr = 0) {
  const essence = getEssenceByCR(Number(cr) || 0);
  if (name === essence.name) return essence.dc;

  for (const tier of getHarvestOptions(type)) {
    if (tier.items.includes(name)) return tier.dc;
  }
  return null;
}

/**
 * Builds the harvest list: the chosen components in the harvesters' chosen
 * order, each carrying its own component DC and the running Harvest DC that
 * must be met to extract it.
 *
 * The running total is what makes ordering a real decision — putting an
 * expensive component early pushes everything after it out of reach, so a
 * party trades breadth against the one part they actually came for.
 *
 * Order is preserved exactly as given; components may repeat, since a
 * creature can yield more than one of the same part.
 *
 * @param {string[]} orderedNames  components in the order they'll be taken
 * @param {string}   type          creature type, for component DC lookup
 * @param {number}   cr            challenge rating, for essence pricing
 * @returns {Array<{name, componentDC, harvestDC, order, unknown}>}
 */
export function buildHarvestList(orderedNames = [], type = "other", cr = 0) {
  let running = 0;

  return orderedNames.map((name, i) => {
    const componentDC = getComponentDC(type, name, cr);
    const known = componentDC !== null;

    // An unrecognised name would silently corrupt every later Harvest DC,
    // so it contributes nothing and is flagged instead.
    if (known) running += componentDC;

    return {
      name,
      order: i + 1,
      componentDC: known ? componentDC : null,
      harvestDC: running,
      unknown: !known
    };
  });
}

/**
 * Resolves a harvest list against a Harvesting check result.
 *
 * A component is extracted if the check met or exceeded its Harvest DC.
 * Because the running total only ever increases, this is the leading run of
 * the list — the party gets everything up to the point the corpse beat them.
 *
 * @returns {{ awarded: object[], missed: object[], total: number }}
 */
export function resolveHarvest(harvestList = [], checkTotal = 0) {
  const usable = harvestList.filter(e => !e.unknown);
  return {
    awarded: usable.filter(e => checkTotal >= e.harvestDC),
    missed:  usable.filter(e => checkTotal <  e.harvestDC),
    total: checkTotal
  };
}

/* ---------------------------------------------
   RESULT INTERPRETATION
--------------------------------------------- */

/**
 * Derives an outcome label from how much of the harvest list was extracted.
 *
 * @param {number} awardedCount  components successfully extracted
 * @param {number} listLength    components the harvesters asked for
 */
export function harvestOutcome(awardedCount, listLength) {
  if (listLength <= 0) return "failure";
  if (awardedCount <= 0) return "failure";
  if (awardedCount >= listLength) return "critical-success";
  if (awardedCount === 1) return "partial";
  return "success";
}

/**
 * Determines success level based on DC and total roll.
 * Retained for macros and third-party callers.
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
