# Src Details

Source root for the Runes & Remnants module. All gameplay code lives here; the
Foundry entry point itself is [`index.js`](../index.js) at the project root.

## Structure

| Path | Purpose |
|---|---|
| [`harvest/`](harvest/HarvestDetails.md) | The Harvest System — UI application and pure game logic |
| [`data/`](data/DataDetails.md) | Static game data tables (creature type → materials) |

## Architectural rule

The module maintains a hard split between **pure logic** and **Foundry API calls**:

- `harvest/logic.js` — no Foundry globals at module scope. Every export is
  importable and testable under plain Node/Vitest. This is what lets
  [`tests/`](../tests/TestDetails.md) run without a Foundry runtime.
- `harvest/menu.js` — owns all Foundry interaction (`Application`, `game.packs`,
  `ChatMessage`, `canvas`, token documents).

`logic.js` does reference the Foundry `Roll` global *inside* the roll helper
functions (`rollSkillCheck`, `rollAssessment`, `rollCarving`). Those specific
functions are not unit-tested for that reason; everything around them is.

When adding a system (crafting, runes), follow the same shape: a `logic.js` of
pure functions plus a `menu.js`/application that calls into it.

## Data flow

```
index.js  (Token HUD hook, socket listener, settings)
   │
   └─► HarvestMenu (src/harvest/menu.js)
          │
          ├─► getHarvestOptions()      ─► src/data/harvest-table.js
          ├─► getEssenceByCR()         ─┐
          ├─► buildHarvestList()       ─┼─► src/harvest/logic.js
          ├─► resolveHarvest()         ─┤
          ├─► computeHelperBonus()     ─┤
          ├─► rollAssessment/rollCarving┤
          ├─► harvestOutcome()         ─┘
          │
          ├─► game.packs "runes-and-remnants.harvest-items"
          │       └─► packs/harvest-items.db
          │
          └─► templates/harvest-dialog.html  +  styles/module.css
```

## Related

- [Harvest module details](harvest/HarvestDetails.md)
- [Data tables](data/DataDetails.md)
- [Roadmap](../docs/ROADMAP.md) — why the DC model looks the way it does
