# Harvest Details

The Harvest System — currently the only implemented gameplay feature, and the
foundation layer the crafting/rune systems will build on.

## Files

| File | Lines | Purpose |
|---|---|---|
| [`logic.js`](logic.js) | ~330 | Pure game logic: modifiers, essence table, rolls, DC/unlock resolution, item granting |
| [`menu.js`](menu.js) | ~390 | `HarvestMenu extends Application` — UI, role assignment, harvest execution |

Deep dives: [`LogicBreakdown.md`](LogicBreakdown.md) · [`MenuBreakdown.md`](MenuBreakdown.md)

---

## `logic.js`

No Foundry dependency at module scope, so every export below is unit-testable.

### Constants

| Export | Type | Purpose |
|---|---|---|
| `MODULE_ID` | `string` | `"runes-and-remnants"` — used for log prefixes and socket names |
| `TYPE_MOD` | `Record<string, number>` | Per-creature-type difficulty modifier. **Only consumed by `computeHarvestDC`**, which is no longer in the harvest path |
| `HARVEST_SKILL_BY_TYPE` | `Record<string, string>` | Creature type → 5e skill name (Beast→Survival, Aberration→Arcana, …) |
| `RARITY_MOD` | `Record<string, number>` | Rarity → DC modifier. Same status as `TYPE_MOD` |
| `ESSENCE_TABLE` | `Array` | 5 tiers of `{ crMin, crMax, dc, name, rarity }`. **This is where creature difficulty scaling lives.** |
| `DUPLICATE_RESOLVER` | `object` | Intentionally empty. Extension point for worlds adding same-named item variants |

### Functions

| Export | Signature | Purpose |
|---|---|---|
| `getEssenceByCR` | `(cr) → { name, rarity, dc }` | Selects the essence tier for a CR. CR 0–2 falls back to `Essence (Frail)` at DC 20 |
| `computeHarvestDC` | `({ cr, type, rarity, rarityMultiplier, baseDC }) → number` | CR/type/rarity-scaled DC. **Not used by the harvest workflow** — retained for macros and third-party callers |
| `bestSkillFor` | `(actor, skills[]) → { key, mod }` | Highest-modifier skill from a candidate list |
| `rollSkillCheck` | `async (actor, skillKey, label) → { total, roll }` | Generic skill roll + chat card. *Uses the Foundry `Roll` global* |
| `rollAssessment` | `async (actor, creatureType, { disadvantage }) → { total, skillName }` | INT + type-skill proficiency. Identifies harvesting method |
| `rollCarving` | `async (actor, creatureType, { disadvantage }) → { total, skillName }` | DEX + type-skill proficiency. Extracts materials |
| `computeHelperBonus` | `(helpers[], skillKey, sizeKey) → { total, breakdown, cap }` | Helper contribution, capped by creature size |
| `grantMaterial` | `async ({ item, qty, toActor, dropAt })` | Item-Piles-aware granting, falls back to `createEmbeddedDocuments` |
| `findCompendiumEntry` | `(loot[], itemName, creatureType) → entry\|null` | Name lookup with duplicate-variant disambiguation |
| `getHarvestOptions` | `(type) → HarvestTier[]` | Reads `HARVEST_TABLE`; falls back to `other` |
| `getUnlockedMaterials` | `(type, total, cr) → {...}` | **Single resolution point** for what a harvest yields |
| `harvestOutcome` | `(unlockedCount, tierCount) → string` | Derives the outcome label from tiers met |
| `finalHarvestResult` | `(dc, total) → string` | Legacy single-DC classifier. Retained for macros |
| `rollOutcome` | `({ rollTotal, dc }) → string` | Legacy alias of `finalHarvestResult` |

**Helper size caps** (`computeHelperBonus`): tiny 0 · sm 1 · med 2 · lg 4 · huge 6 · grg 10 · unknown 3.
Each helper adds full proficiency if trained, half (floored) if not.

