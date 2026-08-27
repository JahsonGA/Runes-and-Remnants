# Test Details

Vitest suite plus a standalone packaging check. **426 tests across 18 files**,
all runnable without a Foundry runtime.

A second suite runs in a real browser. **62 Playwright tests** render the
module's own templates and stylesheet and check that the result is usable —
the class of bug string assertions cannot see.

```bash
npm test              # vitest run — logic and data
npm run test:ui       # playwright — layout and usability
npm run check:assets  # standalone manifest/asset validation
npm run test:all      # all three
```

Vitest is configured to exclude `tests/ui/`. Its default include picks up
`*.spec.js` as well as `*.test.js`, so without that exclusion `npm test`
collects the Playwright files and fails on the missing runner.

## Files

| File | Tests | Covers |
|---|---|---|
| [`harvest.logic.test.js`](harvest.logic.test.js) | 3 | Legacy `computeHarvestDC` / `rollOutcome` |
| [`harvest-essence.test.js`](harvest-essence.test.js) | 17 | `ESSENCE_TABLE` structure, `getEssenceByCR` ranges and boundaries |
| [`harvest-table.test.js`](harvest-table.test.js) | 20 | `HARVEST_TABLE` coverage, component-DC scale, source fidelity |
| [`harvest-options.test.js`](harvest-options.test.js) | 21 | `getHarvestOptions` coverage, fallback, case handling, tier order |
| [`harvest-unlock.test.js`](harvest-unlock.test.js) | 28 | `getComponentDC`, `buildHarvestList` cumulative DCs, `resolveHarvest`, ordering trade-off, `harvestOutcome` |
| [`harvest-duplicates.test.js`](harvest-duplicates.test.js) | 11 | `findCompendiumEntry`, `DUPLICATE_RESOLVER` |
| [`harvest-pack.test.js`](harvest-pack.test.js) | 7 | Shipped compendium integrity + table↔pack contract |
| [`hub-tabs.test.js`](hub-tabs.test.js) | 18 | Hub tab config, status states, icon paths, panel/partial wiring |
| [`craft-manufacturing.test.js`](craft-manufacturing.test.js) | 28 | Recipe table integrity, tool/ability resolution, proficiency and disadvantage |
| [`craft-alchemy.test.js`](craft-alchemy.test.js) | 40 | Ingredient table, DC arithmetic against the source's worked examples, concoction rules |
| [`craft-catalogue.test.js`](craft-catalogue.test.js) | 26 | Category coverage, consumables, rarity-derived potions, third-party loading |
| [`craft-reagents.test.js`](craft-reagents.test.js) | 52 | Component tagging coverage, potency scale, gear and potion budgets, origin stamping |
| [`craft-outcome.test.js`](craft-outcome.test.js) | 22 | Roll grading, graded failure, reagent selection, stack consumption |
| [`enchant.test.js`](enchant.test.js) | 42 | Remnant tiers, rarity normalising, the plan, flaws on failure |
| [`craft-summary.test.js`](craft-summary.test.js) | 28 | Confirmation content: hours, cost, what is consumed, escaping |
| [`spirit.test.js`](spirit.test.js) | 38 | Spirit ladder integrity, prerequisite chains, awakening, the one-way remnant door |
| [`templates.test.js`](templates.test.js) | 13 | Handlebars templates compile and render against real panel data |
| [`check-assets.mjs`](check-assets.mjs) | — | Not Vitest. Standalone packaging guard |

---

## What each file protects

### `harvest-pack.test.js` — the highest-value file

The only test that reads the shipped `.db`. It guards the contract that item
**names** are the join key between `HARVEST_TABLE` and the compendium — a break
there fails silently at runtime (the item just never appears), so it must fail
loudly here.

Asserts: every entry has a unique 16-char `_id`; names are unique; no
`@UUID[Item.…]` world-item links survive; every `@UUID` resolves inside the
pack; every name in `HARVEST_TABLE` and `ESSENCE_TABLE` exists in the pack.

### `harvest-table.test.js`

Structure plus a **component-DC scale guard**: every cost must be 5, 10, 15, 20
or 25. Costs accumulate along the harvest list, so inflating them breaks the
cumulative maths — a 25-cost component is meant to be affordable first and
unreachable fourth. An earlier revision did exactly that, which is why the
guard exists.

