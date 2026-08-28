// =========================================================
// Runes & Remnants — Enchanting panel controller
//
// Holds the enchanting tab's state and shapes it for the template. Same split
// as CraftPanel: no Foundry globals, all arithmetic in logic.js, and the hub
// hands it shaped data rather than documents.
// =========================================================

import {
  ENCHANTMENTS, REMNANT_TIERS, FLAW_BANDS
} from "../data/enchanting.js";
import {
  enchantPlan, enchantmentsFor, componentsFor, remnantsFrom,
  getEnchantment, itemKind, rarityRank
} from "./logic.js";
import {
  spiritState, abilityLadder, remnantValue,
  SPIRIT_AWAKEN, SPIRIT_TOTAL
} from "./spirit.js";
import { SPIRIT_DEEDS } from "../data/spirit.js";

const KIND_LABEL = { weapon: "Weapons", armour: "Armour", wondrous: "Wondrous" };

export class EnchantPanel {
  constructor() {
    /** "bind" a remnant into an item, or "evolve" an ancestral weapon. */
    this.mode = "bind";
    /** The ancestral weapon on the Evolve side, by id. */
    this.spiritItemId = null;
    /** Item being enchanted, by id. */
    this.itemId = null;
    /** Chosen enchantment, by name. */
    this.enchantment = null;
    /** Remnant and component, by id. */
    this.remnantId = null;
    this.componentId = null;
    this.attunement = false;
    this.consumable = false;
  }

  /**
   * @param {object|null} caster { ability, abilityMod, skills, proficiency,
   *        isCaster, items, parts } — null until someone is assigned.
   */
  getData(caster = null) {
    const items = caster?.items ?? [];
    const parts = caster?.parts ?? [];

    const item = items.find(i => i.id === this.itemId) ?? null;
    const spec = getEnchantment(this.enchantment);
    const remnant = parts.find(p => p.id === this.remnantId) ?? null;
    const component = parts.find(p => p.id === this.componentId) ?? null;

    const plan = spec
      ? enchantPlan({
          enchantment: spec, item, remnant, component, caster,
          attunement: this.attunement, consumable: this.consumable
        })
      : null;

    return {
      hasCaster: Boolean(caster),
      isCaster: caster?.isCaster ?? false,
      enchantGroups: this._enchantGroups(item),
      enchantItems: items.map(i => ({
        id: i.id, name: i.name, img: i.img,
        kind: itemKind(i), selected: i.id === this.itemId
      })),
      enchantRemnants: remnantsFrom(parts).map(r => ({
        id: r.id, name: r.name, tier: r.tier.remnant, rarity: r.tier.rarity,
        creatureType: r.creatureType, selected: r.id === this.remnantId
      })),
      enchantComponents: (spec ? componentsFor(spec, parts) : []).map(c => ({
        id: c.id, name: c.name, creatureType: c.creatureType,
        selected: c.id === this.componentId
      })),
      enchantPlanData: plan,
      attunement: this.attunement,
      consumable: this.consumable,
      // The reference tables stay on the panel; they are what a table reads
      // at the bench, and they are still true now that it is automated.
      remnantTiers: REMNANT_TIERS.map(t => ({ ...t, remnant: t.remnant ?? "—" })),
      flawBands: FLAW_BANDS.map(b => ({
        range: b.maxMargin === Infinity ? "0 or better"
             : b.maxMargin === -13 ? "−13 or worse"
             : `${b.maxMargin - 3} to ${b.maxMargin}`.replace(/-/g, "−"),
        result: b.destroyed ? "Item destroyed"
              : b.flaws === 0 ? "No flaws"
              : `${b.flaws} flaw${b.flaws > 1 ? "s" : ""}`,
        destroyed: b.destroyed
      })),
      ...this._action(plan),
      ...this._spirit(caster, items)
    };
  }

