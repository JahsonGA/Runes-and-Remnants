// =========================================================
// Runes & Remnants — Hub tab definitions
//
// Pure data, so it stays importable from tests. Icons are Foundry core
// assets, which every install ships — no bundled art, nothing to 404.
// =========================================================

/**
 * @typedef {{ id: string, label: string, icon: string, hint: string, locked: boolean }} HubTab
 * @type {HubTab[]}
 */
export const HUB_TABS = [
  {
    id: "harvest",
    label: "Harvest",
    icon: "icons/tools/cooking/knife-cleaver-steel-grey.webp",
    hint: "Strip a corpse for components",
    locked: false
  },
  {
    id: "crafting",
    label: "Crafting",
    icon: "icons/skills/trades/academics-merchant-scribe.webp",
    hint: "Work raw materials into mundane gear",
    locked: true
  },
  {
    id: "enchanting",
    label: "Enchanting",
    icon: "icons/skills/trades/academics-book-study-purple.webp",
    hint: "Bind monster parts and remnants into magic items",
    locked: true
  }
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
