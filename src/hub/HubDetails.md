# Hub Details

The single window for the module: **Harvest · Crafting · Enchanting**.

## Files

| File | Purpose |
|---|---|
| [`hub.js`](hub.js) | `RunesHub extends HarvestMenu` — tab state and panel switching |

Tab definitions live in [`src/data/hub-tabs.js`](../data/DataDetails.md) so they
stay importable from tests; the class itself needs a Foundry runtime.

---

## Why it extends `HarvestMenu`

Harvest is the only implemented system. All of its state — target token, roles,
harvest list — and all of its listeners already live in `HarvestMenu`, and that
path is GM-authoritative and covered by tests. Inheriting leaves it untouched:
the hub only adds `activeTab` and swaps which partial the template renders.

When crafting grows real state of its own, that is the point to split this into
a shell plus per-panel controllers. Doing it now would mean rewriting a working
system to support two that don't exist yet.

## API

| Member | Purpose |
|---|---|
| `RunesHub.open({ tokenDoc, tab })` | Opens or focuses the hub. **Preferred entry point.** |
| `activeTab` | `"harvest"` · `"crafting"` · `"enchanting"` |
| `getData()` | Adds `activeTab` and `tabs[]` to the harvest context |
| `activateListeners(html)` | Adds the delegated `switch-tab` handler |

### `RunesHub.open()`

Reuses an existing window rather than constructing a second one — Foundry keys
applications by `id`, so two instances would fight over the same DOM node.

Passing a new `tokenDoc` **clears the harvest list**: a list is a set of running
DCs computed against one specific corpse, so carrying it to a different creature
would silently produce wrong numbers.

## Entry points

| Route | Behaviour |
|---|---|
| Token HUD cleaver | Opens on **Harvest** with that token targeted |
| Scene controls (mortar & pestle) | Opens with no target — for crafting and enchanting |
| `game.modules.get("runes-and-remnants").api.openHub({ tab })` | For macros |
| Socket `openHarvest` | Broadcast open, so every client sees the same corpse |

The scene-controls hook handles **both** control shapes — v11/v12 pass an array
of groups, v13+ an object keyed by name — and is wrapped in try/catch, since a
failure there must not take down the rest of the module.

## Panels

Registered as Handlebars partials during `init` so the hub can swap tabs without
a second Application:

| Partial | Template | State |
|---|---|---|
| `rnrHarvestPanel` | [`panels/harvest.html`](../../templates/panels/harvest.html) | Live |
| `rnrCraftingPanel` | [`panels/crafting.html`](../../templates/panels/crafting.html) | Live — Gear and Alchemy |
| `rnrEnchantingPanel` | [`panels/enchanting.html`](../../templates/panels/enchanting.html) | Live — Bind and Evolve |
| `rnrCrafterPicker` | [`partials/crafter.html`](../../templates/partials/crafter.html) | Shared by the latter two |

All three systems roll, spend and grant. `HUB_TABS` keeps its three-state
`status` (`live` / `partial` / `planned`) even though nothing is currently
below `live` — a system genuinely can be in between, and crafting sat at
`partial` for a while with a usable catalogue and no execution.

**The reference tables stayed** when each system was automated. Manufacturing
costs and tool pairings, the enchanting rarity ladder, the flaw table and the
spirit-point limits are what a table reads at the bench, and they are no less
true now that the module rolls the dice.

An unbuilt tab would stay **clickable**. A greyed-out tab reads as broken; a
dormant one that opens a reference card reads as a roadmap.

## Icons

Foundry core assets only — every install ships them, so nothing 404s and no art
needs bundling. Pinned by test, since a typo'd path fails silently as a missing
image:

| Tab | Icon |
|---|---|
| Harvest | `icons/tools/cooking/knife-cleaver-steel-grey.webp` |
| Crafting | `icons/skills/trades/academics-merchant-scribe.webp` |
| Enchanting | `icons/skills/trades/academics-book-study-purple.webp` |

## Who is at the bench

Crafting and Enchanting used to take the harvester silently. That read as a
bug the moment the workbench knew someone's Dexterity but found none of their
supplies — nothing on screen said whose pack it was looking in.

Both tabs now carry a picker, sharing
[`templates/partials/crafter.html`](../../templates/partials/crafter.html)
with the harvest tab's markup and classes so all three behave the same.

`_crafterActor()` prefers an explicit choice and falls back to the harvester,
and the picker tags an inherited choice **from Harvest** so it is never
mistaken for a deliberate one. Clearing it falls back to the harvester rather
than to nobody, which is the more useful of the two.

The person who guts the corpse is not always the one who works the forge.

## Related

- [Harvest system](../harvest/HarvestDetails.md)
- [Templates](../../templates/TemplatesDetails.md) · [Styles](../../styles/StylesDetails.md)
- [Roadmap](../../docs/ROADMAP.md) — Phase 3 is this shell; Phases 4–5 fill it