---

## `menu.js`

`HarvestMenu extends Application`. Registered as `rnr-harvest-menu`, renders
[`templates/harvest-dialog.html`](../../templates/harvest-dialog.html) at 700px wide.

### Instance state

| Property | Purpose |
|---|---|
| `targetToken` | The `TokenDocument` being harvested (**not** a `Token` placeable) |
| `targetActor` | `targetToken.actor` |
| `loot` | Full compendium index — used only to resolve names to documents |
| `selectedLoot` | `Set<string>` of item **names**, not IDs |
| `assessor` / `harvester` | `{ actorId, name, img }` or `null` |
| `helpers` | Array of the same shape |

### Methods

| Method | Purpose |
|---|---|
| `_ensureLootIndex()` | Loads and caches the compendium index once |
| `_buildMaterialTiers()` | Builds the tier-grouped panel for the current creature type. Returns `{ tiers: [], essence: null }` when there is no target |
| `_allMaterialNames()` | Flattens the panel to names, for Select All |
| `_actorSummary(actor)` | Extracts `{ type, cr }` across dnd5e schema shapes |
| `_getPortrait(actor)` | Portrait with `mystery-man.svg` fallback |
| `_skillKeyForType(type)` | Skill name → 3-letter dnd5e skill key |
| `_getAvailableActors()` | Actor list weighted: active-owner PCs (1) → on-scene (2) → everything else (3) |
| `getData()` | Template context |
| `activateListeners(html)` | Delegated handlers for role assignment, loot ticks, harvest start |
| `_startHarvest()` | Validates, then **requests** a harvest from the designated GM |
| `static executeHarvest(payload)` | Entry point for execution, with the per-token in-flight guard |
| `static _runHarvest(payload, selectedLoot)` | The full workflow — see [`MenuBreakdown.md`](MenuBreakdown.md) |
| `static closeAll()` | Closes every Harvest Menu open on this client |

### Execution authority

Execution is **GM-authoritative**. `_startHarvest` never harvests directly — it
builds a payload and either runs it (if this client is the designated GM) or
emits `requestHarvest` over the socket. Only the GM chosen by `pickExecutorId`
acts on that message.

This matters because the menu is broadcast to every connected client, so
without a single designated executor each of them would grant the same loot.
Execution is static and payload-driven because the GM's client may never have
had the menu open, and therefore has none of the instance state.

### Role rules

- The same actor **may** hold both Assessor and Harvester → **both rolls at disadvantage** (`2d20kl1`).
- An actor holding Assessor or Harvester **cannot** also be a Helper.
- Assigning someone as Assessor/Harvester silently removes them from Helpers.
- Helper count is capped by creature size.

---

## Design notes

**Item names are the join key.** `HARVEST_TABLE` stores names, the compendium
stores items, and `findCompendiumEntry` matches on name. This is why duplicate
or misspelled names are correctness bugs rather than cosmetic ones, and why
[`tests/harvest-pack.test.js`](../../tests/TestDetails.md) guards the contract.

**Selection is keyed by name, not `_id`.** Pack `_id`s were absent historically
and are regenerated per install if missing; names are stable across the table
and the pack.

**One DC model.** Material tiers use flat DCs (20/30/40) against the *combined*
two-roll total; creature difficulty is expressed through the CR-scaled
`ESSENCE_TABLE`. See [ROADMAP § 1.2](../../docs/ROADMAP.md).

## Known gap

Role selections are **not synced** between clients. The menu is broadcast on
open, but assessor/harvester/helper assignments are local state, so each client
fills in its own form. Harmless in practice — one person completes it and
submits, and execution is GM-authoritative — but shared state belongs with the
Phase 3 hub rework.

## Related

- [Data tables](../data/DataDetails.md)
- [Template](../../templates/TemplatesDetails.md) · [Styles](../../styles/StylesDetails.md)
- [Compendium pack](../../packs/PacksDetails.md)
