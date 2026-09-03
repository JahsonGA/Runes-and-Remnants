// =========================================================
// Runes & Remnants — Handing over the finished item
//
// Crafting Leather Armour has to produce Leather Armour: a real dnd5e
// `equipment` item with an AC, a weight and a price. It used to produce a
// `loot` item called "Leather", because the only place it looked was this
// module's own harvest pack — which holds monster components, not gear.
//
// WHY NAMES AND NOT IDS
//
// The dnd5e system ships the SRD as compendiums, so the proper item almost
// always already exists in the world. Hardcoding its id would tie this module
// to one dnd5e version — ids are regenerated across releases and differ in
// localised builds — so it is looked up by name, with several candidate
// spellings tried in order.
//
// Everything above `findCraftedItem` is pure and tested; only the last two
// functions touch Foundry.
// =========================================================

import { ALCHEMY_SRD_ITEM } from "../data/alchemy.js";
import { composeEffect, describeEffect } from "./concoct.js";

export const MODULE_ID = "runes-and-remnants";

/**
 * Recipe name → what the dnd5e SRD calls it, where the two differ.
 *
 * Only the genuine mismatches. Anything the generic rules below already
 * handle — a trailing "(vial)", a "Crossbow, Light" inversion — is left out
 * so this table stays small enough to stay correct.
 */
export const SYSTEM_ITEM_NAME = {
  // Armour: the SRD suffixes most of these with "Armor".
  "Padded": "Padded Armor",
  "Leather": "Leather Armor",
  "Studded Leather": "Studded Leather Armor",
  "Hide": "Hide Armor",
  "Half Plate": "Half Plate Armor",
  "Splint": "Splint Armor",
  "Plate": "Plate Armor",

  // Ammunition. Nothing here that differs only in capitalisation — the
  // lookup compares case-insensitively, so those entries would be dead weight.
  "Bolts": "Crossbow Bolts",
  "Firearm shot": "Firearm Bullets",

  // Consumables.
  "Poison, Basic": "Basic Poison",
  "Alchemist's Fire": "Alchemist's Fire (flask)",

  // Gear.
  "Adventuring gear (generic)": "Backpack"
};

/**
 * Category → the dnd5e item type to build when nothing is found.
 *
 * A wrong type is worse than a missing item: a weapon filed as `loot` cannot
 * be equipped or attacked with, and the player has to rebuild it by hand.
 */
export const FALLBACK_TYPE = {
  "Simple Melee": "weapon",
  "Martial Melee": "weapon",
  "Simple Ranged": "weapon",
  "Martial Ranged": "weapon",
  "Armour": "equipment",
  "Ammunition": "consumable",
  "Consumable": "consumable",
  "Consumable Base": "consumable",
  "Potion": "consumable",
  "Focus & Wondrous": "equipment",
  "Gear": "equipment"
};

/** Armour that a fallback build should at least get the shape of right. */
export const FALLBACK_ARMOUR = {
  "Padded": { type: "light", ac: 11 },
  "Leather": { type: "light", ac: 11 },
  "Studded Leather": { type: "light", ac: 12 },
  "Hide": { type: "medium", ac: 12 },
  "Chain Shirt": { type: "medium", ac: 13 },
  "Scale Mail": { type: "medium", ac: 14 },
  "Breastplate": { type: "medium", ac: 14 },
  "Half Plate": { type: "medium", ac: 15 },
  "Ring Mail": { type: "heavy", ac: 14 },
  "Chain Mail": { type: "heavy", ac: 16 },
  "Splint": { type: "heavy", ac: 17 },
  "Plate": { type: "heavy", ac: 18 },
  "Shield": { type: "shield", ac: 2 }
};

/* ---------------------------------------------
   Names to try
--------------------------------------------- */

/**
 * Every spelling worth trying, best first.
 *
 * Generated rather than tabulated wherever a rule covers it, because a table
 * of a hundred names would rot the first time dnd5e renamed anything.
 *
 *   "Leather"          → Leather Armor, Leather Armour, Leather
 *   "Crossbow, Light"  → Light Crossbow, Crossbow, Light
 *   "Arrows (20)"      → Arrows, Arrows (20)
 *   "Acid (vial)"      → Acid (vial), Acid
 */
export function itemNameCandidates(recipe) {
  const raw = typeof recipe === "string" ? recipe : recipe?.name;
  if (!raw) return [];

  const out = [];
  const add = name => {
    const trimmed = String(name ?? "").trim();
    if (trimmed && !out.some(n => n.toLowerCase() === trimmed.toLowerCase())) out.push(trimmed);
  };

  // Strip a trailing count or unit — "Arrows (20)", "Acid (vial)".
  const bare = raw.replace(/\s*\([^)]*\)\s*$/, "").trim();

  // An explicit mapping wins, on either the full name or the bare one.
  add(SYSTEM_ITEM_NAME[raw]);
  add(SYSTEM_ITEM_NAME[bare]);

  // "Crossbow, Light" is how the equipment table sorts it; the item is
  // called "Light Crossbow".
  const comma = raw.match(/^(.+),\s*(.+)$/);
  if (comma) add(`${comma[2]} ${comma[1]}`);

  add(raw);
  add(bare);

  // Both spellings of armour, since a localised build may use either.
  for (const name of [...out]) {
    if (/\bArmor\b/.test(name)) add(name.replace(/\bArmor\b/, "Armour"));
    if (/\bArmour\b/.test(name)) add(name.replace(/\bArmour\b/, "Armor"));
  }

  return out;
}

