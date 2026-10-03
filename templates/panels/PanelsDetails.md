# Panels Details

One panel per hub tab. Each is registered as a Handlebars partial in
[`index.js`](../../index.js) so `hub.html` can swap between them without a
second Application.

| File | Tab | Controller |
|---|---|---|
| [`harvest.html`](harvest.html) | Harvest | `HarvestMenu` (state lives in the class) |
| [`crafting.html`](crafting.html) | Crafting | [`CraftPanel`](../../src/craft/panel.js) |
| [`enchanting.html`](enchanting.html) | Enchanting | [`EnchantPanel`](../../src/enchant/panel.js) |

All three are live. None is a placeholder.

---

## Shape

Every panel is a `<section class="rnr-columns">` holding two
`.rnr-card` elements: **choose on the left, commit on the right**.

Crafting and Enchanting mark both cards `rnr-card-pinned`, which keeps their
header and filter still while a `.rnr-catalogue` scrolls beneath. Harvest's
cards scroll as a whole — the default — because they have no pinned header of
their own. A card that is `pinned` without an inner scroller **clips its
contents dead**, which is exactly what happened to the harvest panel once.

The columns are `auto-fit`: two while there is room, one below about 630px. A
fixed two-column grid squeezed each card to 169px in a narrow window, which
reads as *"the control is missing"* rather than *"the control is tiny"*.

## Conventions

**Every control carries `data-action`.** Listeners are delegated from the
panel root, so a re-render never needs rebinding. The value it acts on is in
`data-value` (or `data-name` in the older harvest markup).

**Numbered steps mean order.** Enchanting is `1 · The item`, `2 · <kind>`,
`3 · The component`, `4 · The remnant`, because each choice narrows the next.

**Unusable options are named, not listed.** An enchantment group for an item
kind you have not chosen shows its header and a count — `8 for a different
item` — and nothing else. Dimming alone was not enough: the pills still took
the room, and pushed step 4 below the fold.

**Nothing states a promise it cannot keep.** A disabled action always has a
sentence beneath it saying why, and a highlighted reagent is one that will
actually be spent, not merely one that could be.

## Where the state lives

Panels receive shaped data, never documents. `CraftPanel` and `EnchantPanel`
hold selection state and turn it into template context; the hub owns the
actors, the sockets and anything that writes. That split is what lets the
panels be rendered in a browser test with no Foundry present.

## Related

- [Templates](../TemplatesDetails.md) — registration and the shared partial
- [Partials](../partials/PartialsDetails.md) — the crafter picker
- [UI tests](../../tests/ui/UiDetails.md) — these panels, rendered and measured
- [Styles](../../styles/StylesDetails.md)