Also spot-checks names per creature type against the source tables, and asserts
no component appears at two different costs within one type.

### `harvest-unlock.test.js`

The core mechanic. Reproduces the source's worked example — teeth, two eyes,
breath sac, essence giving Harvest DCs of 10/15/20/45/75, with a check of 37
taking the first three and leaving the rest.

Covers order preservation (never sorted), duplicates, unknown components
contributing zero rather than corrupting later DCs, exact-DC boundaries, the
contiguous leading run, and the greedy-vs-cautious ordering trade-off that
makes ordering a real decision.

### `hub-tabs.test.js`

Guards the hub's configuration: tab ids and uniqueness, `resolveTab` fallback
behaviour, and each tab's **status**. Status is three-state — `live`, `partial`,
`planned` — because a system can be genuinely in between; crafting sat at
`partial` while its catalogue was usable but its execution was not. `locked`
is derived from `status`, and a test asserts the derivation so the two can
never drift apart.

Pins each tab's **icon path** — a typo there fails silently as a missing image —
and asserts icons are Foundry core assets rather than bundled or remote.

Also checks the wiring end to end: every tab has a panel template on disk,
`hub.html` branches for it, every partial it uses is registered in `index.js`,
and every non-`live` panel carries an `rnr-status` note. That last one checks
for the marker class rather than a phrase, since "planned" and "reference only"
are different promises and shouldn't be forced into identical wording.

### `craft-manufacturing.test.js`

Recipe-table integrity — unique names, known categories, known tools, positive
hours and DCs — plus tool→ability resolution and the **disadvantage rule**: an
unproficient crafter still rolls, so `planManufacture` must report
`disadvantage: true` rather than refusing the attempt.

Also guards the material yardstick's one-third fallback, and that the gp figure
is never presented as a price (the house rule replaces it with monster parts).

### `craft-alchemy.test.js`

Ingredient-table integrity plus the DC arithmetic, checked against the source's
own worked examples: Potion of Delayed Potent Healing = DC 14, Death's Bite =
DC 18. **Widow Venom is printed as DC 17 but computes to 16** — a source
erratum; the test asserts 16 and its name says why.

Then the concoction rules: one effect base (Bloodgrass excepted), at most three
modifiers, modifier type matching its base, `locked` ingredients refusing
modification, and the separate enchantment path (Elemental Water base, exactly
one enchantment, no modifiers). `analyseConcoction` returns *every* violation,
not just the first, and the tests assert that.

### `craft-reagents.test.js`

Guards the join between Harvest and Craft. The highest-value assertion is
**tag coverage in both directions**: every component the harvest table can
drop must be tagged, and nothing may be tagged that never drops. An untagged
component is dead weight — it can never satisfy a recipe, and a player has no
way to discover that except by failing. This caught `Tentacle` on its first
run.

Also asserts that **no property is carried by fewer than five components**,
which is the whole reason recipes key off properties instead of item names,
and that every rarity budget is reachable with parts that actually exist — a
requirement nobody can meet is a bug, not difficulty.

Then the potency curve (steepening, matching the cumulative harvest DCs),
theme discounts that never substitute for potency, and origin stamping —
including the conservative fallback, where an unstamped part is valued at the
*lowest* DC it could be so scraps cannot be laundered into legendary reagents.

### `craft-outcome.test.js`

The rules for what a roll means and what it costs.

Pins the **graded failure** design so nobody quietly "simplifies" it back to
all-or-nothing: a near miss keeps the materials, a bad miss spoils them, a
natural 20 succeeds however low the total and a natural 1 ruins it however
high. The band boundaries are checked explicitly, since that is where a
refactor silently shifts things.

Then `selectReagents` — that it spends the *minimum* rather than everything
matching, burns scraps before trophies, and still reaches for a themed part
despite cheapest-first ordering.

The sharpest test here covers **stack accounting**. A stack of four bones is
worth four bones of potency and must cost four bones; an earlier cut credited
the whole stack and deducted a single item, which would have let the same
bones be spent indefinitely. Caught by reading a screenshot, not by a test —
so there is one now.

### `enchant.test.js`

The rules of binding a remnant into an item.

