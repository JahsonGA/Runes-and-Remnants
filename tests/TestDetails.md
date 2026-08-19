# Test Details

Vitest suite plus a standalone packaging check. **103 tests across 7 files**,
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
| [`harvest-table.test.js`](harvest-table.test.js) | 25 | `HARVEST_TABLE` coverage, tier shape, DC scale, item-name spot-checks |
| [`harvest-options.test.js`](harvest-options.test.js) | 22 | `getHarvestOptions` coverage, fallback, case handling, additive tiers |
| [`harvest-unlock.test.js`](harvest-unlock.test.js) | 18 | `getUnlockedMaterials`, essence gating, `harvestOutcome` |
| [`harvest-duplicates.test.js`](harvest-duplicates.test.js) | 11 | `findCompendiumEntry`, `DUPLICATE_RESOLVER` |
| [`harvest-pack.test.js`](harvest-pack.test.js) | 7 | Shipped compendium integrity + table↔pack contract |
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

Structure plus a **DC-scale guard**: every tier DC must be 20, 30, or 40.
Tier DCs are compared against a combined two-roll total, so an off-scale DC 15
would be met automatically and stop gating anything.

Also spot-checks specific item names per type — these are the canary for a
rename on either side of the join.

### `harvest-unlock.test.js`

Covers the current yield model: tier gating at, below, and above each DC;
additivity; de-duplication; `other` fallback; essence withheld below its DC and
granted exactly at it; essence selected by CR not type; and the fact that
low-CR essence can be unlocked when no material tier was met.

Also asserts essence DCs rise with CR and stay inside the reachable 20–50 band.

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
Verifies required files exist (`module.json`, `index.js`, both `src/harvest/`
files, the stylesheet, the template) and that `module.json` carries `id`,
`title`, `version`, `esmodules` and `url`. Exits non-zero on failure.

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

`menu.js` has no tests — it needs `Application`, `game`, `canvas` and
`ChatMessage`. Its testable math is extracted into `logic.js` precisely so the
untested surface stays thin. The selection-filter logic in `_startHarvest` is
currently the largest untested branch; extracting it would be the natural next
step.

## Related

- [Harvest logic](../src/harvest/HarvestDetails.md)
- [Data tables](../src/data/DataDetails.md)
- [Compendium pack](../packs/PacksDetails.md)
- [CI workflows](../.github/workflows/WorkflowsDetails.md)
