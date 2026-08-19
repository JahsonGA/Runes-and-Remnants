# Runes & Remnants — Development Roadmap

Grim-dark monster-hunter progression for Foundry VTT (D&D 5e).
Gameplay loop: **Kill → Harvest → Craft → Enchant → Evolve**.

Build order follows the project philosophy: *functional systems → data architecture → packaging → UX → art*.

---

## Phase 1 — Stabilize Harvest  ⬅ **current**

The Harvest Menu works end-to-end but carries two incompatible DC models, a
crash on completion, and an unfiltered loot panel. This phase makes the
existing feature correct before anything new is built on top of it.

### 1.1 — Fix harvest-completion crash
`src/harvest/menu.js` ends with `this.targetToken.document.delete()`.
`this.targetToken` is **already** a `TokenDocument` (index.js passes
`hud.object?.document`, and the socket path passes the result of `fromUuid`),
so `.document` is `undefined` and the call throws. Every harvest currently
dies at the last step — after items are granted but before the token clears.

Fix: call `.delete()` on the TokenDocument directly, guarded, and only after
a successful harvest.

### 1.2 — Unify the DC model
This is the `TODO` at the top of `menu.js`. Two systems are fighting:

| Model | Where | Problem |
|---|---|---|
| Scaled DC — `baseDC + CR/2 + typeMod + rarityMod` | `computeHarvestDC()` drives the pass/fail outcome | Design intent is a **flat** DC, not CR-scaled |
| Flat tier DCs — 10 / 15 / 20 | `HARVEST_TABLE` gates which materials unlock | Calibrated for a *single* d20, but compared against a **combined two-roll total** |

The combined total is `assessment (1d20+INT+prof) + carving (1d20+DEX+prof) + helperBonus`
— averaging **≈31**. Against tier DCs of 10/15/20, *every tier always unlocks*.
Meanwhile `getEssenceByCR()` returns a `dc` field that **nothing ever reads**;
essence is unconditionally granted.

The combined-total design is intentional and documented in the README
("their combined total will determine how many of the listed items are earned").
So the fix is to keep the combined total and make the flat DCs match its scale:

- **Rescale `HARVEST_TABLE` tiers to 20 / 30 / 40.** Meaningful spread against
  a ~12–50 range.
- **Remove `computeHarvestDC()` from the harvest path.** No CR/type/rarity DC
  scaling. It stays exported for macro/API use, but the tier table is the only
  authority during a harvest.
- **Gate essence by its own `ESSENCE_TABLE` DC** (25/30/35/40/50) instead of
  granting it unconditionally. Those values already sit in the combined-total
  band, and this is where CR difficulty scaling now lives — a deific essence
  should be genuinely hard to pull.
- **Derive the outcome label from tiers unlocked** rather than a separate DC
  check: 0 tiers → failure, 1 → partial, 2 → success, 3 → exceptional.

Net effect: one DC model, flat numbers, CR pressure expressed through essence.

### 1.3 — Filter the materials panel by creature type
`_ensureLootIndex()` loads the entire 71-item compendium and the template lists
all of it, so harvesting a wolf offers Gears, Soul, and Breath Sac.

Fix: build the panel from `getHarvestOptions(type)` — only that creature type's
materials, grouped by tier, each group labelled with its DC so players can see
what they're reaching for. Keep the full compendium index in memory purely for
resolving names to documents.

### 1.4 — Compendium data integrity
Verified problems in `packs/harvest-items.db` (71 entries):

- **No entry has an `_id`.** A Foundry NeDB pack needs stable IDs; without them
  IDs are regenerated per install, which makes the pack non-deterministic and
  breaks any stored reference into it. The template also keys loot checkboxes on
  `_id`.
- **26 `@UUID[Item.<id>]` links in item descriptions point at *world* items**,
  not compendium entries — broken links for every end user.
- **`"Phail of Mucus"`** — typo duplicate of `"Phial of Mucus"`, placeholder
  description, referenced by nothing.
