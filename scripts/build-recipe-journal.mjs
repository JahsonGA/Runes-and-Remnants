// =========================================================
// Runes & Remnants — build the in-world recipe journal
//
//   npm run build:journal
//
// Writes packs/recipes/ — a LevelDB JournalEntry pack holding every recipe
// the module knows, as something a player can read at the table.
//
// GENERATED, NOT AUTHORED. The whole point is that it is produced from the
// same tables the crafting code reads, so it cannot drift from what actually
// happens when you press Craft. Editing the journal in Foundry and syncing it
// back would break that: the next rebuild overwrites it. Change the tables
// instead, then rebuild.
//
// IDs are derived from names rather than random, so rebuilding an unchanged
// table produces a byte-identical pack instead of a diff full of churn.
// =========================================================

import { ClassicLevel } from "classic-level";
import fs from "node:fs";
import { MANUFACTURING_TABLE, MANUFACTURING_CATEGORIES } from "../src/data/manufacturing.js";
import { ALCHEMY_INGREDIENTS } from "../src/data/alchemy.js";
import { REMEDY_NAME } from "../src/data/alchemy-effects.js";
import { composeEffect, describeEffect } from "../src/craft/concoct.js";
import { materialYardstick } from "../src/craft/logic.js";

const PACK = "packs/recipes";
const MODULE_ID = "runes-and-remnants";

/* ---------------------------------------------
   Deterministic ids
--------------------------------------------- */

const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * A stable 16-character id for a name.
 *
 * Foundry wants 16 alphanumeric characters. Deriving them from the name means
 * a rebuild of an unchanged table writes the same bytes, so the pack does not
 * churn in every diff — and links into it keep resolving.
 */
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

/* ---------------------------------------------
   Formatting
--------------------------------------------- */

