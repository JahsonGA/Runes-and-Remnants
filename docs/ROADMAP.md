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

### 1.2a — Correction: the DC model is cumulative *(supersedes § 1.2)*

§ 1.2 below diagnosed the symptom correctly and prescribed the wrong cure.
The source rules — Ryoko's Guide *Harvesting and Crafting Lite* — work like
this:

1. Harvesters choose the components they want **and the order to take them in**
   (the *harvest list*).
2. Each component has its own **component DC** (5/10/15/20/25).
3. The **Harvest DC** for each entry is the running total of every component
   before it.
4. One Harvesting check (assessment + carving + helpers) is compared against
   those running totals; you extract the leading run.

So the original 5/10/15/20 values were right all along. The bug was that the
tiers were never accumulated, which is why everything always unlocked.
Rescaling to 20/30/40 papered over that; it has been reverted.

Ordering is now the actual decision. Measured over 100k harvests, a level 5
party against a CR 10 dragon:

| Harvest list order | Avg recovered | Breath Sac |
|---|---|---|
| Prize first (Breath Sac → Essence → …) | 0.99 of 5 | 96% |
| Cheap first (Eye → Bone → Teeth → …) | 3.23 of 5 | 0% |

Take what you came for and go home light, or fill your bags and leave the
trophy behind. That replaces the saturation problem noted in § 1.5b — the
system no longer flattens out at high level, because a bigger check just means
a longer affordable list.

Implemented as `getComponentDC` → `buildHarvestList` → `resolveHarvest` in
`logic.js`, with an ordered, reorderable list in the menu.

### 1.2 — Unify the DC model *(superseded by § 1.2a — kept for the diagnosis)*
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

### 1.8 — Components missing from the compendium

The source tables name six components the pack does not yet contain. Each is
currently covered by a stand-in or omitted; add them in Foundry and update
`src/data/harvest-table.js` to match the source exactly.

| Component | Creature type | Source cost | Current handling |
|---|---|---|---|
| Primordial Dust | Elemental | 5 | `Stone` stands in |
| Volatile Mote (air/earth/fire/water) | Elemental | 15 | `Ethereal Ichor` stands in |
| Core (air/earth/fire/water) | Elemental | 25 | `Lifespark` stands in |
| Nail | Giant | 5 | omitted |
| Tooth | Giant | 10 | `Pouch of Teeth` stands in |
| Bundle of Roots | Plant | 10 | omitted |

Elemental is the weakest table until its three are added — it is the only type
whose identity components are all substitutes.

`tests/harvest-pack.test.js` enforces that every name in the table exists in
the pack, so adding these is safe: reference them and the suite tells you
immediately if the names don't match.

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

Two systems under one tab: **Manufacturing** (mundane weapons, armour,
ammunition, gear) and **Alchemy** (potions, poisons, enchantment brews).

### 4.1 — Data and logic  ✅ *done*

- `src/data/manufacturing.js` — ~60 recipes with tool, ability, hours, DC and a
  material yardstick, plus a `TOOL_ABILITY` map covering 19 artisan tools.
- `src/data/alchemy.js` — ~40 ingredients with role, DC modifier, terrain and
  effect.
- `src/craft/logic.js` — pure logic. `planManufacture` resolves tool, ability
  and the unproficient-disadvantage case; `computeAlchemyDC` is
  `10 + Σ ingredient modifiers`; `analyseConcoction` validates a mix and
  returns every violation rather than the first.
- `src/craft/panel.js` + `templates/panels/crafting.html` — a two-mode
  catalogue (Gear / Alchemy) with a workbench, delegated from the hub.
- 68 tests, reproducing the source's worked examples.

### 4.1b — Reagents: the Harvest ➜ Craft join  ✅ *done*

Potions and consumables now require monster parts. Three layers:

- **Property** — a recipe asks for a kind of part (`vital`, `virulent`,
  `elemental`, `arcane`, `perceptive`, `structural`, `viscous`, `fibrous`),
  never a specific item, so many monsters qualify and no party is locked out.
  Gear accepts *any of* several: a blade is talon or bone or chitin.
- **Potency** — read off the part's harvest DC (5→2 … 25→12, essences 12–25).
  The curve steepens because harvest DCs are cumulative.
- **Budget** — a potency total, so lesser parts substitute for greater ones.
  Potions scale by rarity; gear scales by the material yardstick.

**Everything in the catalogue demands parts, gear included** — chitin plate,
hide coats, a blade from a talon, a wand from an eye stalk. The first cut of
this exempted weapons and armour, which was backwards for a monster-hunter
framework and is now guarded by a test.

Creature theme is a **bonus, never a gate**: an apt creature takes 2 off the
DC; the wrong one still works.

Harvest stamps origin (`creatureType`, `cr`, `dc`, `essence`) onto every
granted part, since potency cannot be recovered afterwards. Unstamped parts
fall back to the lowest DC that component is ever worth.

### 4.2 — Execution  ✅ *done*

Crafting rolls, spends and grants. The tab is `live`.

- **The roll** — `1d20 + ability + proficiency` against the computed DC, at
  disadvantage (`2d20kl1`) without the tool. The kept d20 drives crits, so a
  natural 20 on a disadvantaged roll still reads right.
