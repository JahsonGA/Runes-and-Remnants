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

export { HUB_TABS };

export class RunesHub extends HarvestMenu {
  constructor(initialTokenDoc = null, options = {}) {
    super(initialTokenDoc, options);
    this.activeTab = resolveTab(options.tab);
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
      activeTab: this.activeTab,
      tabs: HUB_TABS.map(t => ({ ...t, active: t.id === this.activeTab }))
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Delegated, so the in-panel "go harvest" shortcuts work too.
    html.on("click", "[data-action='switch-tab']", ev => {
      const tab = ev.currentTarget.dataset.tab;
      if (!HUB_TAB_IDS.has(tab) || tab === this.activeTab) return;
      this.activeTab = tab;
      this.render(true);
    });
  }
}
