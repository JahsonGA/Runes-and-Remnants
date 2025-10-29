// ========================= Runes & Remnants: Harvest Logic =========================
export const MODULE_ID = "runes-and-remnants";

/* ---------- TYPE & RARITY MODIFIERS ---------- */
export const TYPE_MOD = {
  aberration: 2, beast: 0, celestial: 2, construct: 3, dragon: 4, elemental: 2,
  fey: 2, fiend: 3, giant: 1, humanoid: 0, monstrosity: 2, ooze: 1, plant: 1, undead: 3, other: 0
};

/**
 * Harvesting skill associations by creature type
 * (Used for both assessment and harvesting phases)
 */
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


export const RARITY_MOD = {
  common: 0, uncommon: 2, rare: 5, "very-rare": 8, legendary: 10
};

/* ---------- LOAD HARVEST DATA ---------- */
export async function loadHarvestData() {
  const [tableRes, itemsRes] = await Promise.all([
    fetch("modules/runes-and-remnants/data/harvest-table.json"),
    fetch("modules/runes-and-remnants/data/harvest-items.json")
  ]);
  game.rnrHarvestTable = await tableRes.json();
  game.rnrHarvestItems = await itemsRes.json();
}

/* ---------- ESSENCE (REMNANT) TABLE ---------- */
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

/* ---------- DC COMPUTATION ---------- */
export function computeHarvestDC({
  cr = 0,
  type = "other",
  rarity = "common",
  rarityMultiplier = null,
  baseDC = 10
}) {
  const t = (String(type || "other").toLowerCase());
  const typeMod = TYPE_MOD[t] ?? TYPE_MOD.other;

  // Compute rarity mod
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

/* ---------- SKILL ROLL UTILITIES ---------- */
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

/* ---------- ROLE-SPECIFIC ROLLS ---------- */
/**
 * Performs the Assessment (Int-based) roll
 * @param {Actor5e} actor
 * @param {string} creatureType
 */
export async function rollAssessment(actor, creatureType = "other") {
  const skillName = HARVEST_SKILL_BY_TYPE[String(creatureType).toLowerCase()] ?? "Survival";
  const skillKey = skillName.toLowerCase().slice(0, 3); // e.g., Arcana → arc

  const intMod = actor.system?.abilities?.int?.mod ?? 0;
  const skill = actor.system?.skills?.[skillKey];
  const prof = skill?.prof > 0 ? (actor.system?.attributes?.prof ?? 2) : 0;
  const mod = intMod + prof;

  const roll = await (new Roll("1d20 + @mod", { mod })).evaluate({ async: true });
  await roll.toMessage({
    flavor: `🧠 Assessment Check (${skillName}) — ${actor.name}`,
    speaker: ChatMessage.getSpeaker({ actor })
  });

  return { total: roll.total, skillName };
}

/**
 * Performs the Carving (Dex-based) roll
 * @param {Actor5e} actor
 * @param {string} creatureType
 */
export async function rollCarving(actor, creatureType = "other", options = {}) {
  const skillName = HARVEST_SKILL_BY_TYPE[String(creatureType).toLowerCase()] ?? "Survival";
  const skillKey = skillName.toLowerCase().slice(0, 3);

  const dexMod = actor.system?.abilities?.dex?.mod ?? 0;
  const skill = actor.system?.skills?.[skillKey];
  const prof = skill?.prof > 0 ? (actor.system?.attributes?.prof ?? 2) : 0;
  const mod = dexMod + prof;

  const formula = options.disadvantage ? "2d20kh1 + @mod" : "1d20 + @mod";
  const roll = await (new Roll(formula, { mod })).evaluate({ async: true });

  await roll.toMessage({
    flavor: `${options.disadvantage ? "Disadvantaged " : ""}🔪 Carving Check (${skillName}) — ${actor.name}`,
    speaker: ChatMessage.getSpeaker({ actor })
  });

  return { total: roll.total, skillName };
}




/* ---------- HELPERS ---------- */
export function computeHelperBonus(helpers = [], skillKey = "sur", sizeKey = "med") {
  if (!helpers.length) return { total: 0, breakdown: [] };

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

/* ---------- ITEM GRANTING ---------- */
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

/* ---------- HARVEST TABLE LOOKUP ---------- */
export function getHarvestOptions(type) {
  const t = String(type || "other").toLowerCase();
  return game.rnrHarvestTable?.find(e => e.creatureType === t)?.components ?? [];
}

/* ---------- FINAL OUTCOME ---------- */
export function finalHarvestResult(dc, total) {
  if (total >= dc + 10) return "critical-success";
  if (total >= dc) return "success";
  if (total <= dc - 10) return "critical-failure";
  return "failure";
}

/**
 * Compatibility alias for tests expecting rollOutcome()
 * Uses same logic as finalHarvestResult()
 */
export function rollOutcome({ rollTotal, dc }) {
  return finalHarvestResult(dc, rollTotal);
}