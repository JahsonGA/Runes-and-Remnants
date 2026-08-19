# Logic Breakdown

Deep dive into the difficulty and yield math in [`logic.js`](logic.js). The rest
of the file is table lookups and thin Foundry wrappers.

## The DC model

One number is compared against every DC in the system:

```
totalRoll = assessment (1d20 + INT + prof)
          + carving    (1d20 + DEX + prof)
          + helper bonus
```

Two independent gates consume it:

| Gate | DCs | Source | Scales with |
|---|---|---|---|
| **Material tiers** | 20 / 30 / 40 | `HARVEST_TABLE` | nothing — flat by design |
| **Essence** | 25 / 30 / 35 / 40 / 50 | `ESSENCE_TABLE` | creature CR |

Creature difficulty is expressed **only** through essence. A CR 1 rat and a CR
20 dragon are equally easy to skin; only the dragon's essence is hard to pull.
This was a deliberate design decision — see [ROADMAP § 1.2](../../docs/ROADMAP.md).

### Why the DCs were rescaled

The tier DCs were originally 10/15/20, which reads as a normal 5e DC — but they
were being compared against a *two-roll* total averaging ~31, so every tier
unlocked on every harvest and the gate did nothing. Rescaling to 20/30/40 puts
them inside the actual distribution.

[`tests/harvest-table.test.js`](../../tests/TestDetails.md) enforces the 20/30/40
scale, because a stray DC 15 tier would silently stop gating.

## `getUnlockedMaterials(type, total, cr)`

The single point where "what did we get?" is answered.

```js
const tiers    = getHarvestOptions(type);      // falls back to `other`
const unlocked = tiers.filter(t => total >= t.dc);
```

**Tiers are additive.** They are filtered independently rather than indexed, so
meeting DC 30 also grants the DC 20 tier without any ordering assumption.

Names are collected with an explicit `includes` guard, so an item appearing in
two tiers is never granted twice.

Essence is then resolved separately:

```js
const essence         = getEssenceByCR(cr);
const essenceUnlocked = total >= essence.dc;
```

### Return shape

| Field | Meaning |
|---|---|
| `names` | Flat, de-duplicated list of everything unlocked, essence included when earned |
| `tiers` | The unlocked tier objects |
| `tierCount` | Total tiers available for this creature type |
| `unlockedCount` | How many were met |
| `essence` | The CR-appropriate essence `{ name, rarity, dc }`, whether or not it was earned |
| `essenceUnlocked` | Whether the total met the essence DC |

`essence` is always returned so the UI can show *what you failed to get*, which
is what makes the DC legible to players.

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

Names match compendium entries exactly — `getUnlockedMaterials` puts
`essence.name` straight into the grant list.

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