Two assertions matter more than the rest. **Every remnant tier must be an
essence the harvest table actually drops** — a tier nobody can obtain is a
dead branch in the loop, and this is the test that keeps Enchanting wired to
Harvest rather than merely adjacent to it. And **every enchantment must have a
component that satisfies it**, plus something low-rarity for each item kind:
a party that has only ever killed a wolf should still have an option.

`normaliseRarity` gets its own block because three spellings of "very rare"
are in play at once — `veryRare` from the essence table, `very rare` from
manufacturing, `veryRare` from dnd5e. Comparing them raw would read a very
rare remnant as unknown and quietly downgrade an item the party worked for.

The DCs, hours and flaw bands are pinned against the numbers the panel has
printed since before any of it was automated, so the implementation cannot
drift away from what a table has been reading at the bench.

Also covers: a stronger remnant raising rarity, DC and hours together; a
weaker one blocking outright; every blocker reported at once rather than one
per reload; and that a natural 1 gives three flaws rather than destroying the
item — losing a Deific remnant to one die roll is not a risk anyone would take.

### `spirit.test.js`

Ancestral weapon progression, and the balance properties that make it a
choice rather than a checklist.

Two integrity assertions carry the most weight. **Every prerequisite chain is
walked** and asserted to cost no more than a weapon can hold — a branch that
is permanently unreachable is a bug that looks like content. And **the whole
ladder must cost more than the 25-point budget**, or there is no choice to
make at all.

**No single remnant may be worth 20 points.** The moment one could awaken a
weapon on its own, spirit points stop being a currency earned through deeds
and become another farmable material, which is the one thing they exist not
to be.

The one-way door gets its own block: spending a remnant must set
`remnantSpent` in the *same patch* that adds the points. A caller that had to
remember it separately would eventually forget, and the player would find out
much later with no way back.

Also covers awakening keying off points **earned** rather than remaining, and
`registerSpiritAbilities` — the seam a table with the supplement uses to
replace this module's invented costs with the book's.

### `craft-summary.test.js`

The content of the "are you sure" dialog. These matter more than they look:
a player agrees to a cost based on what this says, so the numbers here have
to be the numbers that actually get applied.

Pins that **what is listed as consumed is the real selection**, not everything
that merely matched — `selectReagents` spends the minimum, and a dialog
listing more would be a lie in the direction of scaring people off.

Pins the **wording of the loss rule**, because "you may lose these" and "a
miss by 5 or more spoils these, a near miss costs only the time" lead to
different decisions about whether to attempt something.

`formatHours` gets its own block. The potion table runs to 1,000 hours and the
artifact tier to 100,000; printed raw, that reads as a typo rather than as a
statement of intent, so it becomes days, workweeks or years while always
keeping the raw count alongside.

Also checks HTML escaping — item names come out of compendiums this module
did not write, and they land in a dialog as markup.

### `craft-catalogue.test.js`

Coverage of the four things a hunter makes — weapons, armour, consumables,
potions — plus the rarity-derived potion table (nothing hand-typed, so nothing
can drift) and the third-party registry: world recipes override shipped ones
rather than duplicating them, re-registering never doubles up, and an invented
category is shown after the known ones rather than dropped.

### `ui/` — Playwright

Renders the real templates with the real stylesheet inside a shell that
mimics a Foundry application window, via `page.setContent`. No server, no
copied fixtures: if the panel renders differently in the module, it renders
differently here.

This exists because of a bug no string assertion could catch. The workbench
showed "Adventuring gear (generic)" with all nineteen artisan tools joined
into one `nowrap` cell — 386 characters — which sized the table to its
content and pushed Check, Ability, Time and Materials thousands of pixels
off-screen. Every existing test passed. It read as four empty rows.

| File | Tests | Covers |
|---|---|---|
| [`ui/harness.js`](ui/harness.js) | — | Builds a full page for one hub state |
| [`ui/layout.spec.js`](ui/layout.spec.js) | 15 | Overflow, clipping, unreachable content, scrollbars, scroll restore, narrow windows |
| [`ui/usable.spec.js`](ui/usable.spec.js) | 36 | Controls present, hittable, keyboard-reachable, legible; catalogue scroll, filter, enchanting flow, crafter picker, bench spacing |

