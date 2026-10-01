import { describe, it, expect } from "vitest";
import { readPack, readJournalPages } from "./read-pack.mjs";
import { MANUFACTURING_TABLE, MANUFACTURING_CATEGORIES } from "../src/data/manufacturing.js";
import { ALCHEMY_INGREDIENTS } from "../src/data/alchemy.js";
import { REMEDY_NAME } from "../src/data/alchemy-effects.js";

// The journal is GENERATED from the same tables the crafting code reads, so
// it cannot describe rules the module does not follow. These tests are what
// make that true in practice: add a recipe without rebuilding and the journal
// no longer lists it, which fails here rather than at a table.
//
//   npm run build:journal

const entries = await readPack("packs/recipes", "journal");
const pages = await readJournalPages("packs/recipes");

const page = name => pages.find(p => p.name === name);
const textOf = name => page(name)?.text?.content ?? "";

// The generator escapes for HTML; names must be compared the same way.
const esc = s => String(s).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ─── Shape ────────────────────────────────────────────────────────────────────

describe("recipe journal — shape", () => {
  it("is one entry", () => {
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("Crafting Recipes");
  });

  it("is readable by players, not GM-only", () => {
    // A rulebook nobody at the table can open is not a rulebook.
    expect(entries[0].ownership.default).toBeGreaterThanOrEqual(2);
  });

  it("says it is generated, and where from", () => {
    // So nobody edits it in Foundry and wonders why the change vanished on
    // the next build.
    const flags = entries[0].flags["runes-and-remnants"];
    expect(flags.generated).toBe(true);
    expect(flags.source).toMatch(/build-recipe-journal/);
  });

  it("every page has a stable 16-character id", () => {
    // Derived from the name rather than random, so rebuilding an unchanged
    // table writes the same bytes instead of a diff full of churn.
    for (const p of pages) {
      expect(p._id, `"${p.name}"`).toMatch(/^[A-Za-z0-9]{16}$/);
    }
    expect(new Set(pages.map(p => p._id)).size).toBe(pages.length);
  });

  it("pages carry content and sort in a deliberate order", () => {
    expect(pages.length).toBeGreaterThan(5);
    for (const p of pages) {
      expect(p.text.content.length, `"${p.name}" is empty`).toBeGreaterThan(100);
    }
    const sorts = pages.map(p => p.sort);
    expect(sorts).toEqual([...sorts].sort((a, b) => a - b));
  });
});

// ─── It matches the tables ────────────────────────────────────────────────────

describe("recipe journal ↔ the tables it is built from", () => {
  it("lists every manufacturing recipe", () => {
    const html = textOf("Manufacturing");
    const missing = MANUFACTURING_TABLE
      .filter(r => !html.includes(esc(r.name)))
      .map(r => r.name);
    expect(missing, `absent from the journal: ${missing.join(", ")}`).toEqual([]);
  });

  it("heads every category that has recipes under it", () => {
    const html = textOf("Manufacturing");
    for (const c of MANUFACTURING_CATEGORIES) {
      if (!MANUFACTURING_TABLE.some(r => r.category === c)) continue;
      expect(html, `no heading for "${c}"`).toContain(`<h2>${esc(c)}</h2>`);
    }
  });

  it("prints each recipe's DC and time, not just its name", () => {
    // A list of names is a shopping list; the numbers are the recipe.
    const html = textOf("Manufacturing");
    const sword = MANUFACTURING_TABLE.find(r => r.name === "Longsword");
    expect(html).toContain(`<td>${sword.dc}</td>`);
    expect(html).toContain(`<td>${sword.hours} hrs</td>`);
  });

  it("lists every alchemy ingredient on the page for its role", () => {
    const ROLE_PAGE = {
      "potion-effect":    "Alchemy — Potion Effects",
      "potion-modifier":  "Alchemy — Potion Modifiers",
      "toxin-effect":     "Alchemy — Poison Effects",
      "toxin-modifier":   "Alchemy — Poison Modifiers",
      "both-modifier":    "Alchemy — Either",
      "enchantment":      "Alchemy — Enchantments"
    };

    const missing = [];
    for (const i of ALCHEMY_INGREDIENTS) {
      const target = ROLE_PAGE[i.role];
      if (!target) continue;                     // enchantment-base has no page
      if (!textOf(target).includes(esc(i.name))) missing.push(`${i.name} (${i.role})`);
    }
    expect(missing, `absent from the journal: ${missing.join(", ")}`).toEqual([]);
  });

  it("names every home remedy, and what it is brewed from", () => {
    const html = textOf("Home Remedies");
    for (const [ingredient, name] of Object.entries(REMEDY_NAME)) {
      expect(html, `"${name}" missing`).toContain(esc(name));
      expect(html, `"${name}" does not say it comes from ${ingredient}`).toContain(esc(ingredient));
    }
  });

  it("explains how a brew's DC is built", () => {
    // The one rule a player needs before any ingredient list is useful.
    expect(textOf("Alchemy — How a Brew Works")).toMatch(/DC 10 plus/i);
  });
});
