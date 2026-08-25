// =========================================================
// Runes & Remnants — Browser test harness
//
// Renders the module's real templates, with the module's real stylesheet,
// inside a shell that mimics a Foundry application window. No Foundry, no
// server, no fixtures copied by hand — if the panel renders differently in
// the module it renders differently here.
//
// This exists because a layout bug cannot be caught by asserting on strings.
// "Adventuring gear (generic)" listed all nineteen artisan tools joined into
// a 386-character cell, which forced the workbench table wider than the
// window and pushed every other value off-screen. Every string assertion
// passed. Only a browser could see it.
// =========================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";
import { CraftPanel } from "../../src/craft/panel.js";
import { HUB_TABS } from "../../src/data/hub-tabs.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");

/** The size the hub actually opens at. See RunesHub.defaultOptions. */
export const HUB_WIDTH = 760;
export const HUB_HEIGHT = 720;

let registered = false;
function registerOnce() {
  if (registered) return;
  Handlebars.registerHelper("eq", (a, b) => a === b);
  for (const tab of HUB_TABS) {
    const partial = `rnr${tab.id[0].toUpperCase()}${tab.id.slice(1)}Panel`;
    Handlebars.registerPartial(partial, read(`templates/panels/${tab.id}.html`));
  }
  registered = true;
}

/**
 * A crafter with everything, so the panel renders its fullest state.
 * Layout bugs hide in the widest case, not the empty one.
 */
export function fullCrafter(parts = []) {
  return {
    abilities: { str: 3, dex: 2, con: 1, int: 4, wis: 0, cha: -1 },
    tools: ["Smith's tools", "Alchemist's supplies"],
    proficiency: 3,
    parts
  };
}

/**
 * Full HTML document for one hub state.
 *
 * The shell reproduces Foundry's window chrome closely enough for layout to
 * mean something: a fixed-width application frame with the module's own
 * stylesheet inside it.
 */
export function hubPage({ tab = "crafting", recipe = null, bench = [], mode = null, crafter = null } = {}) {
  registerOnce();

  const panel = new CraftPanel();
  if (mode) panel.mode = mode;
  if (recipe) panel.recipe = recipe;
  panel.bench = bench;

  const data = {
    ...panel.getData(crafter),
    activeTab: tab,
    tabs: HUB_TABS.map(t => ({ ...t, active: t.id === tab })),
    // Harvest panel fields, so its branch renders rather than throwing.
    harvester: null,
    targetName: null,
    lootTiers: [],
    harvestList: []
  };

  return `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  /* Stand-in for Foundry's own window chrome. Only the frame — everything
     inside comes from the module's real stylesheet. */
  body { margin: 0; background: #2b2a29; font-family: "Signika", sans-serif; }
  /* Fixed size, matching the real window. An auto-height frame here would
     let the catalogue grow to fit and hide the very overflow being tested. */
  .app-window {
    width: ${HUB_WIDTH}px;
    height: ${HUB_HEIGHT}px;
    margin: 0;
    background: #191813;
    border: 1px solid #000;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
  }
  .window-content {
    padding: 8px;
    box-sizing: border-box;
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
${read("styles/module.css")}
</style></head>
<body>
  <div class="app-window rnr-hub-app" id="app">
    <div class="window-content">${Handlebars.compile(read("templates/hub.html"))(data)}</div>
  </div>
</body></html>`;
}

/** Every recipe name in the shipped catalogue, for exhaustive layout sweeps. */
export async function allRecipeNames() {
  const { allRecipes } = await import("../../src/craft/logic.js");
  return allRecipes().map(r => r.name);
}
