// =========================================================
// Runes & Remnants — Hub
// =========================================================
//
// The single window for the whole module: Harvest, Crafting, Enchanting.
//
// It extends HarvestMenu rather than wrapping it. Harvest is the only
// implemented system, all of its state and listeners already live there, and
// inheriting means the working (and tested) harvest path is untouched — the
// hub only adds tab state and swaps which panel the template renders.
//
// When crafting gains real state of its own, that is the point to split this
// into a shell plus per-panel controllers.

import { HarvestMenu } from "../harvest/menu.js";
import { HUB_TABS, HUB_TAB_IDS, resolveTab } from "../data/hub-tabs.js";
import { CraftPanel } from "../craft/panel.js";

export { HUB_TABS };

export class RunesHub extends HarvestMenu {
  constructor(initialTokenDoc = null, options = {}) {
    super(initialTokenDoc, options);
    this.activeTab = resolveTab(options.tab);

    // Crafting keeps its own state in its own controller. Harvest still lives
    // in the base class; it moves here too once it is worth the churn.
    this.craft = new CraftPanel();
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "rnr-hub",
      title: "Runes & Remnants",
      template: "modules/runes-and-remnants/templates/hub.html",
      width: 760,
      height: "auto",
      classes: ["rnr-harvest", "grimdark", "rnr-hub-app"]
    });
  }

  /**
   * Opens the hub, reusing the window if it is already up.
   * Foundry keys applications by id, so a second `new RunesHub()` would
   * otherwise fight the first over the same DOM node.
   */
  static open({ tokenDoc = null, tab = "harvest" } = {}) {
    const existing = Object.values(ui.windows ?? {}).find(a => a instanceof RunesHub);

    if (existing) {
      if (tokenDoc) {
        existing.targetToken = tokenDoc;
        existing.targetActor = tokenDoc.actor ?? null;
        // A new corpse invalidates a list built against the old one.
        existing.harvestList = [];
      }
      existing.activeTab = resolveTab(tab, existing.activeTab);
      existing.render(true);
      existing.bringToTop?.();
      return existing;
    }

    return new RunesHub(tokenDoc, { tab }).render(true);
  }

  async getData() {
    const data = await super.getData();

    return {
      ...data,
      ...this.craft.getData(this._crafter()),
      activeTab: this.activeTab,
      tabs: HUB_TABS.map(t => ({ ...t, active: t.id === this.activeTab }))
    };
  }

  /**
   * Who is at the workbench. Reuses the harvester if one is assigned, so a
   * party that just carved a corpse can cost out a build with the same
   * character's hands. Null until then — the panel shows requirements
   * rather than pretending nobody is proficient.
   */
  _crafter() {
    const actor = game.actors?.get(this.harvester?.actorId);
    if (!actor) return null;

    const abilities = {};
    for (const [key, data] of Object.entries(actor.system?.abilities ?? {})) {
      abilities[key] = data?.mod ?? 0;
    }

    // dnd5e stores tool proficiencies as keys; the labels are what the
    // manufacturing table names, so match loosely on the label text.
    const toolProf = actor.system?.traits?.toolProf?.value ?? new Set();
    const tools = Array.from(toolProf).map(String);

    return {
      abilities,
      tools,
      proficiency: actor.system?.attributes?.prof ?? 2
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    this.craft.activateListeners(html, () => this.render(true));

    // Delegated, so the in-panel "go harvest" shortcuts work too.
    html.on("click", "[data-action='switch-tab']", ev => {
      const tab = ev.currentTarget.dataset.tab;
      if (!HUB_TAB_IDS.has(tab) || tab === this.activeTab) return;
      this.activeTab = tab;
      this.render(true);
    });
  }
}
