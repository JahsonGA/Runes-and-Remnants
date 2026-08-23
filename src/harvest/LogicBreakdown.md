# Logic Breakdown

Deep dive into the difficulty and yield math in [`logic.js`](logic.js). The rest
of the file is table lookups and thin Foundry wrappers.

## The DC model

One number is produced:

```
Harvesting check = assessment (1d20 + INT + prof)
                 + carving    (1d20 + DEX + prof)
                 + helper bonus
```

It is compared against **cumulative Harvest DCs** built from per-component
costs. Each component carries its own cost (5/10/15/20/25 from
`HARVEST_TABLE`, or 25–50 by CR for essence), and the Harvest DC for a position
in the list is the running total of everything before it:

```
Pouch of Teeth  cost 10  ->  Harvest DC 10
Eye             cost  5  ->  Harvest DC 15
Eye             cost  5  ->  Harvest DC 20
Breath Sac      cost 25  ->  Harvest DC 45
Robust Essence  cost 30  ->  Harvest DC 75
```

A check of 37 takes the teeth and both eyes, and leaves the rest on the corpse.

### Why ordering is the mechanic

Because the totals accumulate, *where* you put a component decides whether you
can afford it. Over 100k simulated harvests, a level 5 party against a CR 10
dragon:

| Order | Avg recovered | Breath Sac |
|---|---|---|
| Prize first | 0.99 of 5 | 96% |
| Cheap first | 3.23 of 5 | 0% |

Neither is wrong — that is the decision the system exists to pose.

### A correction worth knowing

An earlier revision rescaled the component costs to 20/30/40, having found that
every tier always unlocked. The diagnosis was right and the fix was wrong: the
tiers always unlocked because they were never *accumulated*, not because the
numbers were too small. The source values are restored, and
[`tests/harvest-table.test.js`](../../tests/TestDetails.md) now pins the
5/10/15/20/25 scale so it cannot drift again.

## `buildHarvestList(orderedNames, type, cr)`

Turns the harvesters' ordered choice into entries carrying a running cost.

```js
let running = 0;
// per name:
running += componentDC;
return { name, order, componentDC, harvestDC: running, unknown };
```

**Order is preserved exactly** — never sorted. That is the mechanic: an
expensive component early pushes everything after it out of reach.

**Duplicates are allowed.** A dragon has two eyes; the list can hold `Eye`
twice, and the second costs the same as the first on top of the running total.

**Unknown names contribute zero** and are flagged. A name that isn't on the
creature's table would otherwise silently inflate every later Harvest DC.

### Return shape (per entry)

| Field | Meaning |
|---|---|
| `name` | Component name — the compendium join key |
| `order` | 1-based position in the list |
| `componentDC` | This component's own cost, or `null` if unknown |
| `harvestDC` | Running total: what the check must beat to get this far |
| `unknown` | True when the creature cannot yield this component |

## `resolveHarvest(harvestList, checkTotal)`

```js
awarded: usable.filter(e => checkTotal >= e.harvestDC)
missed:  usable.filter(e => checkTotal <  e.harvestDC)
```

Because the running total only increases, `awarded` is always the leading run —
you cannot skip a component you couldn't afford and still get the next one.
Filtering (rather than slicing) matches the rule text literally and produces
the same result.

## `getComponentDC(type, name, cr)`

Essence is checked first, since it is appended to every creature's table and
priced by CR rather than by type. Then the creature's own tiers. Returns `null`
when the component belongs to neither, which is what sets the `unknown` flag.

Note it only matches the essence for *that* CR — the source is explicit that a
creature has exactly one essence, the one its CR dictates.

## `harvestOutcome(unlockedCount, tierCount)`

```js
if (unlockedCount <= 0)          return "failure";
if (unlockedCount >= tierCount)  return "critical-success";
if (unlockedCount === 1)         return "partial";
return "success";
```

The outcome is *derived*, not rolled against a separate DC. Ordering matters:
the `<= 0` guard runs first so a creature type with zero tiers reports failure
rather than critical success.

## `getEssenceByCR(cr)`

```js
ESSENCE_TABLE.find(e => cr >= e.crMin && cr <= e.crMax)
  ?? { name: "Essence (Frail)", rarity: "uncommon", dc: 20 }
```

The table starts at CR 3, so **CR 0–2 hits the fallback** — same name as the
first tier but at DC 20 instead of 25, making low-CR essence reliably obtainable.

| CR | Essence | DC |
|---|---|---|
| 0–2 | Frail *(fallback)* | 20 |
| 3–6 | Frail | 25 |
| 7–11 | Robust | 30 |
| 12–17 | Potent | 35 |
| 18–24 | Mythic | 40 |
| 25+ | Deific | 50 |

Names match compendium entries exactly — `getComponentDC` matches on
`essence.name`, and the name goes straight into the grant list.

## `computeHelperBonus(helpers, skillKey, sizeKey)`

```js
const sizeCap = { tiny: 0, sm: 1, med: 2, lg: 4, huge: 6, grg: 10 }[sizeKey] ?? 3;
```

Loops to `min(helpers.length, sizeCap)`. Trained helpers add full proficiency,
untrained add `floor(prof / 2)`. Actors that no longer resolve are skipped
without consuming a slot.

Returns `{ total, breakdown, cap }` — `breakdown` drives the per-helper chat
list, `cap` drives the UI's "Max Helpers" display and the add-helper guard.

## `findCompendiumEntry(loot, itemName, creatureType)`

```js
const candidates = loot.filter(i => i.name === itemName);
if (candidates.length <= 1) return candidates[0] ?? null;
```

With one match (the normal case now the pack is deduplicated) it returns
immediately. With several it consults `DUPLICATE_RESOLVER` for field hints
keyed by creature type, then falls back to the first candidate.

`DUPLICATE_RESOLVER` ships **empty** — the former collisions (`Bone`, `Hair`,
`Membrane`) were renamed in the pack instead, since names are the join key.
The mechanism remains for worlds that add their own variants.

## Retained but unused

`computeHarvestDC`, `finalHarvestResult`, `rollOutcome`, `TYPE_MOD` and
`RARITY_MOD` are **not** part of the harvest path. They implement the older
CR/type/rarity-scaled single-DC model and are kept exported for macros and
third-party callers. `computeHarvestDC` is where `TYPE_MOD`/`RARITY_MOD` are
consumed; nothing else reads them.