**The layout sweep renders every recipe in two states** — with a crafter and
without. That matters: with one, `planManufacture` resolves the single tool
they can use and the long string never appears. An earlier version checked
only that state and sailed past the very bug it was written for.

**The harness copies Foundry's window chrome rather than improving on it.**
`.window-app` is a flex column and `.window-content` is `flex: 1` with its
own `overflow-y` — that is all `module.css` gets to build on. An earlier
harness set `display: flex` on `.window-content` too, which meant the module
stylesheet was never proven sufficient by itself: the catalogue scrolled in
the test while staying stuck in Foundry.

Two checks came out of a panel that was cut off with **no way to reach the
rest**:

- *unreachable content* — anything with `overflow: hidden` that is taller than
  its box, on every tab. That is what a card with no inner scroller produces,
  and it is worse than an overflow that merely sticks out.
- *scrollbars are visible* — Chromium defaults to **overlay** scrollbars,
  which reserve no width and fade when idle, and the default thumb is a grey
  that disappears against these panels. Both make a scrollable region look
  clipped. Gutter width is host-dependent, so the test asserts the module has
  said something explicit (`scrollbar-color` is not `auto`, and a gutter is
  reserved) rather than pinning a pixel count.
- *scroll survives a render* — Foundry rebuilds the DOM on render and restores
  scroll only for the selectors named in `scrollY`. A region that scrolls but
  is not listed snaps to the top on every click, which is what adding a fourth
  component to a harvest list used to do. Checked in both directions: nothing
  scrolls that is undeclared, and nothing is declared that matches no panel.

The suite was verified by reverting the fix and confirming it fails, which is
the only way to know a layout test is worth having. It reported *"3 of 200
states overflow"*.

`usable.spec.js` also carries a **contrast check** at WCAG AA (4.5:1). It
found worse than the wrapping did: `--rnr-brown` on the panel ground is
2.5:1, and it was carrying the row labels, tier headers and active tab. The
palette now separates border tones from text tones.

### `harvest-duplicates.test.js`

`DUPLICATE_RESOLVER` now ships **empty** — the pack's former duplicate names
were renamed instead. The tests assert it is empty, then verify the resolution
*mechanism* still works against a caller-supplied map, so the extension point
stays functional for worlds adding their own variants.

Uses `MOCK_LOOT` stubs rather than the real pack, so it tests the algorithm
independently of shipped data.

### `harvest.logic.test.js`

Covers `computeHarvestDC` and `rollOutcome`, which are **no longer in the
harvest path** but remain exported for macros. Kept so their behaviour doesn't
drift while callers may still depend on it.

### `check-assets.mjs`

Not a Vitest file — a standalone Node script run by CI as `npm run check:assets`.
Verifies required files exist (`module.json`, `index.js`, the harvest, hub,
craft and data modules, the stylesheet, and every panel template) and that
`module.json` carries `id`, `title`, `version`, `esmodules` and `url`. Exits
non-zero on failure.

Its `REQUIRED` list is hardcoded — add new must-ship files there when the module
grows.

---

## Conventions

- Plain Vitest for logic; Playwright only where a browser is genuinely needed.
- No Foundry mocks or DOM environment in the Vitest suite. This works because
  `logic.js` and `harvest-table.js` avoid Foundry globals at module scope.
- Assertions carry **custom failure messages** naming the offending type or
  item, so a failure identifies the bad data without a debugger.
- `describe` blocks are separated by `─── … ───` comment rules.

## What is not covered

`menu.js` and `hub.js` have no direct tests — both need `Application`, `game`,
`canvas` and `ChatMessage` at import time. Testable logic is pulled out into
`logic.js` and `src/data/` precisely so the untested surface stays thin: the
hub's tab data lives in `src/data/hub-tabs.js` for exactly this reason.

The Foundry glue — socket delivery, item granting, actor reads — still needs a
live world. Rendering is no longer in that list: `templates.test.js` renders
the templates in Node, and `tests/ui/` renders them in a browser.

## Related

- [Harvest logic](../src/harvest/HarvestDetails.md)
- [Data tables](../src/data/DataDetails.md)
- [Compendium pack](../packs/PacksDetails.md)
- [CI workflows](../.github/workflows/WorkflowsDetails.md)