/** Loose comparison, for a last pass when nothing matched exactly. */
export function normaliseName(name) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\b(armor|armour)\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

/* ---------------------------------------------
   The fallback
--------------------------------------------- */

/**
 * The item to build when the world has nothing to copy.
 *
 * Better a weapon of the right type with no stats than a `loot` entry the
 * player has to rebuild — at least it can be equipped and rolled.
 */
export function fallbackItemData(recipe, crafterName = "someone") {
  if (!recipe?.name) return null;

  const type = FALLBACK_TYPE[recipe.category] ?? "loot";
  const system = {
    quantity: 1,
    description: {
      value: `<p>Crafted by ${crafterName}.</p>`
           + `<p><i>The world had no ${recipe.name} to copy, so this was built from `
           + `the recipe. Fill in its statistics, or import the SRD compendium.</i></p>`
    }
  };

  if (recipe.valueGp != null) system.price = { value: recipe.valueGp, denomination: "gp" };
  if (recipe.rarity) system.rarity = recipe.rarity;

  const armour = FALLBACK_ARMOUR[recipe.name];
  if (type === "equipment" && armour) {
    system.armor = { type: armour.type, value: armour.ac, dex: armour.type === "medium" ? 2 : null };
    system.type = { value: armour.type };
  }

  return {
    name: recipe.name,
    type,
    system,
    flags: {
      [MODULE_ID]: {
        crafted: true,
        category: recipe.category,
        // Marked so a GM can find everything that came out of a fallback and
        // fix it in one pass.
        improvised: true
      }
    }
  };
}

/* ---------------------------------------------
   Alchemy
--------------------------------------------- */

/** What a brew is called, by what it is. */
const CONCOCTION_KIND = { potion: "Potion", poison: "Poison", enchantment: "Elixir" };

/** Weakest to strongest, for taking a brew's rarity from its ingredients. */
const RARITY_RANK = ["common", "uncommon", "rare", "veryRare", "legendary", "artifact"];

/**
 * The item a successful brew produces.
 *
 * Alchemy used to grant nothing at all — it rolled, wrote a chat card, and
 * stopped, so a success left the crafter holding an empty vial's worth of
 * nothing. There is no SRD item to look up here either: a concoction is
 * defined by the ingredients that went into it, so the item has to be built.
 *
 * The description composes the source's own effect text for the base and
 * every modifier, which is what makes the result worth reading — the whole
 * point of the modifier system is that the combination does something none of
 * the parts do alone.
 */
/**
 * Names to look for before building a brew from scratch, best first.
 *
 * A real item beats a built one: it arrives with its own activation and rolls
 * wired up, so the table gets a potion that works rather than one they read.
 * The synthesised name comes second so a world item authored under it — the
 * intended way to give a custom brew real mechanics — is found too.
 *
 * The SRD name is offered ONLY for an unmodified brew. A modifier makes it
 * something the SRD has no item for, and handing over the vanilla potion
 * would throw away exactly what the alchemist added.
 */
export function concoctionItemNames(concoction) {
  if (!concoction?.valid) return [];

  const base = concoction.effects?.[0] ?? null;
  const names = [];

  if (base && !(concoction.modifiers ?? []).length) {
    const srd = ALCHEMY_SRD_ITEM[base.name];
    if (srd) names.push(srd);
  }

  const built = concoctionItemData(concoction)?.name;
  if (built && !names.includes(built)) names.push(built);
  return names;
}