- **`Bone` ×2 and `Hair` ×2** share names but are distinct items
  ("Bone of another…" vs "Broken shards of a skeleton"; "Hair of an unlucky
  solider" vs "Matted and filthy"). `findCompendiumEntry()` silently takes the
  first match. Only `Membrane` has a `DUPLICATE_RESOLVER` entry.
- **`system.rarity` is empty** on most items; no module flags for category or
  creature source.

Fix in this phase: assign stable `_id`s, repoint intra-pack UUID links, drop the
typo orphan, and disambiguate `Bone`/`Hair` by renaming the variants (cleaner
than growing the resolver). Rarity and category flags follow in Phase 2.

### 1.5 — Remove dead code
`loadHarvestData()` in `logic.js` is a deprecated no-op that fetches JSON files
which no longer exist. Delete it.

### 1.5b — Measured difficulty curve (post-rescale)

Monte Carlo over 200k harvests, chance of unlocking each tier:

| Party | DC 20 | DC 30 | DC 40 | Essence |
|---|---|---|---|---|
| Lv1, 1 helper | 88.6% | 52.3% | 13.7% | 88.6% (DC 20) |
| Lv5, 2 helpers | 100% | 86.1% | 47.4% | 96.1% (DC 25) |
| Lv11, 3 helpers | 100% | 99.8% | 83.4% | 99.8% (DC 30) |
| Lv17, 4 helpers | 100% | 100% | 100% | 100% (DC 40) |

Good spread through level ~11, then it **saturates** — a high-level party
unlocks everything every time. That is the accepted cost of flat tier DCs, and
the essence DCs don't climb fast enough to compensate. Worth addressing in
Phase 2 by making a high roll grant *more* (quantity/quality) rather than just
unlocking more — the tier table alone can't express degrees of success.

### 1.6 — Tests
Update `tests/harvest-options.test.js` and `tests/harvest-table.test.js` for the
rescaled DCs, and add coverage for essence DC gating and outcome derivation.

### 1.7 — Foundry version compatibility

The manifest declares `verified: "12"` while Foundry ships **v14**, so the
module is two majors stale. Three concrete breakages were found and fixed:

| Break | Effect on v13+ | Fix |
|---|---|---|
| `Roll#evaluate({async: true})` ×4 | `async` option was **removed in v12**; logs a deprecation warning | Call `.evaluate()` |
| `renderTokenHUD` used jQuery (`html.find`) | v13 migrated TokenHUD to ApplicationV2, which passes a native `HTMLElement`. `html.find` is not a function → **the cleaver button never renders, so the module has no entry point at all** | Normalise `html` to an element, build the button with the DOM API |
| CSS assumed `.window-content` is the themed surface | v13 added CSS Layers and reworked app chrome | Paint the application root as well |

**Good news:** `Application` (ApplicationV1) is supported **through v15** and is
not removed until **v16**, so `HarvestMenu extends Application` needs no
rewrite. A single build can span v11–v14.

**Still open — requires a real Foundry instance, cannot be verified from the repo:**

1. Install a **separate** v13 or v14 instance with a throwaway world (do *not*
   upgrade the campaign world to test this).
2. Confirm the cleaver button appears, a harvest completes, and the grim-dark
   theming still applies.
3. Only then bump `compatibility.verified` in `module.json`. Claiming a
   verified version that was never launched is worse than claiming none.

---

## Phase 2 — Item Metadata & Categorization

Give every harvest item structured module flags so later systems can query them
instead of string-matching names:

- `category` — material / organ / essence / reagent / component
- `rarity` — populate the empty `system.rarity` fields
- `creatureSource` — which types it can come from
- `craftingTags` — for recipe matching in Phase 3

This is the data layer crafting depends on, so it lands before crafting logic.

---

## Phase 3 — Main Hub UI

A single entry point replacing the token-HUD-only flow: **Harvest | Crafting |
Enchanting** tabs sharing one application shell and the grim-dark stylesheet.
Harvest moves into it as the first tab.

---

## Phase 4 — Crafting System

Recipes stored compendium-side (matching the harvest data pattern), inventory
validation against held materials, crafting checks with tool/station
requirements, and rarity-scaled difficulty.

---

## Phase 5 — Rune / Enchantment System

Socketing, enchantment application, item evolution, corruption mechanics.

## Phase 6 — Ancestral Weapons

Persistent evolving weapons: unlock trees, rune infusion, material upgrades,
milestone evolution.

---

## Architectural Notes

- **Compendium-driven data, not hardcoded tables.** `HARVEST_TABLE` maps
  creature type → tier → *item names*; the compendium holds the actual items.
  Names are the join key, which is why duplicate and typo'd names are
  correctness bugs, not cosmetic ones.
- **Pure logic stays in `logic.js`**, testable without a Foundry runtime — that
  is what lets `tests/` run under plain Vitest. Keep Foundry API calls in
  `menu.js`.

### Known deferred issues

- **Multi-client double-grant.** The socket broadcast renders the menu on every
  connected client, and any of them can click *Start Harvest* — granting items
  more than once. Needs a GM-authoritative execution path (clients request, GM
  executes). Deferred to the Phase 3 hub rework, where the socket layer is
  already being touched.
