// =========================================================
// Runes & Remnants — build the ten home-remedy items
//
//   npm run build:alchemy
//
// Writes one JSON file per remedy to scripts/alchemy-items/, ready to import
// into Foundry, and writes the same ten into packs/alchemy-items so the
// module ships them.
//
// GENERATED from the same tables the crafting code reads. The shape comes
// from a real item authored in Foundry (scripts/alchemy-template.json), so
// the dnd5e 3.3.1 schema is right by construction rather than by my guess.
//
// The dice written here are the BASE — an unskilled brew with no modifiers.
// specialiseBrew overwrites them at brew time with the brewer's own numbers,
// so these only matter if someone drags an item straight out of the
// compendium without brewing it.
// =========================================================

import { ClassicLevel } from "classic-level";
import fs from "node:fs";
import path from "node:path";
import { REMEDY_NAME } from "../src/data/alchemy-effects.js";
import { ALCHEMY_INGREDIENTS, ALCHEMY_SRD_ITEM } from "../src/data/alchemy.js";
import { analyseConcoction } from "../src/craft/logic.js";
import { composeEffect, describeEffect } from "../src/craft/concoct.js";
import { concoctionItemData, specialiseBrew } from "../src/craft/grant.js";

const TEMPLATE = "scripts/alchemy-template.json";
const OUT_DIR  = "scripts/alchemy-items";
const PACK     = "packs/alchemy-items";
const MODULE_ID = "runes-and-remnants";

/**
 * The shape of a dnd5e 3.3.1 consumable.
 *
 * Taken from an item authored in Foundry rather than written from the schema
 * docs, so every field is whatever Foundry itself writes. Inlined so this
 * script runs from a clean clone — the JSON it came from is a local artefact
 * and is not committed.
 *
 * Drop a `scripts/alchemy-template.json` beside this file to override it,
 * which is how to re-seed the shape from a newer dnd5e.
 */
const DEFAULT_TEMPLATE = {
  name: "", type: "consumable",
  img: "icons/consumables/potions/bottle-round-corked-orante-red.webp",
  system: {
    description: { value: "", chat: "" },
    source: { custom: "" },
    identified: true,
    unidentified: { description: "" },
    container: null,
    quantity: 1,
    weight: { value: 0, units: "lb" },
    price: { value: 0, denomination: "gp" },
    rarity: "common",
    attunement: "", attuned: false, equipped: false,
    activation: { type: "action", cost: 1, condition: "" },
    duration: { value: "", units: "inst" },
    cover: null, crewed: false,
    target: { value: "1", width: null, units: "", type: "creature", prompt: true },
    range: { value: null, long: null, units: "" },
    uses: { value: 1, max: "1", per: "charges", recovery: "", prompt: true, autoDestroy: true },
    consume: { type: "", target: null, amount: null, scale: false },
    ability: "none",
    actionType: "",
    attack: { bonus: "", flat: false },
    chatFlavor: "",
    critical: { threshold: null, damage: "" },
    damage: { parts: [], versatile: "" },
    enchantment: null,
    formula: "",
    save: { ability: "", dc: null, scaling: "flat" },
    summons: null,
    type: { value: "potion", subtype: "" },
    magicalBonus: null,
    properties: []
  },
  effects: [],
  folder: null,
  flags: { core: {} }
};

/**
 * A line of flavour per remedy, written here rather than taken from the
 * ingredient table — the table says what a thing *does*, and an item wants to
 * say what it *is* as well.
 */
const FLAVOUR = {
  "Sageroot Poultice":
    "Root mashed to a grey paste and pressed under a strip of cloth. Smells of wet earth and bites at a wound before it soothes it.",
  "Mandrake Decoction":
    "Boiled down over a long evening until the pot is nearly dry. Bitter enough that most people hold their nose, and it works slowly.",
  "Hyancinth Tincture":
    "Petals steeped in spirit until the liquor runs pale gold. A few drops under the tongue is the whole dose; more is waste.",
  "Fennel Silk Compress":
    "A cloth soaked and wrung out, held against the chest until the shivering stops. Keeps a body's own warmth where it belongs.",
  "Bloodgrass Mash":
    "Not medicine. Coarse, filling, and faintly sweet — a day's eating for someone who has run out of everything else.",
  "Wyrmtongue Extract":
    "Reduced until a single drop beads like resin. Painted along an edge, it dries clear and keeps for weeks.",
  "Basilisk Breath Vapour":
    "Kept stoppered and cold. Unsealed, it rolls out heavy and low, and anything breathing it finds its limbs slow to answer.",
  "Arrow Root Liniment":
    "Worked into the grip and the wrist until the skin warms. Steadies the hand for about as long as a fight lasts.",
  "Primordial Balm":
    "Thick as tallow and slow to rub in. Something in it remembers being a mountain, a furnace, or a winter.",
  "Silver Hibiscus Infusion":
    "Steeped pale and sipped slowly. Three mouthfuls in the flask, and each one leaves heat somewhere behind the ribs."
};

/* ---------------------------------------------
   Deterministic ids
--------------------------------------------- */

