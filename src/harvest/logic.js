// src/harvest/logic.js
export const MODULE_ID = "runes-and-remnants";

/** Type and rarity modifiers (tune later / or override via flags on items) */
export const TYPE_MOD = {
  aberration: 2, beast: 0, celestial: 2, construct: 3, dragon: 4, elemental: 2,
  fey: 2, fiend: 3, giant: 1, humanoid: 0, monstrosity: 2, ooze: 1, plant: 1, undead: 3, other: 0
};

export async function loadHarvestData() {
  const [tableRes, itemsRes] = await Promise.all([
    fetch("modules/runes-and-remnants/data/harvest-table.json"),
    fetch("modules/runes-and-remnants/data/harvest-items.json")
  ]);
  game.rnrHarvestTable = await tableRes.json();
  game.rnrHarvestItems = await itemsRes.json();
}

// loader for normalized data:
export const ESSENCE_TABLE = [
  { crMin: 3, crMax: 6, dc: 25, name: "Frail Remnant", rarity: "uncommon" },
  { crMin: 7, crMax: 11, dc: 30, name: "Robust Remnant", rarity: "rare" },
  { crMin: 12, crMax: 17, dc: 35, name: "Potent Remnant", rarity: "very-rare" },
  { crMin: 18, crMax: 24, dc: 40, name: "Mythic Remnant", rarity: "legendary" },
  { crMin: 25, crMax: 99, dc: 50, name: "Deific Remnant", rarity: "artifact" }
];

export function getEssenceByCR(cr) {
  const entry = ESSENCE_TABLE.find(e => cr >= e.crMin && cr <= e.crMax);
  return entry ?? { name: "Frail Remnant", rarity: "uncommon", dc: 20 };
}


export const RARITY_MOD = {
  common: 0, uncommon: 2, rare: 5, "very-rare": 8, legendary: 10
};

/** Compute DC from CR, type, rarity, and optional baseDC */
export function computeHarvestDC({
  cr = 0,
  type = "other",
  rarity = "common",
  rarityMultiplier = null,
  baseDC = 10
}) {
  const t = (String(type || "other").toLowerCase());
  const typeMod = TYPE_MOD[t] ?? TYPE_MOD.other;

  // If rarityMultiplier provided, use it directly
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

/** Outcome bands */
export function rollOutcome({ rollTotal, dc }) {
  if (rollTotal >= dc + 10) return "critical-success";
  if (rollTotal >= dc) return "success";
  if (rollTotal <= dc - 10) return "critical-failure";
  return "failure";
}

/** Pick best skill (by mod) from a list */
export function bestSkillFor(actor, skills = ["sur"]) {
  // dnd5e keys: sur (Survival), med (Medicine), nat (Nature), arc (Arcana), inv (Investigation)
  const bag = actor?.system?.skills || {};
  let best = { key: skills[0], mod: -Infinity };
  for (const k of skills) {
    const s = bag[k];
    const mod = (s?.total ?? s?.mod ?? -Infinity);
    if (mod > best.mod) best = { key: k, mod };
  }
  return best;
}

/** Roll a d20 skill check and post to chat; returns { total, roll } */
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

/** Grant item to actor (inventory) or drop as Item Pile at a token's location */
export async function grantMaterial({ item, qty = 1, toActor = null, dropAt = null }) {
  // Normalize quantity
  let q = Number(qty);
  if (Number.isNaN(q)) {
    try { q = await (await new Roll(String(qty)).evaluate({ async: true })).total; }
    catch { q = 1; }
  }
  q = Math.max(1, Math.floor(q));

  // If Item Piles present & drop position provided, drop a pile
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

  // Otherwise, give directly to actor (fallback)
  if (toActor) {
    const data = item.toObject();
    data.system = data.system || {};
    data.system.quantity = q;
    await toActor.createEmbeddedDocuments("Item", [data]);
  }
}

/* ========================= HARVEST DATA HELPERS ========================= */

/**
 * Compute helper bonus based on their proficiency and creature size.
 * @param {Array} helpers - Array of helper data objects
 * @param {string} skillKey - The harvester’s skill being used
 * @param {string} sizeKey - Creature size (tiny, sm, med, lg, huge, grg)
 */
export function computeHelperBonus(helpers = [], skillKey = "sur", sizeKey = "med") {
  if (!helpers.length) return { total: 0, breakdown: [] };

  const sizeCap = {
    tiny: 1,
    sm: 2,
    med: 3,
    lg: 5,
    huge: 7,
    grg: 11
  }[sizeKey?.toLowerCase?.()] ?? 3;

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


/**
 * Return harvest options for a given creature type.
 * Looks up from the normalized harvest-table.json.
 */
export function getHarvestOptions(type) {
  const t = String(type || "other").toLowerCase();
  return game.rnrHarvestTable?.find(e => e.creatureType === t)?.components ?? [];
}

/**
 * Re-exported essence selector (already present above)
 * Kept for clarity; can be reused wherever needed.
 */
export { getEssenceByCR };

/**
 * Unified DC calculator — combines base, rarity, and size modifiers.
 * Used for both assessment and harvest checks.
 */
export function calculateDC({ baseDC = 10, rarity = "common", size = "med" }) {
  const sizeModMap = { tiny: -2, sm: -1, med: 0, lg: +1, huge: +3, grg: +5 };
  const rarityMod = RARITY_MOD[String(rarity).toLowerCase()] ?? 0;
  const sizeMod = sizeModMap[String(size).toLowerCase()] ?? 0;
  return Math.max(5, baseDC + rarityMod + sizeMod);
}

/* ========================= ROLL HELPERS ========================= */

/**
 * Performs the assessor’s roll (Int-based: Nature, Arcana, or Medicine)
 * Returns roll result object.
 */
export async function rollAssessment(actor) {
  const skill = bestSkillFor(actor, ["nat", "arc", "med"]);
  return rollSkillCheck(actor, skill.key, "Assessment (Identify Materials)");
}

/**
 * Performs the harvester’s roll (Dex or Wis: Sleight or Survival)
 * Returns roll result object.
 */
export async function rollHarvest(actor) {
  const skill = bestSkillFor(actor, ["sle", "sur"]);
  return rollSkillCheck(actor, skill.key, "Harvest Attempt");
}

/**
 * Apply helper bonuses. Defaults to +1 per helper, scaled by creature size.
 * (Larger creatures allow more coordination room.)
 */
export function applyHelperBonus(helperCount = 0, size = "med") {
  const scale = { tiny: 0.5, sm: 0.75, med: 1, lg: 1.25, huge: 1.5, grg: 2 };
  return Math.round(helperCount * (scale[size] ?? 1));
}

/**
 * Evaluate final harvest outcome string (critical-success, success, etc.)
 * Combines total and DC to give human-readable result.
 */
export function finalHarvestResult(dc, total) {
  if (total >= dc + 10) return "critical-success";
  if (total >= dc) return "success";
  if (total <= dc - 10) return "critical-failure";
  return "failure";
}

