// =========================================================
// Runes & Remnants — Crafting panel controller
//
// Holds the crafting tab's state and turns it into template data. The hub
// owns one of these and delegates to it, which is the shell/panel split
// HubDetails.md said would be due once crafting had state of its own.
//
// No Foundry globals at module scope — all the arithmetic lives in
// craft/logic.js, and this only shapes it for display.
// =========================================================

import {
  getRecipe,
  getRecipesByCategory,
  planManufacture,
  abilitiesForRecipe,
  materialYardstick,
  getIngredient,
  ingredientsByRole,
  analyseConcoction,
  checkReagents,
  reagentRequirement,
  componentsWithProperty,
  selectReagents
} from "./logic.js";
import { ENCHANTMENT_BASE } from "../data/alchemy.js";
import { TOOL_ABILITY } from "../data/manufacturing.js";
import { PROPERTY_LABELS, PROPERTY_HINTS } from "../data/reagents.js";

const ABILITY_LABEL = { str: "Str", dex: "Dex", con: "Con", int: "Int", wis: "Wis", cha: "Cha" };

const ROLE_LABEL = {
  "potion-effect":    "Effect",
  "toxin-effect":     "Effect",
  "potion-modifier":  "Modifier",
  "toxin-modifier":   "Modifier",
  "both-modifier":    "Modifier",
  "enchantment":      "Enchantment",
  "enchantment-base": "Base"
};

const KIND_LABEL = { potion: "Potion", poison: "Poison", enchantment: "Enchantment", unknown: "Incomplete" };

/** Ingredient pool groupings, in the order they should be offered. */
const POOL_GROUPS = [
  { label: "Potion — Effects",   roles: ["potion-effect"] },
  { label: "Potion — Modifiers", roles: ["potion-modifier"] },
  { label: "Poison — Effects",   roles: ["toxin-effect"] },
  { label: "Poison — Modifiers", roles: ["toxin-modifier"] },
  { label: "Either",             roles: ["both-modifier"] },
  { label: "Enchantment",        roles: ["enchantment-base", "enchantment"], isEnchant: true }
];

/**
 * Names the tools a build can use, without letting the list run away.
 *
 * "Wondrous item" accepts all nineteen artisan tools, which joined with
 * " or " comes to 386 characters — enough to force the workbench table wider
 * than the window and push every other value off-screen. Summarise instead.
 */
function toolLabel(tools = [], allToolCount = 0) {
  if (!tools.length) return "—";
  if (allToolCount && tools.length >= allToolCount) return "Any artisan's tools";
  if (tools.length <= 3) return tools.join(" or ");
  return `${tools.slice(0, 2).join(", ")} or ${tools.length - 2} others`;
}

/** Renders a DC modifier the way the source tables do: +2, −2, or a dash. */
function signOf(dc) {
  if (dc > 0) return "+";
  if (dc < 0) return "−";
  return "";
}
function magnitude(dc) {
  return dc === 0 ? "—" : Math.abs(dc);
}

export class CraftPanel {
  constructor() {
    this.mode = "manufacturing";
    /** Selected mundane recipe, by name. */
    this.recipe = null;
    /** Ordered ingredient names on the alchemy bench. */
    this.bench = [];
    /** Catalogue filter text. A hundred recipes is too many to scan. */
    this.filter = "";
    /**
     * Parts the player has switched off, by item id.
     *
     * Selection is automatic by default — cheapest first, so scraps go before
     * trophies — but a player who wants to keep a particular part has to be
     * able to say so. The pills looked clickable long before they were.
     */
    this.reagentExcluded = new Set();
  }

  /** What is still in play: everything held, less what has been switched off. */
  includedParts(parts = []) {
    return (parts ?? []).filter(p => !this.reagentExcluded.has(p?.id));
  }

  /** Ids switched off, for the request that actually does the spending. */
  excludedIds() {
    return [...this.reagentExcluded];
  }

  /**
   * Template data for the crafting tab.
   * @param {object|null} crafter { abilities, tools, proficiency } — optional;
   *        without one the panel shows requirements but no personal bonus.
   */
  getData(crafter = null) {
    return {
      craftMode: this.mode,
      // The card used to be headed "Manufacturing" in both modes, which read
      // as a bug even when the contents below it were right.
      modeLabel: this.mode === "alchemy" ? "Alchemy" : "Manufacturing",
      filterNoun: this.mode === "alchemy" ? "ingredients" : "recipes",
      filter: this.filter,
      recipeGroups: this._recipeGroups(),
      ingredientGroups: this._ingredientGroups(),
      plan: this._plan(crafter),
      bench: this._bench(),
      concoction: this._concoction(),
      hasBench: this.bench.length > 0,
      ...this._craftAction(crafter)
    };
  }

