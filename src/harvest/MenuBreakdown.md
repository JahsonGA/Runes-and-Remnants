# Menu Breakdown

Deep dive into [`menu.js`](menu.js) — specifically `_startHarvest()`, the most
intricate control flow in the module. Everything else in the class is
straightforward state management for the dialog.

## Entry points into `HarvestMenu`

There are two, and both pass a **`TokenDocument`** — this matters:

1. **Token HUD button** ([`index.js`](../../index.js)) — `hud.object?.document`
2. **Socket broadcast** — `await fromUuid(payload.tokenUuid)`, then
   `token?.document ?? token`

So `this.targetToken` is always a `TokenDocument`, never a `Token` placeable.
To reach the canvas object (for a drop point) the code goes *outward* via
`this.targetToken.object?.center`, and to delete it calls
`this.targetToken.delete()` directly.

> This was the source of a crash: the original code called
> `this.targetToken.document.delete()`. `TokenDocument` has no `.document`
> property, so every harvest threw a `TypeError` at the final step — after
> items were granted but before the token cleared.

## `_startHarvest()` — step by step

### 1. Guards

Bails with a notification if any of these fail:

| Check | Message |
|---|---|
| `targetActor` exists | "No target creature selected." |
| Both `assessor` and `harvester` assigned | "Assign both an Assessor and a Harvester first." |
| Compendium `runes-and-remnants.harvest-items` resolves | "Harvest Items compendium not found." |
| Both assigned actors resolve via `game.actors.get` | "One or more assigned actors could not be found." |

### 2. Same-actor disadvantage

```js
const sameActor = assessorActor.id === harvesterActor.id;
```

If true, warns the user and passes `{ disadvantage: true }` into **both** rolls,
which swaps the formula from `1d20 + @mod` to `2d20kl1 + @mod`.

### 3. The two rolls

Each posts its own chat card before the summary.

| Roll | Ability | Proficiency | Meaning |
|---|---|---|---|
| `rollAssessment` | INT | type skill, if proficient | Identify the anatomy |
| `rollCarving` | DEX | type skill, if proficient | Extract the material |

Both derive their skill from `HARVEST_SKILL_BY_TYPE[creatureType]`, defaulting
to Survival. Proficiency adds `actor.system.attributes.prof` (default 2) only
when `skill.prof > 0`.

### 4. Helper bonus

```js
computeHelperBonus(helpers, skillKey, sizeKey)
```

Iterates helpers up to the size cap. Trained helpers contribute full
proficiency, untrained contribute `floor(prof / 2)`. Helpers beyond the cap are
silently ignored here — the UI already blocks adding them.

### 5. The combined total

```js
totalRoll = assess.total + carve.total + helperBonus
```

This single number is compared against **every** DC in the system. Its practical
range is roughly 12–58, which is what the 20/30/40 tier scale is calibrated for.

### 6. Resolution

```js
const { names, tierCount, unlockedCount, essence, essenceUnlocked } =
  getUnlockedMaterials(typeKey, totalRoll, Number(cr) || 0);

const result = harvestOutcome(unlockedCount, tierCount);
```

All yield logic lives in `getUnlockedMaterials` — see
[`LogicBreakdown.md`](LogicBreakdown.md).

### 7. Selection filter

```js
const materials = this.selectedLoot.size > 0
  ? unlockedNames.filter(n => this.selectedLoot.has(n))
  : unlockedNames;
```

Two modes:

- **Nothing ticked** → take everything the roll unlocked.
- **Something ticked** → take the intersection of ticked ∩ unlocked. Ticking an
  item does **not** bypass its DC, and essence is no longer force-added.

### 8. Granting

For each surviving name:

```js
findCompendiumEntry(this.loot, itemName, typeKey)  // index entry
  → pack.getDocument(indexEntry._id)               // full document
  → grantMaterial({ item, qty: 1, toActor: harvesterActor, dropAt })
```

Both the missing-entry case and a throwing `getDocument`/`grantMaterial` are
caught and logged as warnings — one bad item never aborts the whole harvest.

`grantMaterial` prefers an Item Piles drop at the token's centre when that
module is active and exposes `api.createItemPile`; otherwise it creates the item
on the harvester.

### 9. Chat summary

Built as an HTML string, posted after a 500ms delay so the two roll cards land
first. Reports target, per-role rolls, helper breakdown, the arithmetic, tiers
unlocked, essence status, outcome, and the recovered list.

### 10. Cleanup

```js
if (game.user.isGM && materials.length) {
  try { await this.targetToken.delete(); } catch (err) { /* warn */ }
}
this.close();
```

Three deliberate conditions:

- **GM-only** — players lack permission to delete tokens; attempting it throws.
- **Only if something was harvested** — a total failure leaves the corpse for a
  retry.
- **Wrapped in try/catch** — a deletion failure must not lose the chat summary.

## Rendering notes

**Loot ticks do not re-render.** The `change` handler mutates `selectedLoot` and
returns; the browser keeps the checkbox state. Re-rendering here would reset the
panel's scroll position mid-selection.

Every other interaction (role assign/remove, Select All, Clear) *does* call
`this.render(true)`, because those change what the template must draw.

**Listeners are delegated** via `html.on("click", "[data-action=…]")` rather
than bound per element, so they survive re-renders.
