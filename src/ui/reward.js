// =========================================================
// Runes & Remnants — the reward panel
//
// What a kill, a craft or a binding actually yielded, shown as a moment
// rather than a line of chat.
//
// Harvest hands back up to five components and an essence at once, and said
// so only in a chat card — which scrolls away, buries the rarity, and gives
// the best roll of the session the same weight as a miss. This is the payoff
// made visible.
//
// Pure — no Foundry globals at module scope, so the shaping is testable
// without a world. The Application that renders it is in reward-panel.js;
// `extends Application` here would make this file unimportable outside
// Foundry and take the tests with it.
// =========================================================

export const MODULE_ID = "runes-and-remnants";

/** The 5e ladder, lowercased to a CSS-safe key. */
const RARITY_KEY = {
  common: "common",
  uncommon: "uncommon",
  rare: "rare",
  veryrare: "veryrare",
  "very rare": "veryrare",
  legendary: "legendary",
  artifact: "artifact"
};

/** Fallback art, so a missing icon is still a tile rather than a gap. */
const DEFAULT_IMG = "icons/svg/item-bag.svg";

/**
 * Normalise one granted thing into what the panel draws.
 *
 * Takes either a Foundry item document, plain item data, or a bare
 * `{ name, img, rarity }` — harvest, crafting and enchanting each hand over
 * a slightly different shape and none of them should have to care.
 */
export function rewardItem(entry) {
  if (!entry) return null;

  const name = entry.name ?? entry.label ?? "Something";
  const system = entry.system ?? {};
  const rarityRaw = String(entry.rarity ?? system.rarity ?? "").toLowerCase().trim();

  // A quantity of one is not worth drawing; the tile already means "one".
  const qty = Number(entry.quantity ?? system.quantity ?? 1) || 1;

  return {
    name,
    img: entry.img ?? entry.icon ?? DEFAULT_IMG,
    quantity: qty > 1 ? qty : null,
    rarityKey: RARITY_KEY[rarityRaw] ?? "common",
    detail: entry.detail ?? null,
    // A binding that came out flawed is still a binding — enchanting shows
    // it in the panel rather than reserving the panel for a clean roll, and
    // this is what lets the tile say so at a glance: it overrides the
    // rarity border and the tinted name to the same danger red the rest of
    // the module already uses, rather than leaving rarity colour, which
    // speaks to something else entirely, to carry a warning it was never
    // meant to carry.
    flawed: Boolean(entry.flawed),
    // Everything worth knowing, for the hover — the visible name stays short
    // so the grid keeps its shape.
    tooltip: [name, entry.detail, entry.flawed ? "flawed" : null, rarityRaw || null]
      .filter(Boolean).join(" · ")
  };
}

/**
 * The whole panel's context.
 *
 * @param {object} args
 * @param {string} args.title     "Reward", "Harvested", "Bound"
 * @param {string} [args.subtitle] where it came from
 * @param {string} [args.flavour] a line of prose
 * @param {object[]} [args.items] what was granted
 * @param {string[]} [args.notes] anything the player should know
 */
export function rewardData({
  title = "Reward", subtitle = "", flavour = "",
  items = [], notes = [], crest = "◈", acceptLabel = "Accept"
} = {}) {
  const shaped = (items ?? []).map(rewardItem).filter(Boolean);

  return {
    title,
    subtitle,
    flavour,
    crest,
    acceptLabel,
    items: shaped,
    notes: (notes ?? []).filter(Boolean),
    // Said plainly rather than showing an empty frame, because a failed
    // harvest is a result too.
    emptyLabel: "Nothing came away intact."
  };
}
