# Data Details

Static game-data tables. Pure data modules with no logic and no Foundry
dependency — safe to import from tests.

## Files

| File | Purpose |
|---|---|
| [`harvest-table.js`](harvest-table.js) | Creature type → harvestable components and their costs |
| [`hub-tabs.js`](hub-tabs.js) | Hub tab definitions, icons, and `resolveTab` |

---

## `harvest-table.js`

Exports `HARVEST_TABLE`, a `Record<string, HarvestTier[]>` where:

```js
/** @typedef {{ dc: number, items: string[] }} HarvestTier */
```

### Coverage

All 14 D&D 5e creature types plus an `other` fallback:

`aberration` · `beast` · `celestial` · `construct` · `dragon` · `elemental` ·
`fey` · `fiend` · `giant` · `humanoid` · `monstrosity` · `ooze` · `plant` ·
`undead` · `other`

Each type has exactly three tiers at **DC 20 / 30 / 40**, themed to its anatomy —
dragons yield scales then breath sacs then horns; constructs yield gears then
plating then lifesparks.

### Contract

Three invariants, all enforced by tests:

1. **`items` are exact compendium item names.** They are the join key against
   [`packs/harvest-items.db`](../../packs/PacksDetails.md); a typo means the item
   silently fails to be granted. Guarded by `tests/harvest-pack.test.js`.
2. **DCs must be 20, 30, or 40.** They are compared against a *combined*
   two-roll total (~12–58). A DC 15 tier would be met automatically and stop
   gating. Guarded by `tests/harvest-table.test.js`.
3. **DCs ascend within each type**, so additive unlocking behaves.

Note the deliberately lowercase `"Phial of acid"` — it matches the compendium
entry exactly, and a test documents that this is intentional rather than a typo.

### What is *not* here

**Essence.** It lives in `ESSENCE_TABLE` in
[`../harvest/logic.js`](../harvest/HarvestDetails.md) because it is selected by
CR rather than creature type, and it is the only CR-scaled part of the difficulty
model.

### Adding a creature type

1. Add the key with three tiers at DC 20/30/40.
2. Use item names that exist in the pack — or add them to the pack first.
3. Run `npm test`. `harvest-pack.test.js` fails loudly on any name that doesn't
   resolve, which is the intended safety net.

Unknown types fall back to `other` via `getHarvestOptions`, so an unmapped
homebrew type degrades gracefully rather than yielding nothing.

## Related

- [Harvest logic](../harvest/HarvestDetails.md) · [Logic breakdown](../harvest/LogicBreakdown.md)
- [Compendium pack](../../packs/PacksDetails.md)
