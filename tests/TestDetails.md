# Test Details

Vitest suite plus a standalone packaging check. **204 tests across 11 files**,
all runnable without a Foundry runtime.

```bash
npm test              # vitest run
npm run check:assets  # standalone manifest/asset validation
```

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
`planned` — because crafting is genuinely in between: catalogue and DCs are
usable, execution is not. `locked` is derived from `status`, and a test asserts
the derivation so the two can never drift apart.

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

- Plain Vitest, no Foundry mocks or DOM environment. This works because
  `logic.js` and `harvest-table.js` avoid Foundry globals at module scope.
- Assertions carry **custom failure messages** naming the offending type or
  item, so a failure identifies the bad data without a debugger.
- `describe` blocks are separated by `─── … ───` comment rules.

## What is not covered

`menu.js` and `hub.js` have no direct tests — both need `Application`, `game`,
`canvas` and `ChatMessage` at import time. Testable logic is pulled out into
`logic.js` and `src/data/` precisely so the untested surface stays thin: the
hub's tab data lives in `src/data/hub-tabs.js` for exactly this reason.

What remains untested is the Foundry glue — rendering, socket delivery, and
item granting. Those need a live world.

## Related

- [Harvest logic](../src/harvest/HarvestDetails.md)
- [Data tables](../src/data/DataDetails.md)
- [Compendium pack](../packs/PacksDetails.md)
- [CI workflows](../.github/workflows/WorkflowsDetails.md)
