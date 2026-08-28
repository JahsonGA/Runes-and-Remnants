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
import { EnchantPanel } from "../../src/enchant/panel.js";
import { HUB_TABS } from "../../src/data/hub-tabs.js";
import { HARVEST_TABLE } from "../../src/data/harvest-table.js";

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
  Handlebars.registerPartial("rnrCrafterPicker", read("templates/partials/crafter.html"));
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
 * A spellcaster at the enchanting bench, carrying enough to bind something.
 * Same principle as fullCrafter — layout bugs hide in the fullest state.
 */
export function fullCaster(over = {}) {
  return {
    ability: "int",
    abilityMod: 4,
    skills: ["Survival", "Arcana"],
    proficiency: 3,
    isCaster: true,
    items: [
      { id: "w1", name: "Longsword", type: "weapon" },
      { id: "a1", name: "Half Plate", type: "equipment", system: { armor: { type: "medium" } } }
    ],
    parts: [
      { id: "r1", name: "Essence (Potent)", dc: 35, creatureType: "dragon", essence: true },
      { id: "r2", name: "Essence (Frail)", dc: 25, creatureType: "beast", essence: true },
      { id: "c1", name: "Pouch of Teeth", dc: 10, creatureType: "dragon" },
      { id: "c2", name: "Poison Gland (Poison)", dc: 20, creatureType: "monstrosity" },
      { id: "c3", name: "Heart", dc: 20, creatureType: "dragon" }
    ],
    ...over
  };
}

/**
 * A fully-loaded harvest panel: a real creature's component tiers, roles
 * filled, a list building. The empty state hides layout bugs, so the harness
 * renders the busiest case a table would actually see.
 */
function harvestData() {
  const tiers = HARVEST_TABLE.dragon.map(tier => ({
    dc: tier.dc,
    items: tier.items.map(name => ({ name, missing: false, taken: 0 }))
  }));

  const actor = id => ({ actorId: id, name: id, img: "icons/svg/mystery-man.svg" });

  return {
    hasTarget: true,
    targetName: "Adult Black Dragon",
    targetImg: "icons/svg/mystery-man.svg",
    targetType: "dragon",
    targetCR: 14,
    targetSize: "huge",
    maxHelpers: 6,
    hasComponents: true,
    componentTiers: tiers,
    essence: { name: "Essence of the Ancient", dc: 40, taken: 0 },
    assessor: actor("Assessor"),
    harvester: actor("Harvester"),
    helpers: [actor("Ape"), actor("Adult Black Dragon")],
    availableForAssessor: [actor("Someone Else")],
    availableForHarvester: [actor("Someone Else")],
    availableHelpers: [actor("Someone Else")],
    potentialBonus: 3,
    sameActor: false,
    hasHarvestList: true,
    harvestList: [
      { name: "Eye", order: 1, componentDC: 5, harvestDC: 5, unknown: false },
      { name: "Pouch of Teeth", order: 2, componentDC: 10, harvestDC: 15, unknown: false },
      { name: "Heart", order: 3, componentDC: 20, harvestDC: 35, unknown: false }
    ]
  };
}

/**
 * Full HTML document for one hub state.
 *
 * The shell reproduces Foundry's window chrome closely enough for layout to
 * mean something: a fixed-width application frame with the module's own
 * stylesheet inside it.
 */
export function hubPage({ tab = "crafting", recipe = null, bench = [], mode = null,
                          crafter = null, enchant = null, caster = null,
                          crafterActor = undefined, craft = null,
                          castersOnly = false, availableForCrafter = undefined } = {}) {
  registerOnce();

  const panel = new CraftPanel();
  if (mode) panel.mode = mode;
  if (recipe) panel.recipe = recipe;
  panel.bench = bench;
  Object.assign(panel, craft ?? {});

  const ench = new EnchantPanel();
  Object.assign(ench, enchant ?? {});

  const data = {
    ...panel.getData(crafter),
    ...ench.getData(caster),
    activeTab: tab,
    tabs: HUB_TABS.map(t => ({ ...t, active: t.id === tab })),
    ...harvestData(),
    // The crafter picker, as RunesHub._crafterRole would shape it.
    crafterLabel: tab === "enchanting" ? "Enchanter" : "Crafter",
    crafterIcon: "icons/skills/trades/academics-merchant-scribe.webp",
    crafterActor: crafterActor === undefined
      ? { id: "h1", name: "Harvester", img: "icons/svg/mystery-man.svg", inherited: true }
      : crafterActor,
    castersOnly,
    availableForCrafter: availableForCrafter ?? [
      { id: "a1", name: "Someone Else", img: "icons/svg/mystery-man.svg" },
      { id: "a2", name: "A Third Party", img: "icons/svg/mystery-man.svg" }
    ]
  };

  return `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  /* Stand-in for Foundry's own window chrome. Only the frame — everything
     inside comes from the module's real stylesheet. */
  body { margin: 0; background: #2b2a29; font-family: "Signika", sans-serif; }
  /* Foundry's own window chrome, copied rather than improved on.
     .window-app is a flex column and .window-content is flex:1 with its own
     overflow-y — that is all the module gets to build on, so the harness must
     not add to it. An earlier version set display:flex here too, which meant
     module.css was never proven sufficient by itself and the panel scrolled
     in the test while staying stuck in Foundry. */
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
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    box-sizing: border-box;
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
