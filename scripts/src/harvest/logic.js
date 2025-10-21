// src/harvest/logic.js
export const MODULE_ID = "runes-and-remnants";

/** Type and rarity modifiers (tune later / or override via flags on items) */
export const TYPE_MOD = {
  aberration: 2, beast: 0, celestial: 2, construct: 3, dragon: 4, elemental: 2,
  fey: 2, fiend: 3, giant: 1, humanoid: 0, monstrosity: 2, ooze: 1, plant: 1, undead: 3, other: 0
};
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
