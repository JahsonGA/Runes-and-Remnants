// =========================================================
// Runes & Remnants — Enchanting execution
//
// Rolls the binding, consumes the remnant and component, and rewrites the
// item. GM-authoritative over the socket, the same shape harvest and crafting
// use — otherwise every connected client enchants the same sword.
//
// The only Foundry-touching file in src/enchant/.
// =========================================================

import { enchantPlan, resolveEnchant, itemKind, normaliseRarity } from "./logic.js";
import { partFromItem } from "../craft/logic.js";
import { pickExecutorId } from "../harvest/logic.js";

export const MODULE_ID = "runes-and-remnants";
const REQUEST = "requestEnchant";

const inFlight = new Set();

/** Ask for a binding; run it here if this client is a GM. */
export async function requestEnchant(request) {
  if (game.user.isGM) return executeEnchant(request);
  game.socket?.emit(`module.${MODULE_ID}`, { action: REQUEST, ...request });
  ui.notifications?.info("Enchanting request sent to the GM.");
  return null;
}

export function isEnchantExecutor() {
  return game.user.id === pickExecutorId(Array.from(game.users ?? []));
}

/**
 * @param {object} payload { actorId, itemId, enchantment, remnantId,
 *                           componentId, attunement, consumable }
 */
export async function executeEnchant(payload = {}) {
  const key = `${payload.actorId}:${payload.itemId}:${payload.enchantment}`;
  if (inFlight.has(key)) return null;
  inFlight.add(key);
  try {
    return await bind(payload);
  } catch (err) {
    console.error(`${MODULE_ID} | enchanting failed`, err);
    ui.notifications?.error("Enchanting failed — see the console.");
    return null;
  } finally {
    inFlight.delete(key);
  }
}

async function bind({ actorId, itemId, enchantment, remnantId, componentId,
                      attunement = false, consumable = false }) {
  const actor = game.actors?.get(actorId);
  if (!actor) return null;

  const item = actor.items.get(itemId);
  const remnantDoc = actor.items.get(remnantId);
  const componentDoc = actor.items.get(componentId);

  const plan = enchantPlan({
    enchantment,
    item,
    remnant: remnantDoc ? partFromItem(remnantDoc) ?? { name: remnantDoc.name } : null,
    component: componentDoc ? partFromItem(componentDoc) : null,
    caster: casterFrom(actor),
    attunement, consumable
  });

  if (!plan.valid) {
    ui.notifications?.warn(plan.blockers[0]);
    return null;
  }

  const roll = await new Roll(`1d20 + ${plan.bonus}`).evaluate();
  const d20 = roll.dice.find(d => d.faces === 20);
  const natural = d20?.results?.find(r => r.active)?.result ?? null;
  const result = resolveEnchant({ total: roll.total, dc: plan.dc, natural });

  // Materials go regardless — the power left them when the binding began.
  await consume(actor, [remnantDoc, componentDoc]);

  let reward;
  if (result.destroyed) {
    // Captured before delete() — there is nothing left to read off the
    // document once it is gone, and the panel is the one place a player
    // learns exactly what the attempt cost them.
    const lost = [{ name: item.name, img: item.img, lost: true }];
    if (remnantDoc) lost.push({ name: remnantDoc.name, img: remnantDoc.img, lost: true });
    if (componentDoc) lost.push({ name: componentDoc.name, img: componentDoc.img, lost: true });

    await item.delete();

    reward = {
      title: result.label,
      subtitle: plan.enchantment,
      crest: "✕",
      flavour: "The binding failed, and took the item with it.",
      itemsHeading: "Lost",
      items: lost,
      notes: []
    };
  } else {
    // Clean or flawed, both show the panel — a flawed binding is still a
    // binding. Only "destroyed" leaves nothing to display, the same rule
    // craft and alchemy already use: the panel shows what was granted, and
    // a destroyed item was not.
    const bound = await applyEnchantment(item, plan, result);
    reward = {
      title: result.label,
      subtitle: plan.enchantment,
      crest: "✦",   // placeholder — crests get a proper pass later
      flavour: plan.effect,
      items: [{
        name: bound.name,
        img: bound.img,
        rarity: plan.rarity,
        flawed: result.flaws.length > 0
      }],
      // The flaws themselves, not just a count — a player deciding whether
      // to live with a flawed blade needs to know which flaw it has.
      notes: result.flaws
    };
  }

  await report({ actor, item, plan, roll, result });
  // Shown by the caller, after it refreshes — same reasoning as craft's
  // execute.js: a panel opened here would be covered a moment later by
  // whatever window's own re-render follows this call.
  return { ...result, actorId, reward };
}

/* ---------------------------------------------
   Foundry glue
--------------------------------------------- */

/**
 * The caster's half of the check.
 *
 * The ability is whichever spellcasting ability they actually have; a
 * multiclass gets the best of them rather than an arbitrary first.
 */