- **Graded failure**, in `src/craft/outcome.js`. Losing everything on a miss
  is the obvious rule and the wrong one: a legendary potion wants a CR 21
  essence and a thousand hours, and wiping that on one d20 makes crafting
  something nobody attempts. A **near miss (within 5) costs the hours but
  spares the materials**; a bad miss spoils them; a natural 1 ruins the lot.
  The materials are the harvest the party earned, and taking them back too
  readily punishes the wrong half of the loop.
- **Spending** — `selectReagents` picks the *minimum* that meets the budget,
  cheapest first, so a hunter burns scraps and keeps trophies. One themed
  part is taken first when present, since it buys 2 off the DC and would
  otherwise never be reached. Stacks are spent **unit by unit**: four bones
  are worth four bones and cost four bones.
- **GM-authoritative** over the socket, same shape as harvest — otherwise
  every connected client crafts the same item.
- The panel names what will be spent *before* the click.

Still open: alchemy consumes no plant stock (it is not tracked as items yet;
the chat card says so rather than leaving it to be discovered), and elapsed
crafting hours are not carried across sessions.

### 4.3 — Third-party content

`getExtraRecipes()` is referenced but unimplemented. It will read recipes from a
world compendium the table populates themselves.

**This is a licensing boundary, not a convenience.** Game mechanics — DCs,
times, formulas — are not copyrightable, and SRD 5.1 item names are CC-BY, so
those ship. Grim Hollow, Ryoko's and Heliana's stat blocks and descriptions are
commercial copyrighted content and **must not ship inside a publicly listed
module**. A table that owns those books loads them locally; the published
package stays clean.

---

## Phase 5 — Enchantment System  ✅ *done*

Bind a remnant into a mundane item. Item + component + remnant + a caster's
check.

- **The component decides what it becomes**, keyed to the eight properties
  from § 4.1b rather than to named parts — a venomous blade takes any venom
  gland. 24 enchantments across weapon, armour and wondrous.
- **The remnant decides how strong.** Every enchantment names a floor rarity;
  a stronger remnant raises the item past it, with the steeper DC and longer
  hours that follow. The tiers *are* the essences harvest already drops, so
  a party's loot feeds straight in.
- **The check is the caster's ability and the corpse's skill** — a wizard
  working a dragon's remnant rolls Intelligence (Survival). Spellcasters only.
- **Failure still binds, badly.** Flaws in proportion to the miss; destroyed
  at −13. A natural 1 gives three flaws rather than dust, because losing a
  Deific remnant to one die roll is not a risk anyone would take.
- Materials are consumed whatever the roll. The panel says so beforehand.
- The item is **rewritten, not replaced**, so sheet slots and effects
  pointing at it survive.

Still open: socketed runes and corruption mechanics, which were sketched in
the original Phase 5 scope and are better placed alongside Phase 6.

## Phase 6 — Ancestral Weapons  ✅ *core done*

The Evolve side of the Enchanting tab. One weapon per character, grown rather
than replaced, abilities bought with spirit points earned through deeds.

- Awakens at 20 points earned, finished at 25. Awakening keys off points
  earned rather than remaining — a weapon carried through twenty points of
  deeds has woken whether or not its wielder spent them.
- Abilities sit in tiers (1/3/5/8) and can require another first, so a weapon
  grows along a path. A test walks every prerequisite chain and asserts none
  exceeds what a weapon can hold.
- A remnant may stand in for a deed, and doing so forecloses enchanting on
  that weapon forever — set in the same patch that adds the points, and
  confirmed in the strongest wording in the module. No single remnant can
  awaken a weapon alone, so deeds do most of the work.
- Points are never awarded automatically. A spirit point you can farm is just
  another material.

**The costs shipped are this module's own scale, not the supplement's.**
Ancestral Weapons is commercial; its ability list and costs stay out of a
public package, and a table that owns it replaces them in one edit or through
`registerSpiritAbilities()`.

Still open: rune infusion and corruption, carried over from the original
Phase 5 sketch.

---

## Architectural Notes

- **Compendium-driven data, not hardcoded tables.** `HARVEST_TABLE` maps
  creature type → tier → *item names*; the compendium holds the actual items.
  Names are the join key, which is why duplicate and typo'd names are
  correctness bugs, not cosmetic ones.
- **Pure logic stays in `logic.js`**, testable without a Foundry runtime — that
  is what lets `tests/` run under plain Vitest. Keep Foundry API calls in
  `menu.js`.

### Resolved ahead of schedule

- **Multi-client double-grant** *(was deferred to Phase 3; fixed before public
  listing)*. The socket broadcast renders the menu on every connected client,
  and any of them could click *Start Harvest*, granting the loot again. Now
  GM-authoritative: clients send a `requestHarvest` payload, and only the
  designated GM — resolved deterministically by `pickExecutorId` as the active
  GM with the lowest user id — executes it. Execution moved to a static,
  payload-driven `HarvestMenu.executeHarvest`, since the GM's client may never
  have had the menu open. Also guarded by a per-token in-flight lock, a submit
  latch against double-clicks, and an ownership check so a player cannot ask
  the GM to grant loot to an actor they do not own.

  Pulled forward because a public listing turns "nobody is using it yet" from
  true into false, and an item duplicator is a defeated premise in a
  scarcity-themed module.

### Known deferred issues

- **Role selections are not synced between clients.** The menu is broadcast on
  open, but assessor/harvester/helper assignments are local state, so each
  client fills in its own. In practice one person completes the form and
  submits. Proper shared state belongs with the Phase 3 hub rework.
