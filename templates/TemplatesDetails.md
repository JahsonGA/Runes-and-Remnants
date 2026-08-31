# Templates Details

Handlebars templates rendered by Foundry `Application` classes.

## Files

| File | Rendered by |
|---|---|
| [`hub.html`](hub.html) | `RunesHub` — tab rail + active panel |
| [`panels/`](panels/PanelsDetails.md) | One panel per tab. All three are live |
| [`partials/`](partials/PartialsDetails.md) | Fragments shared between panels |

Referenced by Foundry path, not relative path, e.g.
`modules/runes-and-remnants/templates/hub.html`. Panels are registered as
Handlebars partials in `index.js` (`rnrHarvestPanel`, `rnrCraftingPanel`,
`rnrEnchantingPanel`, plus `rnrCrafterPicker`) so the hub can swap tabs
without a second Application.

A test compiles every template and renders it against real panel data, and a
second one asserts no template names a partial `index.js` never registers —
a broken template does not fail the build, it fails silently in Foundry with
an empty panel and a console trace nobody is watching.

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