  /**
   * The Evolve side: an ancestral weapon and what it can grow into.
   *
   * Kept on the enchanting tab because it is the same conversation — what a
   * weapon becomes — and because the two share a currency: a remnant can be
   * spent here instead of being bound, and doing so forecloses binding
   * forever. Splitting them across tabs would hide that trade.
   */
  _spirit(caster, items) {
    // A separate list from the bind side: an ancestral weapon may already have
    // been enchanted, so it must not be filtered out the way bind targets are.
    const weapons = caster?.weapons ?? items.filter(i => itemKind(i) === "weapon");
    const item = weapons.find(i => i.id === this.spiritItemId) ?? null;
    const state = spiritState(item);

    return {
      enchantMode: this.mode,
      spiritWeapons: weapons.map(i => {
        const s = spiritState(i);
        return {
          id: i.id, name: i.name, img: i.img,
          ancestral: s.isAncestral,
          earned: s.earned,
          selected: i.id === this.spiritItemId
        };
      }),
      spiritItem: item && { id: item.id, name: item.name },
      spirit: item ? {
        ...state,
        // A progress bar reads better than two numbers when the whole point
        // is how far off awakening still is.
        percent: Math.min(100, Math.round((state.earned / SPIRIT_TOTAL) * 100)),
        awakenAt: SPIRIT_AWAKEN,
        total: SPIRIT_TOTAL
      } : null,
      spiritLadder: item ? abilityLadder(item) : [],
      spiritDeeds: SPIRIT_DEEDS,
      // Remnants the wielder is carrying, with what each is worth as points.
      spiritRemnants: item && !state.remnantSpent
        ? remnantsFrom(caster?.parts ?? [])
            .map(r => ({ id: r.id, name: r.name, points: remnantValue(r.name) }))
            .filter(r => r.points > 0)
        : [],
      isGM: caster?.isGM ?? false
    };
  }

  /** Enchantments grouped by what they go on, the chosen item's kind first. */
  _enchantGroups(item) {
    const kind = itemKind(item);
    const groups = ["weapon", "armour", "wondrous"]
      .sort((a, b) => (b === kind) - (a === kind))
      .map(k => ({
        label: KIND_LABEL[k],
        // Named but COLLAPSED when it does not fit. Listing all three kinds
        // in full ran the column to 775px in a 598px card and pushed the
        // remnant picker below the fold — a player reported it as missing.
        // The header still says what is there, so nothing is hidden, only
        // the pills nobody can click.
        fits: !kind || k === kind,
        count: enchantmentsFor(k).length,
        items: enchantmentsFor(k)
          .sort((a, b) => rarityRank(a.rarity) - rarityRank(b.rarity))
          .map(e => ({
            name: e.name, rarity: e.rarity, effect: e.effect,
            property: e.property, selected: e.name === this.enchantment
          }))
      }));
    return groups.filter(g => g.items.length);
  }

  _action(plan) {
    if (!plan) return { canEnchant: false };
    return {
      canEnchant: true,
      enchantBlocked: !plan.valid,
      enchantLabel: "Bind it",
      enchantHint: plan.valid
        ? `Consumes ${plan.remnant} and ${plan.component}, whatever the roll.`
        : plan.blockers[0]
    };
  }

  activateListeners(html, rerender = () => {}) {
    const pick = (action, field) => html.on("click", `[data-action='${action}']`, ev => {
      const value = ev.currentTarget.dataset.value;
      // Clicking the current choice clears it, same as the crafting catalogue.
      this[field] = this[field] === value ? null : value;
      // The component must suit the enchantment, so changing one drops the other.
      if (field === "enchantment") this.componentId = null;
      rerender();
    });

    pick("pick-enchant-item", "itemId");
    pick("pick-spirit-item", "spiritItemId");
    pick("pick-enchantment", "enchantment");
    pick("pick-remnant", "remnantId");
    pick("pick-enchant-component", "componentId");

    html.on("click", "[data-action='enchant-mode']", ev => {
      const mode = ev.currentTarget.dataset.mode;
      if (mode !== "bind" && mode !== "evolve") return;
      if (mode === this.mode) return;
      this.mode = mode;
      rerender();
    });

    html.on("change", "[data-action='enchant-toggle']", ev => {
      const field = ev.currentTarget.dataset.field;
      if (field === "attunement" || field === "consumable") {
        this[field] = ev.currentTarget.checked;
        rerender();
      }
    });
  }
}

export { ENCHANTMENTS };
