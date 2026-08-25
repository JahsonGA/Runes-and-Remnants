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
  componentsWithProperty
} from "./logic.js";
import { ENCHANTMENT_BASE } from "../data/alchemy.js";
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
  }

  /**
   * Template data for the crafting tab.
   * @param {object|null} crafter { abilities, tools, proficiency } — optional;
   *        without one the panel shows requirements but no personal bonus.
   */
  getData(crafter = null) {
    return {
      craftMode: this.mode,
      recipeGroups: this._recipeGroups(),
      ingredientGroups: this._ingredientGroups(),
      plan: this._plan(crafter),
      bench: this._bench(),
      concoction: this._concoction(),
      hasBench: this.bench.length > 0
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

    html.on("click", "[data-action='clear-bench']", () => {
      this.bench = [];
      this.recipe = null;
      rerender();
    });
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
        tool: recipe.tools.join(" or "),
        abilityLabel: options.join(" or "),
        bonusLabel: "",
        materialLabel,
        proficient: false,
        disadvantage: false,
        reagents: this._reagents(recipe, [], true)
      };
    }

    const plan = planManufacture(recipe, crafter, crafter.parts ?? []);
    return {
      ...plan,
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
    const check = checkReagents(recipe, parts);
    if (!check.required) return null;

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
      used: check.used.map(p => ({
        name: p.name,
        potency: p.potency,
        creatureType: p.creatureType ?? null,
        // A part with no recorded origin was valued at the lowest DC it
        // could be, which is worth saying out loud — the player may be owed
        // more if the GM remembers what it came off.
        assumed: !p.stamped
      })),
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