export function casterFrom(actor) {
  const classes = Object.values(actor?.system?.classes ?? actor?.classes ?? {});
  const abilities = classes
    .map(c => c?.spellcasting?.ability)
    .filter(Boolean);

  const mods = actor?.system?.abilities ?? {};
  const best = abilities
    .map(key => ({ key, mod: mods[key]?.mod ?? 0 }))
    .sort((a, b) => b.mod - a.mod)[0] ?? null;

  // Some sheets record spellcasting only on the attributes block.
  const fallback = actor?.system?.attributes?.spellcasting;
  const ability = best?.key ?? (fallback || null);

  const skills = Object.entries(actor?.system?.skills ?? {})
    .filter(([, s]) => (s?.value ?? 0) > 0)
    .map(([key]) => SKILL_LABEL[key] ?? key);

  return {
    ability,
    abilityMod: ability ? (mods[ability]?.mod ?? 0) : 0,
    skills,
    proficiency: actor?.system?.attributes?.prof ?? 2,
    isCaster: Boolean(ability)
  };
}

/** dnd5e skill keys → the labels HARVEST_SKILL_BY_TYPE uses. */
const SKILL_LABEL = {
  acr: "Acrobatics", ani: "Animal Handling", arc: "Arcana", ath: "Athletics",
  dec: "Deception", his: "History", ins: "Insight", itm: "Intimidation",
  inv: "Investigation", med: "Medicine", nat: "Nature", prc: "Perception",
  prf: "Performance", per: "Persuasion", rel: "Religion", slt: "Sleight of Hand",
  ste: "Stealth", sur: "Survival"
};

async function consume(actor, docs) {
  const deletes = [];
  const updates = [];
  for (const doc of docs) {
    if (!doc) continue;
    const held = Number(doc.system?.quantity) || 1;
    if (held > 1) updates.push({ _id: doc.id, "system.quantity": held - 1 });
    else deletes.push(doc.id);
  }
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  if (deletes.length) await actor.deleteEmbeddedDocuments("Item", deletes);
}

/**
 * Rewrite the item as its enchanted self.
 *
 * The original is renamed rather than replaced, so anything already pointing
 * at it — a character sheet slot, an active effect, a macro — keeps working.
 */
async function applyEnchantment(item, plan, result) {
  const flawText = result.flaws.length
    ? `<h4>Flaws</h4><ul>${result.flaws.map(f => `<li>${f}</li>`).join("")}</ul>`
    : "";

  const description = `${item.system?.description?.value ?? ""}
    <hr><p><b>${plan.enchantment}</b> — ${plan.effect}</p>
    <p><i>Bound with ${plan.remnant} of a ${plan.creatureType ?? "creature"},
    using ${plan.component}.</i></p>${flawText}`;

  await item.update({
    name: `${plan.enchantment} ${item.name}`,
    "system.rarity": normaliseRarity(plan.rarity)?.replace(/\s(\w)/g, (_, c) => c.toUpperCase()),
    "system.attunement": plan.attunement ? "required" : item.system?.attunement,
    "system.description.value": description,
    [`flags.${MODULE_ID}`]: {
      enchanted: true,
      enchantment: plan.enchantment,
      rarity: plan.rarity,
      kind: itemKind(item),
      remnant: plan.remnant,
      creatureType: plan.creatureType,
      component: plan.component,
      flaws: result.flaws,
      // Ancestral weapons (Phase 6) need to know an item has already been
      // bound once, so record it rather than inferring it later.
      boundAt: Date.now()
    }
  });

  // Foundry mutates the document in place, but returning it explicitly means
  // the caller has a real reference rather than leaning on that implicit
  // behaviour — which a test double cannot be trusted to replicate.
  return item;
}

async function report({ actor, item, plan, roll, result }) {
  const flaws = result.flaws.length
    ? `<ul class="rnr-flaws">${result.flaws.map(f => `<li>${f}</li>`).join("")}</ul>`
    : "";

  const outcome = result.destroyed
    ? `<p class="rnr-danger">${item.name} is destroyed. The remnant and component are gone with it.</p>`
    : `<p><b>${plan.enchantment} ${item.name}</b> — ${plan.effect}</p>`;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="rnr-craft-card">
        <h3>${result.label}</h3>
        <p>${roll.total} vs DC ${plan.dc}
           (${result.margin >= 0 ? "+" : ""}${result.margin}) —
           ${plan.ability ?? "?"} (${plan.skill})</p>
        ${outcome}
        ${flaws}
        <p class="rnr-craft-cost">
          ${plan.rarity}${plan.upgraded ? " — raised by a stronger remnant" : ""} ·
          ${plan.hours} hrs · consumed ${plan.remnant} and ${plan.component}
        </p>
      </div>`,
    rolls: [roll],
    flags: { [MODULE_ID]: { enchant: true, destroyed: result.destroyed } }
  });
}
