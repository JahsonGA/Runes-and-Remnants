// =========================================================
// Runes & Remnants — Third-party recipe loading
//
// WHY THIS EXISTS
//
// Grim Hollow, Ryoko's Guide, Heliana's Guide and L'Arsene's Ledger are
// commercial books. Game *mechanics* — a DC, an hour count, a formula — are
// not copyrightable, and SRD 5.1 names are CC-BY, so those ship inside the
// module. Item stat blocks and descriptions are neither, and shipping them in
// a publicly listed Foundry package is a takedown waiting to happen.
//
// So the module ships the engine, and the content stays where it was already
// legitimately bought. A table that owns Grim Hollow imports it into a world
// compendium the way it always has; this reads that compendium and folds the
// items into the crafting catalogue. Nothing copyrighted crosses the
// distribution boundary, and the table loses nothing.
//
// This is the only file in src/craft/ that touches Foundry globals.
// =========================================================

import { registerExtraRecipes, clearExtraRecipes } from "./logic.js";

export const MODULE_ID = "runes-and-remnants";
export const SETTING_PACKS = "extraCraftingPacks";

/** Where a shipped recipe's numbers come from when the item doesn't say. */
const DEFAULTS = { tools: [], hours: 8, dc: 15, materialGp: null, valueGp: null };

/**
 * dnd5e item type → the crafting category it lands in.
 * Anything unrecognised keeps the pack's own label rather than being forced
 * into a bucket that misdescribes it.
 */
const TYPE_CATEGORY = {
  weapon: "Third-party Weapons",
  equipment: "Third-party Armour & Gear",
  consumable: "Third-party Consumables",
  loot: "Third-party Materials",
  tool: "Third-party Gear"
};

/**
 * Turn a compendium item into a recipe.
 *
 * A table can annotate an item with module flags to give it real crafting
 * numbers; without them the item still appears, using the defaults, so
 * importing a book is useful before anyone has tagged anything.
 *
 * @param {object} entry A compendium index entry or full item
 * @param {string} source Pack label, shown in the UI
 */
export function recipeFromItem(entry, source = "world") {
  if (!entry?.name) return null;
  const flags = entry.flags?.[MODULE_ID] ?? {};
  const price = entry.system?.price;
  const valueGp = typeof price === "object" ? price?.value : price;

  return {
    name: entry.name,
    category: flags.category ?? TYPE_CATEGORY[entry.type] ?? "Third-party Gear",
    tools: Array.isArray(flags.tools) ? flags.tools : DEFAULTS.tools,
    hours: Number(flags.hours) || DEFAULTS.hours,
    dc: Number(flags.dc) || DEFAULTS.dc,
    // Falls back to the book's own rule of thumb: a third of finished value.
    materialGp: Number(flags.materialGp) || (valueGp ? Number(valueGp) / 3 : null),
    valueGp: valueGp != null ? Number(valueGp) : DEFAULTS.valueGp,
    rarity: entry.system?.rarity || undefined,
    img: entry.img,
    uuid: entry.uuid,
    srd: false,
    source
  };
}

/** The pack ids the GM has pointed us at, as a trimmed list. */
export function configuredPackIds() {
  const raw = game.settings.get(MODULE_ID, SETTING_PACKS) ?? "";
  return String(raw).split(",").map(s => s.trim()).filter(Boolean);
}

/**
 * Read every configured pack and register what it holds.
 * Safe to call repeatedly — it clears first, so a re-scan never doubles up.
 *
 * @returns {Promise<{loaded:number, packs:string[], missing:string[]}>}
 */
export async function loadExtraRecipes() {
  clearExtraRecipes();
  const missing = [];
  const packs = [];
  let loaded = 0;

  for (const id of configuredPackIds()) {
    const pack = game.packs?.get(id);
    if (!pack) {
      missing.push(id);
      continue;
    }
    try {
      const index = await pack.getIndex({ fields: ["type", "system.price", "system.rarity", "flags"] });
      const recipes = index.map(e => recipeFromItem(e, pack.metadata?.label ?? id)).filter(Boolean);
      loaded += registerExtraRecipes(recipes, pack.metadata?.label ?? id);
      packs.push(id);
    } catch (err) {
      console.error(`${MODULE_ID} | could not read crafting pack "${id}"`, err);
      missing.push(id);
    }
  }

  if (missing.length) {
    ui.notifications?.warn(
      `Runes & Remnants: could not read crafting pack(s) ${missing.join(", ")}. Check the id in module settings.`
    );
  }
  return { loaded, packs, missing };
}

/** Register the setting. Called from index.js during init. */
export function registerExtraSettings() {
  game.settings.register(MODULE_ID, SETTING_PACKS, {
    name: "Extra crafting compendiums",
    hint: "Comma-separated pack ids (e.g. world.grim-hollow-items) to fold into the crafting catalogue. "
        + "Content from commercial books stays in your own world — this module ships only SRD-safe names.",
    scope: "world",
    config: true,
    type: String,
    default: "",
    onChange: () => loadExtraRecipes()
  });
}
