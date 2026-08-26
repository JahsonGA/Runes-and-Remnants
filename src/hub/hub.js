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
import { HUB_TABS, HUB_TAB_IDS, resolveTab, SCROLL_REGIONS } from "../data/hub-tabs.js";
import { CraftPanel } from "../craft/panel.js";
import { partsFromActor, getRecipe, planManufacture, selectReagents, alchemyModifier } from "../craft/logic.js";
import { craftSummary, alchemySummary, enchantSummary, summaryToHtml } from "../craft/summary.js";
import { confirmSpend } from "../ui/confirm.js";
import { requestCraft } from "../craft/execute.js";
import { EnchantPanel } from "../enchant/panel.js";
import { requestEnchant, casterFrom } from "../enchant/execute.js";
import { enchantPlan } from "../enchant/logic.js";

export { HUB_TABS };

export class RunesHub extends HarvestMenu {
  constructor(initialTokenDoc = null, options = {}) {
    super(initialTokenDoc, options);
    this.activeTab = resolveTab(options.tab);

    // Crafting keeps its own state in its own controller. Harvest still lives
    // in the base class; it moves here too once it is worth the churn.
    this.craft = new CraftPanel();
    this.enchant = new EnchantPanel();

    // Who is at the workbench. Null means "whoever is harvesting" — the old
    // behaviour — but it can now be set independently, because the person who
    // guts the corpse is not always the one who works the forge.
    this.crafter = null;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "rnr-hub",
      title: "Runes & Remnants",
      template: "modules/runes-and-remnants/templates/hub.html",
      width: 760,
      // Not "auto". The crafting catalogue runs to a hundred entries, and an
      // auto-height window grows to fit all of them — off the bottom of the
      // screen. A fixed frame with the catalogue scrolling inside it keeps
      // the workbench visible while you browse.
      height: 720,
      resizable: true,
      // Foundry rebuilds the DOM on every render, which drops scroll position.
      // Without this, adding the fourth component to a harvest list throws you
      // back to the top before you can pick the fifth.
      scrollY: SCROLL_REGIONS,
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
      ...this.enchant.getData(this._caster()),
      ...this._crafterRole(
        this.activeTab === "enchanting" ? "Enchanter" : "Crafter",
        this.activeTab === "enchanting"
          ? "icons/skills/trades/academics-book-study-purple.webp"
          : "icons/skills/trades/academics-merchant-scribe.webp"),
      activeTab: this.activeTab,
      tabs: HUB_TABS.map(t => ({ ...t, active: t.id === this.activeTab }))
    };
  }

  /**
   * The actor at the workbench.
   *
   * An explicit choice wins; otherwise it falls back to the harvester, so a
   * party that just carved a corpse can cost out a build without picking
   * anyone twice. The panel says which of the two it is.
   */
  _crafterActor() {
    return game.actors?.get(this.crafter?.actorId)
        ?? game.actors?.get(this.harvester?.actorId)
        ?? null;
  }

  /** What the crafter picker renders. */
  _crafterRole(label, icon) {
    const actor = this._crafterActor();
    const taken = this.crafter?.actorId ?? null;

    return {
      crafterLabel: label,
      crafterIcon: icon,
      crafterActor: actor && {
        id: actor.id,
        name: actor.name,
        img: this._getPortrait(actor),
        // Flagged so a player can tell an inherited choice from a made one.
        inherited: !taken
      },
      availableForCrafter: this._getAvailableActors()
    };
  }

  _crafter() {
    const actor = this._crafterActor();
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
      proficiency: actor.system?.attributes?.prof ?? 2,
      // What they are carrying that a brew could use. Read fresh each render
      // so a harvest made a moment ago shows up on the bench immediately.
      parts: partsFromActor(actor)
    };
  }

  /**
   * Who is at the enchanting bench.
   *
   * The same actor as the crafter, plus their spellcasting and the mundane
   * items they could bind something into. Enchanting needs more of the sheet
   * than crafting does — "only a spellcaster can bind a remnant".
   */
  _caster() {
    const actor = this._crafterActor();
    if (!actor) return null;

    return {
      ...casterFrom(actor),
      parts: partsFromActor(actor),
      // Only mundane gear is enchantable; something already bound is Phase 6's
      // problem, and harvested parts are ingredients rather than targets.
      items: actor.items.filter(i =>
        ["weapon", "equipment"].includes(i.type)
        && !i.flags?.["runes-and-remnants"]?.enchanted
        && !partsFromActor({ items: [i] }).length
      )
    };
  }

  /**
   * Show what a craft will cost and wait for a yes.
   *
   * The summary is built from the same functions the execution uses, so the
   * numbers a player agrees to are the numbers that get applied.
   */
  async _confirmCraft() {
    const crafter = this._crafter();

    const summary = this.craft.mode === "alchemy"
      ? alchemySummary({
          concoction: this.craft._concoction(),
          bench: this.craft.bench,
          bonus: alchemyModifier({
            int: crafter?.abilities?.int ?? 0,
            wis: crafter?.abilities?.wis ?? 0,
            proficient: (crafter?.tools ?? []).includes("Alchemist's supplies"),
            proficiency: crafter?.proficiency ?? 2
          })
        })
      : (() => {
          const recipe = getRecipe(this.craft.recipe);
          if (!recipe || !crafter) return null;
          return craftSummary({
            recipe,
            plan: planManufacture(recipe, crafter, crafter.parts ?? []),
            selection: selectReagents(recipe, crafter.parts ?? [])
          });
        })();

    if (!summary) return true;   // nothing to warn about; let it through
    return confirmSpend({
      title: summary.title,
      content: summaryToHtml(summary),
      confirmLabel: this.craft.mode === "alchemy" ? "Brew it" : "Craft it"
    });
  }

  /** Show what a binding will cost and wait for a yes. */
  async _confirmEnchant() {
    const caster = this._caster();
    if (!caster) return true;

    const parts = caster.parts ?? [];
    const plan = enchantPlan({
      enchantment: this.enchant.enchantment,
      item: (caster.items ?? []).find(i => i.id === this.enchant.itemId) ?? null,
      remnant: parts.find(p => p.id === this.enchant.remnantId) ?? null,
      component: parts.find(p => p.id === this.enchant.componentId) ?? null,
      caster,
      attunement: this.enchant.attunement,
      consumable: this.enchant.consumable
    });

    const summary = enchantSummary({ plan });
    if (!summary) return true;
    return confirmSpend({
      title: summary.title,
      content: summaryToHtml(summary),
      confirmLabel: "Bind it"
    });
  }

  activateListeners(html) {
    super.activateListeners(html);
    this.craft.activateListeners(html, () => this.render(true));
    this.enchant.activateListeners(html, () => this.render(true));

    // Crafting needs the actor, which the panel deliberately does not know
    // about — it is handed shaped data, not documents. So the hub owns this.
    html.on("click", "[data-action='do-craft']", async () => {
      const actorId = this._crafterActor()?.id;
      if (!actorId) return ui.notifications?.warn("Choose who is at the bench first.");

      // Nothing is spent until the player has seen what it costs.
      if (!await this._confirmCraft()) return;

      await requestCraft(this.craft.mode === "alchemy"
        ? { actorId, bench: [...this.craft.bench] }
        : { actorId, recipe: this.craft.recipe });

      this.render(true);   // inventory changed; the bench must catch up
    });

    html.on("click", "[data-action='do-enchant']", async () => {
      const actorId = this._crafterActor()?.id;
      if (!actorId) return ui.notifications?.warn("Choose who is at the bench first.");

      // Binding is the least reversible thing in the module — the remnant and
      // component go whatever the roll, and a bad enough miss takes the item.
      if (!await this._confirmEnchant()) return;

      await requestEnchant({
        actorId,
        itemId: this.enchant.itemId,
        enchantment: this.enchant.enchantment,
        remnantId: this.enchant.remnantId,
        componentId: this.enchant.componentId,
        attunement: this.enchant.attunement,
        consumable: this.enchant.consumable
      });

      // The item was renamed and its materials spent; every selection is stale.
      this.enchant.itemId = null;
      this.enchant.remnantId = null;
      this.enchant.componentId = null;
      this.render(true);
    });

    html.on("click", "[data-action='set-crafter']", ev => {
      const el = ev.currentTarget;
      this.crafter = {
        actorId: el.dataset.actorId,
        name: el.dataset.actorName,
        img: el.dataset.actorImg
      };
      this.render(true);
    });

    html.on("click", "[data-action='remove-crafter']", () => {
      // Clearing an explicit choice falls back to the harvester rather than
      // to nobody, which is the more useful of the two.
      this.crafter = null;
      this.render(true);
    });

    // Delegated, so the in-panel "go harvest" shortcuts work too.
    html.on("click", "[data-action='switch-tab']", ev => {
      const tab = ev.currentTarget.dataset.tab;
      if (!HUB_TAB_IDS.has(tab) || tab === this.activeTab) return;
      this.activeTab = tab;
      this.render(true);
    });
  }
}