export function concoctionItemData(concoction, bench = [], crafterName = "someone", alchemyMod = null) {
  if (!concoction?.valid) return null;

  const base = concoction.effects?.[0] ?? null;
  const kind = CONCOCTION_KIND[concoction.kind] ?? "Concoction";
  const name = base ? `${kind} of ${base.name}` : kind;
  const modifiers = concoction.modifiers ?? [];

  // What the vial actually does, with every modifier already folded in. The
  // item used to list its ingredients and leave the drinker to work it out.
  const composed = base
    ? composeEffect(base.name, modifiers.map(m => m.name), alchemyMod)
    : null;
  const summary = composed ? describeEffect(composed) : "";

  const lines = [];
  // The composed line leads, because it is the one a player acts on.
  if (summary) lines.push(`<p><b>${escapeHtml(summary)}</b></p>`);
  for (const rider of composed?.riders ?? []) {
    lines.push(`<p>${escapeHtml(rider)}</p>`);
  }
  if (composed?.inverted) {
    lines.push('<p class="rnr-danger">Inverted — the GM decides what this brew does instead.</p>');
  }

  lines.push("<hr>");
  if (base) lines.push(`<p><i>${escapeHtml(base.name)} — ${escapeHtml(base.effect)}</i></p>`);
  if (modifiers.length) {
    lines.push("<h4>Modifiers</h4><ul>"
      + modifiers.map(m => `<li><b>${escapeHtml(m.name)}</b> — ${escapeHtml(m.effect)}</li>`).join("")
      + "</ul>");
  }
  lines.push(`<p><i>Brewed by ${escapeHtml(crafterName)} against DC ${concoction.dc}.</i></p>`);

  return {
    name,
    type: "consumable",
    system: {
      quantity: 1,
      // A brew is only as refined as its rarest ingredient.
      rarity: highestRarity([base, ...modifiers].filter(Boolean)),
      description: { value: lines.join("") }
    },
    flags: {
      [MODULE_ID]: {
        crafted: true,
        concoction: true,
        kind: concoction.kind,
        dc: concoction.dc,
        // The composed effect, machine-readable. A macro or a later version
        // that wires this into a dnd5e activity reads it from here rather
        // than parsing the description back out of prose.
        effect: composed && {
          formula: composed.formula,
          damageType: composed.damageType,
          perRound: composed.perRound,
          condition: composed.condition,
          duration: composed.duration,
          save: composed.save,
          riders: composed.riders,
          inverted: composed.inverted
        },
        // The exact bench, so two brews sharing a name are still tellable
        // apart — and so a GM can see what went in months later.
        ingredients: [...bench]
      }
    }
  };
}

function highestRarity(ingredients = []) {
  let best = "common";
  for (const i of ingredients) {
    if (RARITY_RANK.indexOf(i?.rarity) > RARITY_RANK.indexOf(best)) best = i.rarity;
  }
  return best;
}

/** Ingredient names and effect text come from data this module does not own. */
function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

/* ---------------------------------------------
   Foundry
--------------------------------------------- */

/**
 * Packs worth searching, in order of trust.
 *
 * The dnd5e system's own compendiums first, because they hold the SRD the
 * recipes are written against. World packs next — that is where a table puts
 * its own and its third-party content. Other modules last. This module's
 * harvest pack is skipped entirely: it holds components, and a recipe that
 * happens to share a name with one would produce a lump of monster instead
 * of a sword.
 */
export function searchablePacks(packs) {
  return Array.from(packs ?? [])
    .filter(p => p?.documentName === "Item")
    .filter(p => p.collection !== `${MODULE_ID}.harvest-items`)
    .sort((a, b) => rank(a) - rank(b));
}

function rank(pack) {
  const pkg = pack?.metadata?.packageName ?? pack?.metadata?.package;
  const type = pack?.metadata?.packageType ?? pack?.metadata?.type;
  if (pkg === "dnd5e" || type === "system") return 0;
  if (type === "world") return 1;
  return 2;
}

/**
 * Find the real item a recipe should produce.
 * @returns {Promise<object|null>} item data ready to create, or null
 */
export async function findCraftedItem(recipe) {
  // A world-loaded recipe already knows exactly which document it came from.
  if (recipe?.uuid) {
    const doc = await fromUuid(recipe.uuid).catch(() => null);
    if (doc) return doc.toObject();
  }

  const candidates = itemNameCandidates(recipe);
  if (!candidates.length) return null;
  const packs = searchablePacks(game.packs);

  // Exact names first, across every pack, before falling back to a looser
  // match — an exact hit in a low-priority pack beats a fuzzy one anywhere.
  for (const wanted of candidates) {
    for (const pack of packs) {
      const index = await pack.getIndex().catch(() => null);
      const entry = index?.find(e => e.name?.toLowerCase() === wanted.toLowerCase());
      if (entry) return (await pack.getDocument(entry._id)).toObject();
    }
  }

  const loose = normaliseName(recipe?.name);
  if (loose) {
    for (const pack of packs) {
      const index = await pack.getIndex().catch(() => null);
      const entry = index?.find(e => normaliseName(e.name) === loose);
      if (entry) return (await pack.getDocument(entry._id)).toObject();
    }
  }

  // Finally the world's own loose items, for a table that never imported a
  // compendium and just keeps its gear in the sidebar.
  const worldItem = game.items?.find(i =>
    candidates.some(n => i.name?.toLowerCase() === n.toLowerCase()));
  return worldItem ? worldItem.toObject() : null;
}

/** Put the finished item in the crafter's hands. */
export async function grantCrafted(actor, recipe) {
  const found = await findCraftedItem(recipe);
  const data = found ?? fallbackItemData(recipe, actor?.name);
  if (!data) return null;

  // Never carry another item's id, and never inherit a stack size.
  delete data._id;
  data.system = { ...(data.system ?? {}), quantity: 1 };
  data.flags = {
    ...(data.flags ?? {}),
    [MODULE_ID]: { ...(data.flags?.[MODULE_ID] ?? {}), crafted: true }
  };

  const [created] = await actor.createEmbeddedDocuments("Item", [data]);
  if (!found) {
    ui.notifications?.warn(
      `No "${recipe.name}" found in any compendium — an improvised ${data.type} was made instead. `
      + `Import the dnd5e SRD items to get the real one.`
    );
  }
  return created;
}
