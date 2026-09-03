// =========================================================
// Runes & Remnants — Crafting execution
//
// Rolls the check, spends the materials, grants the item.
//
// GM-authoritative, the same shape harvest uses: a player asks over the
// socket, exactly one GM client acts. Without that, every connected client
// runs the handler and the party gets one item per logged-in user.
//
// This is the only file in src/craft/ besides extras.js that touches Foundry
// globals; the rules it enforces live in outcome.js and logic.js.
// =========================================================

import {
  getRecipe,
  planManufacture,
  selectReagents,
  partsFromActor,
  analyseConcoction,
  alchemyModifier
} from "./logic.js";
import { resolveCraft, consumptionPlan, OUTCOME } from "./outcome.js";
import { grantCrafted, concoctionItemData, concoctionItemNames, findCraftedItem } from "./grant.js";
import { pickExecutorId } from "../harvest/logic.js";

export const MODULE_ID = "runes-and-remnants";
const REQUEST = "requestCraft";

/** Guards against a doubled socket delivery landing twice. */
const inFlight = new Set();

/**
 * Ask for a craft. Runs it directly if this client is a GM, otherwise sends
 * it to one.
 *
 * @param {object} request { actorId, recipe } or { actorId, bench }
 */
export async function requestCraft(request) {
  if (game.user.isGM) return executeCraft(request);
  game.socket?.emit(`module.${MODULE_ID}`, { action: REQUEST, ...request });
  ui.notifications?.info("Crafting request sent to the GM.");
  return null;
}

/** True when this client is the one GM that should act on a request. */
export function isCraftExecutor() {
  return game.user.id === pickExecutorId(Array.from(game.users ?? []));
}

/**
 * Do the work. GM-side only.
 * @param {object} payload { actorId, recipe?, bench? }
 */
export async function executeCraft(payload = {}) {
  const key = `${payload.actorId}:${payload.recipe ?? (payload.bench ?? []).join(",")}`;
  if (inFlight.has(key)) return null;
  inFlight.add(key);
  try {
    return payload.bench?.length
      ? await craftConcoction(payload)
      : await craftItem(payload);
  } catch (err) {
    console.error(`${MODULE_ID} | craft failed`, err);
    ui.notifications?.error("Crafting failed — see the console.");
    return null;
  } finally {
    inFlight.delete(key);
  }
}

/* ---------------------------------------------
   MANUFACTURING
--------------------------------------------- */

async function craftItem({ actorId, recipe: recipeName, exclude = [] }) {
  const actor = game.actors?.get(actorId);
  const recipe = getRecipe(recipeName);
  if (!actor || !recipe) return null;

  const crafter = crafterFrom(actor);
  // Parts the player set aside in the panel. Honoured here rather than only
  // in the display, or the bench would promise one thing and spend another.
  const held = new Set(exclude);
  crafter.parts = crafter.parts.filter(p => !held.has(p.id));
  const plan = planManufacture(recipe, crafter, crafter.parts);
  const selection = selectReagents(recipe, crafter.parts);

  if (plan.blocked || !selection.met) {
    ui.notifications?.warn(
      `${actor.name} is short ${selection.shortfall} potency of ${plan.reagents.properties.join(" or ")} parts.`
    );
    return null;
  }

  const roll = await rollCheck(actor, plan);
  const result = resolveCraft({ total: roll.total, dc: plan.dc, natural: roll.natural });

  if (result.consumesReagents) await spend(actor, selection.parts);
  if (result.success) await grantCrafted(actor, recipe);

  await report({ actor, title: recipe.name, plan, roll, result, spent: selection.parts });
  return result;
}

/* ---------------------------------------------
   ALCHEMY
--------------------------------------------- */

