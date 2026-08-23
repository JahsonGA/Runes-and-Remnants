# Templates Details

Handlebars templates rendered by Foundry `Application` classes.

## Files

| File | Rendered by |
|---|---|
| [`hub.html`](hub.html) | `RunesHub` — tab rail + active panel |
| [`panels/harvest.html`](panels/harvest.html) | Harvest panel; also renders standalone as `HarvestMenu` |
| [`panels/crafting.html`](panels/crafting.html) | Crafting reference (Phase 4 placeholder) |
| [`panels/enchanting.html`](panels/enchanting.html) | Enchanting reference (Phase 5 placeholder) |

Referenced by Foundry path, not relative path, e.g.
`modules/runes-and-remnants/templates/hub.html`. Panels are registered as
Handlebars partials in `index.js` (`rnrHarvestPanel`, `rnrCraftingPanel`,
`rnrEnchantingPanel`) so the hub can swap tabs without a second Application.

---

## `harvest-dialog.html`

Two-column layout (`.rnr-columns`) of two `.rnr-card` panels.

### Left — Target Creature & Materials

**Target block** (`{{#if hasTarget}}`) — portrait, name, type, CR, size, and the
computed max-helper count. Falls back to "No target selected."

**Component pool** (`{{#if hasComponents}}`) — clickable components grouped by cost, plus an ordered **Harvest List** below it showing each running Harvest DC:

```handlebars
{{#each componentTiers}}
  <div class="rnr-tier">
    <div class="rnr-tier-header">DC {{this.dc}}</div>
    ...checkbox per item...
  </div>
{{/each}}
```

Then a separate `{{#if essence}}` group in `.rnr-tier-essence`, because essence
is gated by CR rather than by the tier table.

Key details:

- **Checkbox `value` is the item *name***, not `_id` — names are the join key,
  and pack entries had no stable `_id` historically.
- **`this.missing`** flags a name present in `HARVEST_TABLE` but absent from the
  compendium. Renders struck-through with a `⚠` and a tooltip, so authoring
  errors are visible in-game rather than silently dropping the item.
- Only materials the target creature can yield are listed. Before this, the
  panel rendered all 71 compendium items regardless of target.
- The hint line tells players that leaving everything unticked takes whatever
  the roll unlocks.

### Right — Assign Roles

Three role blocks (Assessor, Harvester, Helpers), each either showing the
assigned actor with a remove button or a `.rnr-dropdown` of candidates.

Every selectable entry carries the data attributes the delegated listeners read:

```handlebars
data-action="set-assessor"
data-actor-id="{{id}}" data-actor-name="{{name}}" data-actor-img="{{img}}"
```

Helpers render as `{{#each helpers as |h i|}}` with `data-index="{{i}}"`, which
is what the remove handler splices on.

Below: the helper bonus readout (`{{helperBonusClass}}` → `none`/`low`/
`medium`/`high` for colour), a `{{#if sameActor}}` disadvantage warning, and the
Start Harvest button.

---

## Conventions

- **`data-action` attributes, not IDs or classes**, for behaviour. Listeners are
  delegated in `activateListeners`, so they survive re-renders.
- **Presentation classes are `rnr-`-prefixed** and defined in
  [`styles/module.css`](../styles/StylesDetails.md).
- The template renders **only what `getData()` supplies** — all filtering,
  grouping and selection state is computed in `menu.js`, never in Handlebars.

### Registered helpers

`index.js` registers `eq` (`(a, b) => a === b`) at `init`. It is available but
not currently used by this template.

## Related

- [Menu implementation](../src/harvest/HarvestDetails.md) · [Menu breakdown](../src/harvest/MenuBreakdown.md)
- [Styles](../styles/StylesDetails.md)
