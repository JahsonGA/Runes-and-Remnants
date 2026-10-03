// =========================================================
// Runes & Remnants — Hub tab definitions
//
// Pure data, so it stays importable from tests. Icons are Foundry core
// assets, which every install ships — no bundled art, nothing to 404.
// =========================================================

/**
 * How far along a system is. Three states, not a binary lock, because
 * crafting is genuinely in between: its catalogue, DCs, tools and times are
 * live, but rolling the check and consuming components is not built yet.
 *
 *   live    — fully playable
 *   partial — usable as reference; not fully automated
 *   planned — nothing but a design sketch
 */
export const STATUS_LABEL = {
  live: "",
  partial: "Reference",
  planned: "Planned"
};

/**
 * @typedef {{ id, label, icon, hint, status }} HubTab
 * @type {HubTab[]}
 */
export const HUB_TABS = [
  {
    id: "harvest",
    label: "Harvest",
    icon: "icons/tools/cooking/knife-cleaver-steel-grey.webp",
    hint: "Strip a corpse for components",
    status: "live"
  },
  {
    id: "crafting",
    label: "Crafting",
    icon: "icons/skills/trades/academics-merchant-scribe.webp",
    hint: "Work raw materials into mundane gear, potions and poisons",
    status: "live"
  },
  {
    id: "enchanting",
    label: "Enchanting",
    icon: "icons/skills/trades/academics-book-study-purple.webp",
    hint: "Bind monster parts and remnants into magic items",
    status: "live"
  }
].map(tab => ({
  ...tab,
  // Drives icon dimming and the badge; derived so the two never disagree.
  locked: tab.status !== "live",
  badge: STATUS_LABEL[tab.status]
}));

/**
 * Every region in the hub that scrolls.
 *
 * Foundry rebuilds the whole application on render, which drops scroll
 * position — so picking the fourth component off a long harvest list threw
 * you back to the top before you could pick the fifth. Passing these as
 * `scrollY` in defaultOptions makes Foundry save and restore them around
 * each render.
 *
 * Kept here rather than inline in hub.js so a test can check the list against
 * what the templates actually scroll; the two drifting apart is silent.
 */
export const SCROLL_REGIONS = [
  ".rnr-catalogue",
  ".rnr-bench-body",
  ".rnr-card",
  ".rnr-dropdown"
];

/** Tab ids, for validating what a caller asked to open. */
export const HUB_TAB_IDS = new Set(HUB_TABS.map(t => t.id));

/** The tab opened when none is specified, or an unknown one is. */
export const DEFAULT_TAB = "harvest";

/**
 * Normalises a requested tab id to one that exists.
 * @param {string} [tab]
 * @param {string} [fallback]
 */
export function resolveTab(tab, fallback = DEFAULT_TAB) {
  if (HUB_TAB_IDS.has(tab)) return tab;
  return HUB_TAB_IDS.has(fallback) ? fallback : DEFAULT_TAB;
}