async function craftConcoction({ actorId, bench = [] }) {
  const actor = game.actors?.get(actorId);
  if (!actor) return null;

  const concoction = analyseConcoction(bench);
  if (!concoction.valid) {
    ui.notifications?.warn(concoction.errors[0] ?? "That mixture will not hold together.");
    return null;
  }

  const abilities = abilityMods(actor);
  const bonus = alchemyModifier({
    int: abilities.int,
    wis: abilities.wis,
    proficient: hasTool(actor, concoction.tools),
    proficiency: actor.system?.attributes?.prof ?? 2
  });

  const roll = await evaluate(`1d20 + ${bonus}`);
  const result = resolveCraft({ total: roll.total, dc: concoction.dc, natural: roll.natural });

  // A success used to grant nothing at all — it rolled, wrote a chat card and
  // stopped, leaving the crafter holding an empty vial's worth of nothing.
  let brewed = null;
  if (result.success) {
    // A real item first — the SRD's own, or one the table authored under the
    // brew's name. Either arrives with its activation and rolls already
    // wired, which a built item cannot have. Only fall back to building one
    // when nothing exists to hand over.
    let data = null;
    for (const name of concoctionItemNames(concoction)) {
      const found = await findCraftedItem({ name });
      if (found) { delete found._id; data = found; break; }
    }
    data ??= concoctionItemData(concoction, bench, actor.name, bonus);

    if (data) {
      data.system = { ...(data.system ?? {}), quantity: 1 };
      data.flags = {
        ...(data.flags ?? {}),
        [MODULE_ID]: {
          ...(data.flags?.[MODULE_ID] ?? {}),
          crafted: true, concoction: true, ingredients: [...bench]
        }
      };
      [brewed] = await actor.createEmbeddedDocuments("Item", [data]);
    }
  }

  // Alchemy spends plant ingredients rather than harvested parts; those are
  // GM-tracked for now, so nothing is deducted here. Said plainly in chat
  // rather than left for someone to discover.
  await report({
    actor,
    title: brewed?.name ?? concoction.kindLabel ?? "Concoction",
    plan: { dc: concoction.dc, hours: 1, tool: concoction.tools?.[0] ?? "Alchemist's supplies" },
    roll, result, spent: [],
    footer: `Ingredients used: ${bench.join(", ")}. Deduct them by hand — alchemy stock is not tracked yet.`
  });
  return result;
}

/* ---------------------------------------------
   Foundry glue
--------------------------------------------- */

function abilityMods(actor) {
  const out = {};
  for (const [key, data] of Object.entries(actor.system?.abilities ?? {})) {
    out[key] = data?.mod ?? 0;
  }
  return out;
}

function hasTool(actor, tools = []) {
  const held = Array.from(actor.system?.traits?.toolProf?.value ?? []).map(String);
  return tools.some(t => held.includes(t));
}

function crafterFrom(actor) {
  return {
    abilities: abilityMods(actor),
    tools: Array.from(actor.system?.traits?.toolProf?.value ?? []).map(String),
    proficiency: actor.system?.attributes?.prof ?? 2,
    parts: partsFromActor(actor)
  };
}

/** Rolls the check, honouring the disadvantage an unproficient crafter takes. */
async function rollCheck(actor, plan) {
  const dice = plan.disadvantage ? "2d20kl1" : "1d20";
  return evaluate(`${dice} + ${plan.bonus}`);
}

async function evaluate(formula) {
  const roll = await new Roll(formula).evaluate();
  // The kept d20, so a natural 20 on a disadvantaged roll still reads right.
  const d20 = roll.dice.find(d => d.faces === 20);
  const kept = d20?.results?.filter(r => r.active) ?? [];
  return { roll, total: roll.total, natural: kept[0]?.result ?? null };
}

// Granting lives in grant.js. It used to look only in this module's own
// harvest pack, which holds monster components — so crafting Leather Armour
// produced a `loot` item called "Leather" rather than armour anyone could
// wear. See src/craft/grant.js for how the real item is found.

/** Removes what the build consumed. */
async function spend(actor, parts) {
  const { deletes, updates } = consumptionPlan(parts);
  if (updates.length) {
    await actor.updateEmbeddedDocuments("Item",
      updates.map(u => ({ _id: u._id, "system.quantity": u.quantity })));
  }
  if (deletes.length) await actor.deleteEmbeddedDocuments("Item", deletes);
}

async function report({ actor, title, plan, roll, result, spent = [], footer = "" }) {
  const spentLine = spent.length
    ? spent.map(p => p.name).join(", ")
    : "nothing";

  const content = `
    <div class="rnr-craft-card">
      <h3>${title}</h3>
      <p><b>${result.label}</b> — ${roll.total} vs DC ${plan.dc}
         (${result.margin >= 0 ? "+" : ""}${result.margin})</p>
      <p>${result.note}</p>
      <p class="rnr-craft-cost">
        Materials spent: ${result.consumesReagents ? spentLine : "none — the materials survive"}<br>
        Time: ${plan.hours} hrs at the ${plan.tool ?? "bench"}
      </p>
      ${footer ? `<p class="rnr-craft-note">${footer}</p>` : ""}
    </div>`;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    rolls: [roll.roll],
    flags: { [MODULE_ID]: { craft: true, outcome: result.outcome } }
  });
}

export { OUTCOME };
