# Craft Details

Two separate systems that share a tab.

| System | What it makes | DC comes from |
|---|---|---|
| **Manufacturing** | Mundane weapons, armour, ammunition, gear | A flat DC per item type |
| **Alchemy** | Potions, poisons, enchantment brews | `10 + every ingredient's DC modifier` |

Enchanting — turning a *finished* mundane item magical — is Phase 5 and is
not here.

## Files

| File | Purpose |
|---|---|
| [`logic.js`](logic.js) | Pure logic: recipe lookup, DC arithmetic, concoction validation |
| [`panel.js`](panel.js) | `CraftPanel` — the crafting tab's state and template shaping |

Data lives in [`src/data/manufacturing.js`](../data/DataDetails.md) and
[`src/data/alchemy.js`](../data/DataDetails.md).

---

## Manufacturing

Follows Ryoko's Manufacturing DC & Time table: each item type has a tool, an
ability, an hour count and a DC.

**Tool proficiency is not required.** An unproficient crafter still rolls —
at disadvantage. `planManufacture` reports this as `disadvantage: true`
rather than blocking the attempt.

**Material cost is a yardstick, not a price.** The house rule in the
campaign's Crafting Rules replaces the gold figure with the monster parts the
build actually needs, which the GM adjudicates. `materialYardstick()` returns
the gp figure purely as a sense of *how much* material a thing should take.
Where the table gives no figure, it falls back to the book's rule of thumb —
one third of the finished value.

## Alchemy

```
Alchemy Attempt DC = 10 + the DC modifier of every ingredient used
```

A concoction is **one effect plus up to three modifiers**. `analyseConcoction`
works out what the ingredients make and whether the combination is legal,
returning every rule violation rather than just the first.

The rules it enforces:

- exactly one effect base — **except Bloodgrass**, which rides along with
  another potion effect instead of replacing it
- modifiers must suit their base; `both-modifier` ingredients work either way
- at most three modifiers
- `locked` ingredients refuse modification entirely
- **enchantments are their own path**: they need `Elemental Water` as a base,
  take exactly one enchantment ingredient, and accept no modifiers at all

Lavender Sprig is the only ingredient with a negative modifier, so a careful
alchemist can steady a volatile mix rather than only ever piling on power.

### A discrepancy worth knowing

The supplement prints three worked examples. Two check out against its own
ingredient table (DC 14 and DC 18). **Widow Venom is printed as DC 17 but
computes to 16** — an erratum in the source. `tests/craft-alchemy.test.js`
asserts 16 and says why.

## Licensing

Only mechanics and SRD item names ship in this module. Game mechanics — DCs,
times, formulas — are not copyrightable; SRD item names are CC-BY.

**Third-party items do not ship.** Grim Hollow, L'Arsene's Ledger and similar
commercial content are loaded from the world's own compendium at runtime, so
a public listing carries nothing it has no right to distribute. A table that
owns those books gets the content; the published package stays clean.

## Related

- [Hub](../hub/HubDetails.md) — owns the `CraftPanel`
- [Harvest](../harvest/HarvestDetails.md) — produces the components crafting consumes
- [Roadmap](../../docs/ROADMAP.md)