const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Stable 16-character id, so rebuilding an unchanged item writes the same bytes. */
function idFor(text) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    h1 = Math.imul(h1 ^ text.charCodeAt(i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 + text.charCodeAt(i) + i, 0x85ebca6b) >>> 0;
  }
  let id = "";
  for (let i = 0; i < 16; i++) {
    const mix = (i % 2 ? h1 : h2) >>> ((i % 8) * 3);
    id += ALPHABET[(mix + i * 7) % ALPHABET.length];
    if (i % 2) h1 = Math.imul(h1, 0x27220a95) >>> 0;
    else h2 = Math.imul(h2, 0x165667b1) >>> 0;
  }
  return id;
}

const esc = s => String(s ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ---------------------------------------------
   Build one
--------------------------------------------- */

// A local override if one is sitting there, otherwise the inlined shape.
const template = fs.existsSync(TEMPLATE)
  ? JSON.parse(fs.readFileSync(TEMPLATE, "utf8"))
  : DEFAULT_TEMPLATE;

/** Which bench produces this remedy, so analyseConcoction can price it. */
function benchFor(ingredient) {
  const spec = ALCHEMY_INGREDIENTS.find(i => i.name === ingredient);
  return spec?.role === "enchantment" ? ["Elemental Water", ingredient] : [ingredient];
}

function buildItem(ingredient, name) {
  const bench = benchFor(ingredient);
  const concoction = analyseConcoction(bench);
  // Base dice, unmodified and unskilled — specialiseBrew replaces these with
  // the brewer's real numbers whenever one is actually brewed.
  const composed = composeEffect(ingredient, [], null);
  const built = concoctionItemData(concoction, bench, "a careful hand", null);

  // Start from the authored item so every structural field is whatever
  // Foundry itself wrote, then change only what differs per remedy.
  const item = structuredClone(template);
  delete item._stats;
  delete item.flags?.exportSource;

  item._id = idFor(`alchemy::${name}`);
  item.name = name;

  const mechanics = [describeEffect(composed), ...(composed?.riders ?? [])]
    .filter(Boolean).map(line => `<p>${esc(line)}</p>`).join("");

  item.system.description.value =
    `<p><em>${esc(FLAVOUR[name] ?? "")}</em></p>${mechanics}`;

  item.system.rarity = built?.system?.rarity ?? "common";
  item.system.type = { value: concoction.kind === "poison" ? "poison" : "potion", subtype: "" };

  // The template had activation "bonus" with a null cost, which is no cost at
  // all. Drinking or applying one of these is an action.
  item.system.activation = { type: "action", cost: 1, condition: "" };

  // Clear what the template carried from Sageroot, then let specialiseBrew
  // write back only what THIS remedy actually has.
  item.system.damage = { parts: [], versatile: "" };
  item.system.actionType = "";
  item.system.save = { ability: "", dc: null, scaling: "flat" };
  item.system.uses = { value: 1, max: "1", per: "charges", recovery: "", prompt: true, autoDestroy: true };

  const specialised = specialiseBrew(item, composed);

  // A brew with charges is not destroyed on first use.
  if (composed?.uses) specialised.system.uses.autoDestroy = false;

  specialised.flags = {
    ...(specialised.flags ?? {}),
    [MODULE_ID]: { remedy: true, ingredient, generated: true }
  };
  return specialised;
}

/* ---------------------------------------------
   Write
--------------------------------------------- */

const items = Object.entries(REMEDY_NAME).map(([ingredient, name]) => buildItem(ingredient, name));

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

for (const item of items) {
  const slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  fs.writeFileSync(path.join(OUT_DIR, `fvtt-Item-${slug}.json`),
    JSON.stringify(item, null, 2) + "\n");
}

fs.rmSync(PACK, { recursive: true, force: true });
fs.mkdirSync(PACK, { recursive: true });
const db = new ClassicLevel(PACK, { valueEncoding: "json" });
await db.open();

// rmSync is not enough on its own. A LevelDB directory that is open, locked,
// or mid-compaction can survive it, and the leftover keys then sit alongside
// the new ones — which is how the pack ended up with two Wyrmtongue Extracts
// under different ids. clear() empties the store itself, whatever is on disk.
await db.clear();

for (const item of items) {
  await db.put(`!items!${item._id}`, { ...item, _key: `!items!${item._id}` });
}
await db.close();

// Read it back before claiming success. A generator that cannot prove what
// it wrote is how a corrupt pack reaches a commit.
const check = new ClassicLevel(PACK, { valueEncoding: "json" });
const written = [];
for await (const [key] of check.iterator()) written.push(key);
await check.close();

if (written.length !== items.length) {
  console.error(`✗ wrote ${items.length} items but the pack holds ${written.length}.`);
  console.error("  Delete packs/alchemy-items and run again.");
  process.exit(1);
}

console.log(`Built ${items.length} remedies`);
console.log(`  ${OUT_DIR}/  — one JSON each, importable by hand`);
console.log(`  ${PACK}/     — the shipped compendium`);
for (const i of items) {
  const dmg = i.system.damage.parts[0];
  console.log(`   ${i.name.padEnd(26)} ${i.system.type.value.padEnd(7)}`
    + `${(i.system.rarity ?? "").padEnd(9)}${dmg ? dmg.join(" ") : "—"}`);
}