  /**
   * State of the Craft button.
   *
   * Disabled rather than hidden when something is missing, with the reason in
   * the tooltip and below the button — a control that vanishes leaves the
   * player guessing what they did wrong.
   */
  _craftAction(crafter) {
    if (this.mode === "alchemy") {
      const concoction = this._concoction();
      if (!this.bench.length) return { canCraft: false };
      return {
        canCraft: true,
        craftLabel: "Brew it",
        craftBlocked: !concoction?.valid,
        craftHint: concoction?.valid
          ? `One Alchemy check against DC ${concoction.dc}.`
          : (concoction?.errors?.[0] ?? "That mixture will not hold together.")
      };
    }

    const recipe = getRecipe(this.recipe);
    if (!recipe) return { canCraft: false };
    if (!crafter) {
      return {
        canCraft: true,
        craftLabel: "Craft it",
        craftBlocked: true,
        craftHint: "Assign a harvester first — crafting needs someone's hands and their pack."
      };
    }

    const plan = planManufacture(recipe, crafter, this.includedParts(crafter.parts));
    if (plan.blocked) {
      return {
        canCraft: true,
        craftLabel: "Craft it",
        craftBlocked: true,
        craftHint: `Short ${plan.reagents.shortfall} potency of `
                 + `${plan.reagents.properties.map(p => PROPERTY_LABELS[p] ?? p).join(" or ")} parts.`
      };
    }

    const selection = selectReagents(recipe, this.includedParts(crafter.parts));
    return {
      canCraft: true,
      craftLabel: "Craft it",
      craftBlocked: false,
      // Naming what will be spent before the click, not after.
      craftHint: `Spends ${selection.parts.map(p => p.name).join(", ")}`
               + `${plan.disadvantage ? " · at disadvantage, no tool proficiency" : ""}.`
    };
  }

  /**
   * @param {object} html    jQuery-wrapped panel root (ApplicationV1)
   * @param {Function} rerender  called whenever state changes
   */
  activateListeners(html, rerender = () => {}) {
    html.on("click", "[data-action='craft-mode']", ev => {
      const mode = ev.currentTarget.dataset.mode;
      if (mode !== "manufacturing" && mode !== "alchemy") return;
      if (mode === this.mode) return;
      this.mode = mode;
      rerender();
    });

    html.on("click", "[data-action='pick-recipe']", ev => {
      const name = ev.currentTarget.dataset.name;
      // Clicking the selected item again clears it.
      this.recipe = this.recipe === name ? null : name;
      rerender();
    });

    html.on("click", "[data-action='pick-ingredient']", ev => {
      this.bench.push(ev.currentTarget.dataset.name);
      rerender();
    });

    html.on("click", "[data-action='remove-ingredient']", ev => {
      const i = Number(ev.currentTarget.closest("[data-index]")?.dataset.index);
      if (Number.isInteger(i)) this.bench.splice(i, 1);
      rerender();
    });

    html.on("click", "[data-action='toggle-reagent']", ev => {
      const id = ev.currentTarget.dataset.value;
      if (!id) return;
      if (this.reagentExcluded.has(id)) this.reagentExcluded.delete(id);
      else this.reagentExcluded.add(id);
      rerender();
    });

    html.on("click", "[data-action='clear-bench']", () => {
      this.bench = [];
      this.recipe = null;
      rerender();
    });

    // Filtering happens in the DOM rather than through a re-render. Foundry
    // rebuilds the whole application on render, which would drop focus and
    // the caret on every keystroke.
    html.on("input", "[data-action='filter']", ev => {
      this.filter = ev.currentTarget.value;
      this.applyFilter(ev.currentTarget.closest(".rnr-card"));
    });

    // Re-apply after a render, so picking a recipe does not silently clear
    // the filter the player is working within.
    const root = html instanceof HTMLElement ? html : html?.[0];
    const card = root?.querySelector?.(".rnr-filter")?.closest(".rnr-card");
    if (card && this.filter) this.applyFilter(card);
  }

  /**
   * Show only entries matching the filter, and hide any group left empty.
   * @param {HTMLElement} card the catalogue card
   */
  applyFilter(card) {
    if (!card) return;
    const needle = this.filter.trim().toLowerCase();
    let shown = 0;

    for (const group of card.querySelectorAll(".rnr-catalogue .rnr-tier")) {
      let visible = 0;
      for (const li of group.querySelectorAll("li")) {
        const name = (li.querySelector("[data-name]")?.dataset.name ?? li.textContent)
          .toLowerCase();
        const hit = !needle || name.includes(needle);
        li.hidden = !hit;
        if (hit) visible++;
      }
      // A category header with nothing under it is just noise.
      group.hidden = visible === 0;
      shown += visible;
    }

    const empty = card.querySelector(".rnr-no-matches");
    if (empty) empty.hidden = shown > 0;
  }

  // ---------------------- shaping ----------------------

  _recipeGroups() {
    return getRecipesByCategory().map(group => ({
      category: group.category,
      recipes: group.recipes.map(r => ({
        name: r.name,
        dc: r.dc,
        hours: r.hours,
        rarity: r.rarity ?? null,
        // Named so a GM can see at a glance which entries came from their own
        // books rather than from the module.
        source: r.srd === false ? (r.source ?? "third-party") : null,
        selected: r.name === this.recipe
      }))
    }));
  }