const esc = s => String(s ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** "Wondrous item" accepts all nineteen tools; the full list is unreadable. */
function toolLabel(tools = []) {
  if (!tools.length) return "—";
  if (tools.length > 3) return `${tools.slice(0, 2).join(", ")} or ${tools.length - 2} others`;
  return tools.join(" or ");
}

function materialLabel(recipe) {
  const gp = materialYardstick(recipe);
  return gp === null ? "GM's call" : `~${gp} gp worth`;
}

const table = (headers, rows) =>
  `<table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead>`
  + `<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

/* ---------------------------------------------
   Pages
--------------------------------------------- */

function manufacturingPage() {
  let html = "<p>Every mundane item the module can make. The gold figure is a "
    + "<em>yardstick</em> for how much material a build takes — this campaign pays "
    + "it in monster parts, not coin.</p>"
    + "<p>Tool proficiency is not required. Without it the check is made at "
    + "disadvantage, which is a penalty rather than a wall.</p>";

  for (const category of MANUFACTURING_CATEGORIES) {
    const recipes = MANUFACTURING_TABLE.filter(r => r.category === category);
    if (!recipes.length) continue;

    html += `<h2>${esc(category)}</h2>`;
    html += table(
      ["Item", "DC", "Time", "Tool", "Materials"],
      recipes.map(r => [
        esc(r.name),
        r.dc,
        `${r.hours} hrs`,
        esc(toolLabel(r.tools)),
        esc(materialLabel(r))
      ])
    );
  }
  return html;
}

function alchemyPage(role, heading, blurb) {
  const rows = ALCHEMY_INGREDIENTS.filter(i => i.role === role).map(i => [
    esc(i.name),
    i.dc > 0 ? `+${i.dc}` : i.dc < 0 ? `−${Math.abs(i.dc)}` : "—",
    esc(i.rarity ?? "common"),
    esc(i.effect)
  ]);
  return `<p>${blurb}</p>` + table(["Ingredient", "DC", "Rarity", "Effect"], rows);
}

function alchemyRulesPage() {
  return `
    <p>An Alchemy Attempt is <strong>DC 10 plus the DC modifier of every
    ingredient used</strong>. One effect forms the base; up to three modifiers
    change what it does.</p>
    <ul>
      <li>Exactly one effect base — except <strong>Bloodgrass</strong>, which
      rides alongside another potion effect rather than replacing it.</li>
      <li>Modifiers must suit their base. A few work either way.</li>
      <li>At most three modifiers.</li>
      <li>Enchantments are their own path: <strong>Elemental Water</strong> as a
      base, exactly one enchantment ingredient, and no modifiers at all.</li>
    </ul>
    <p><strong>Lavender Sprig</strong> is the only ingredient that lowers the DC,
    so a careful alchemist can steady a volatile mix rather than only ever
    piling on power.</p>`;
}

function remedyPage() {
  let html = "<p>Brews with no equivalent on any shelf — made at a camp fire out "
    + "of what grew nearby. Each is named for its <em>form</em>, and the form fits "
    + "what it does.</p>"
    + "<p>The dice below are the <strong>base</strong>. Modifiers change them: "
    + "Milkweed Seeds doubles the dice but drops your Alchemy modifier, Dried "
    + "Ephedra steps the die up, Gengko Brush spreads the healing over rounds.</p>";

  const rows = [];
  for (const [ingredient, name] of Object.entries(REMEDY_NAME)) {
    const effect = composeEffect(ingredient, [], null);
    const line = describeEffect(effect);
    const riders = (effect?.riders ?? []).join(" ");
    rows.push([
      `<strong>${esc(name)}</strong>`,
      esc(ingredient),
      esc([line, riders].filter(Boolean).join(" "))
    ]);
  }
  html += table(["Remedy", "Brewed from", "What it does"], rows);
  return html;
}

/* ---------------------------------------------
   Build
--------------------------------------------- */

const PAGES = [
  { name: "Manufacturing", html: manufacturingPage() },
  { name: "Alchemy — How a Brew Works", html: alchemyRulesPage() },
  { name: "Alchemy — Potion Effects", html: alchemyPage("potion-effect", "Potion Effects",
      "One of these forms the base of a potion.") },
  { name: "Alchemy — Potion Modifiers", html: alchemyPage("potion-modifier", "Potion Modifiers",
      "Up to three of these change what a potion does.") },
  { name: "Alchemy — Poison Effects", html: alchemyPage("toxin-effect", "Poison Effects",
      "One of these forms the base of a poison.") },
  { name: "Alchemy — Poison Modifiers", html: alchemyPage("toxin-modifier", "Poison Modifiers",
      "Up to three of these change what a poison does.") },
  { name: "Alchemy — Either", html: alchemyPage("both-modifier", "Either",
      "These modifiers suit a potion or a poison.") },
  { name: "Alchemy — Enchantments", html: alchemyPage("enchantment", "Enchantments",
      "Brewed onto Elemental Water, one at a time, with no modifiers.") },
  { name: "Home Remedies", html: remedyPage() }
];

const ENTRY_NAME = "Crafting Recipes";
const entryId = idFor(ENTRY_NAME);

fs.rmSync(PACK, { recursive: true, force: true });
fs.mkdirSync(PACK, { recursive: true });

const db = new ClassicLevel(PACK, { valueEncoding: "json" });
await db.open();

const pageIds = [];
for (const [i, page] of PAGES.entries()) {
  const pageId = idFor(`${ENTRY_NAME}::${page.name}`);
  pageIds.push(pageId);
  await db.put(`!journal.pages!${entryId}.${pageId}`, {
    _id: pageId,
    name: page.name,
    type: "text",
    title: { show: true, level: 1 },
    text: { format: 1, content: page.html },
    sort: (i + 1) * 100000,
    ownership: { default: -1 },
    flags: { [MODULE_ID]: { generated: true } },
    _key: `!journal.pages!${entryId}.${pageId}`
  });
}

await db.put(`!journal!${entryId}`, {
  _id: entryId,
  name: ENTRY_NAME,
  pages: [],
  folder: null,
  sort: 0,
  ownership: { default: 2 },   // observers can read it; it is player-facing
  flags: {
    [MODULE_ID]: {
      generated: true,
      // Says plainly where it came from, so nobody edits it by hand and
      // wonders why the change vanished on the next build.
      source: "scripts/build-recipe-journal.mjs"
    }
  },
  _key: `!journal!${entryId}`
});

await db.close();

console.log(`Built ${PACK} — 1 entry, ${PAGES.length} pages`);
console.log(`  ${MANUFACTURING_TABLE.length} recipes, ${ALCHEMY_INGREDIENTS.length} ingredients, `
  + `${Object.keys(REMEDY_NAME).length} remedies`);