  _ingredientGroups() {
    const picked = new Set(this.bench);
    return POOL_GROUPS.map(group => ({
      label: group.label,
      isEnchant: Boolean(group.isEnchant),
      items: group.roles
        .flatMap(role => ingredientsByRole(role))
        .map(i => ({
          name: i.name,
          effect: i.effect,
          dc: magnitude(i.dc),
          sign: signOf(i.dc),
          picked: picked.has(i.name)
        }))
    })).filter(g => g.items.length > 0);
  }

  _plan(crafter) {
    const recipe = getRecipe(this.recipe);
    if (!recipe) return null;

    const material = materialYardstick(recipe);
    const materialLabel = material === null ? "GM's call" : `~${material} gp worth`;

    // With no crafter chosen, show what the job needs rather than pretending
    // someone is unproficient at it.
    if (!crafter) {
      const options = abilitiesForRecipe(recipe).map(a => ABILITY_LABEL[a] ?? a);
      return {
        item: recipe.name,
        dc: recipe.dc,
        hours: recipe.hours,
        tool: toolLabel(recipe.tools, Object.keys(TOOL_ABILITY).length),
        toolTitle: recipe.tools.join(", "),
        abilityLabel: options.join(" or "),
        bonusLabel: "",
        materialLabel,
        proficient: false,
        disadvantage: false,
        reagents: this._reagents(recipe, [], true)
      };
    }

    const plan = planManufacture(recipe, crafter, this.includedParts(crafter.parts));
    return {
      ...plan,
      // planManufacture picks the one tool they can actually use; fall back
      // to a summary rather than the full list when they have none of them.
      tool: plan.proficient ? plan.tool : toolLabel(recipe.tools, Object.keys(TOOL_ABILITY).length),
      toolTitle: recipe.tools.join(", "),
      abilityLabel: ABILITY_LABEL[plan.ability] ?? plan.ability ?? "—",
      bonusLabel: plan.bonus >= 0 ? `+${plan.bonus}` : String(plan.bonus),
      materialLabel,
      reagents: this._reagents(recipe, crafter.parts ?? [])
    };
  }

  /**
   * The reagent requirement, shaped for display.
   *
   * When the crafter is short, this lists what *would* work rather than only
   * saying no — the point of the property model is that many monsters
   * qualify, and a player can only act on that if they can see it.
   */
  _reagents(recipe, parts, unknownStock = false) {
    // Everything matching, so a part the player has switched off is still on
    // screen and can be switched back on.
    const all = checkReagents(recipe, parts);
    if (!all.required) return null;

    const kept = this.includedParts(parts);
    const check = checkReagents(recipe, kept);
    const selection = selectReagents(recipe, kept);
    // selectReagents works in units, so one stack can appear several times;
    // what matters here is only whether an item is drawn on at all.
    const spending = new Set(selection.parts.map(p => p.id));

    const need = reagentRequirement(recipe);
    const properties = check.properties ?? [];
    return {
      properties,
      // "Structural or Fibrous" — the alternatives matter, so all of them
      // are named rather than only the first.
      propertyLabel: properties.map(p => PROPERTY_LABELS[p] ?? p).join(" or "),
      hint: properties.map(p => PROPERTY_HINTS[p] ?? "").filter(Boolean).join(" · "),
      needed: check.needed,
      potency: check.potency,
      shortfall: check.shortfall,
      met: check.met,
      // With nobody at the bench we have no inventory to weigh, so the panel
      // states the requirement rather than reporting a shortfall that only
      // means "no character is assigned".
      unknownStock,
      themed: check.themed,
      themeLabel: (need?.theme ?? []).join(" or "),
      dcAdjust: check.dcAdjust,
      // Three states, because "will be spent" and "could be spent" are
      // different things and the panel used to draw them identically — four
      // Bones all looking chosen when only one was going in.
      used: all.used.map(p => ({
        id: p.id,
        name: p.name,
        potency: p.potency,
        creatureType: p.creatureType ?? null,
        excluded: this.reagentExcluded.has(p.id),
        spending: spending.has(p.id),
        // A part with no recorded origin was valued at the lowest DC it
        // could be, which is worth saying out loud — the player may be owed
        // more if the GM remembers what it came off.
        assumed: !p.stamped
      })),
      spendingCount: spending.size,
      excludedCount: all.used.filter(p => this.reagentExcluded.has(p.id)).length,
      // A sample, not the list of 60: enough to point somewhere useful.
      suggestions: check.met ? [] : componentsWithProperty(properties).slice(0, 8)
    };
  }

  _bench() {
    return this.bench.map((name, i) => {
      const ing = getIngredient(name);
      return {
        name,
        order: i + 1,
        unknown: !ing,
        roleLabel: ing ? (ROLE_LABEL[ing.role] ?? ing.role) : "unknown",
        dc: ing ? magnitude(ing.dc) : "—",
        sign: ing ? signOf(ing.dc) : ""
      };
    });
  }

  _concoction() {
    const result = analyseConcoction(this.bench);
    return {
      ...result,
      kindLabel: KIND_LABEL[result.kind] ?? result.kind,
      toolLabel: (result.tools ?? []).join(" or ")
    };
  }
}

export { ENCHANTMENT_BASE };
