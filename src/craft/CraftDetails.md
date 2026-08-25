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
| [`logic.js`](logic.js) | Pure logic: recipe lookup, DC arithmetic, concoction validation, the third-party registry |
| [`panel.js`](panel.js) | `CraftPanel` — the crafting tab's state and template shaping |
| [`outcome.js`](outcome.js) | What a roll means and what it costs. Pure |
| [`extras.js`](extras.js) | Reads third-party recipes from the world's compendiums |
| [`execute.js`](execute.js) | Rolls, spends, grants. GM-authoritative |

Data lives in [`src/data/manufacturing.js`](../data/DataDetails.md) and
[`src/data/alchemy.js`](../data/DataDetails.md).

---

## Reagents — the Harvest ➜ Craft join

Without this, Harvest and Craft merely share a window. With it, **what you
hunted decides what you can make.** Everything in the catalogue demands
monster parts — that is the house rule that replaced gold with monster parts
in the first place. A hunter's kit is built out of what they killed: chitin
plate, a hide coat, a blade knapped from a talon, a wand cut from an eye
stalk. That is Ryoko's and Grim Hollow's premise, not a garnish on it.

> The first cut of this system exempted weapons and armour on the reasoning
> that "steel is not a monster part." That was backwards, and the test named
> *"asks for monster parts from gear too"* exists to keep it from creeping
> back.

Three ideas, layered:

**Property.** A recipe asks for a *kind* of part — `vital`, `virulent`,
`elemental`, `arcane`, `perceptive`, `structural`, `viscous`, `fibrous` —
never a specific item. Tags are keyed by component *name*, because the
harvest table reuses 65 names across 215 creature-type rows: a Heart is a
Heart whether it came out of a dragon or a goblin. Many parts carry more than
one property, so many monsters satisfy any given recipe and a party is never
locked out for want of one creature. A test asserts every property is carried
by at least five components, for exactly that reason.

Gear accepts **any of several** properties, because a blade can be talon or
bone or chitin and fixing on one would be wrong most of the time. Potions ask
for exactly one, since what a brew does depends on what went into it.

**Potency.** How impressive the kill was, read off the part's harvest DC —
5/10/15/20/25 → 2/5/7/10/12, essences 12–25 by CR. Nothing new to author. The
curve steepens on purpose: harvest DCs are *cumulative*, so reaching the fifth
component costs far more than five times the first, and potency has to bend
the same way or nobody would ever reach for the hard components.

**Budget.** A recipe needs a potency *total*, not one qualifying part. Five
phials of blood brew what one dragon's heart brews. A low-level party grinds;
a high-level one takes a single trophy.

Potions take their budget from **rarity**; gear takes it from the **material
yardstick**, since armour has no rarity but plainly wants more hide than a
dagger does. The gp figures span three orders of magnitude, so it is a ladder
rather than arithmetic — a linear conversion would demand a hundred hearts for
a breastplate.

| Material yardstick | Potency | Typical build |
|---|---|---|
| ≤ 1 gp | 2 | arrowheads, a flask |
| ≤ 5 gp | 3 | dagger, shield, leathers |
| ≤ 20 gp | 5 | longsword, chain shirt |
| ≤ 60 gp | 7 | longbow, scale mail |
| ≤ 150 gp | 10 | breastplate |
| above | 14 | half plate, plate |

Unpriced items — rings, rods, wondrous items, which the book leaves to the GM
— sit mid-ladder at 7 rather than pretending to a precision the source never
had.

```
Potion of Superior Healing (rare) — needs [vital], potency 10
  Dragon Heart      DC 20 → 10  ✓
  Liver             DC 15 →  7  ✗ short by 3
  Phial of Blood ×5 DC  5 → 10  ✓

Plate — needs [structural or fibrous], potency 14
  Chitin  DC 20 → 10
  Hide    DC 20 → 10   ✓ 20 of 14
  Heart   DC 20 → —    ✗ organs are not armour

Rod, staff, wand — needs [arcane, perceptive or structural], potency 7
  Main Eye  DC 20 → 10  ✓  an eye stalk makes a wand
```

**Creature theme is a bonus, never a gate.** A giant's heart in a Potion of
Giant Strength takes 2 off the DC. A troll's heart still works. Flavour should
reward, not dead-end.

### Origin stamping

Potency depends on the DC a part was cut at and the creature it came from —
neither recoverable after the fact, since a Heart in a backpack looks the same
either way. So harvest stamps `flags["runes-and-remnants"].origin` onto every
granted item, and `partFromItem` reads it back.

Parts predating that, or handed out by a GM, fall back to the component's
**lowest** DC anywhere in the table. Deliberately the lowest: a generous
default would let a player launder scraps into legendary reagents. The panel
marks such parts with a `?` so the player can see they may be owed more.

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

## Execution

`execute.js` rolls the check, spends the materials and grants the item,
GM-authoritative over the socket — the same shape harvest uses, because
otherwise every connected client crafts the same thing.

The check is `1d20 + ability + proficiency`, or `2d20kl1` without the tool.
Crits read off the *kept* d20, so a natural 20 on a disadvantaged roll still
counts.

### Failure is graded

Losing everything on a miss is the obvious rule and the wrong one. A
legendary potion wants a CR 21 essence and a thousand hours; wiping that on
one bad d20 makes crafting something nobody attempts. The materials are the
*harvest* the party earned, and taking them back too readily punishes the
wrong half of the loop.

| Result | Item | Materials | Hours |
|---|---|---|---|
| Natural 20, or beat the DC by 10 | yes | spent | spent |
| Meet the DC | yes | spent | spent |
| Miss by less than 5 | no | **kept** | spent |
| Miss by 5 or more | no | spoiled | spent |
| Natural 1 | no | spoiled | spent |

A natural 20 succeeds however low the total, so a first-level character can
still get lucky and the ceiling of what they can attempt keeps moving.

### What gets spent

`checkReagents` reports what *could* count; `selectReagents` picks what
actually goes in. Spending a player's whole stock of matching parts to make
one dagger would be theft, so it takes the **minimum that meets the budget,
cheapest first** — burn scraps, keep trophies.

One themed part is taken first when there is one, because it buys 2 off the
DC and a cheapest-first rule would never reach it: a giant's heart sorts to
the expensive end.

Stacks are spent **unit by unit**. A stack of four bones is worth four bones
of potency and must cost four bones to spend — crediting the stack while
deducting one item would let the same bones be spent over and over.
`consumptionPlan` carries the original stack size on each unit so it knows
whether taking two of four is a decrement or a delete.

The panel names what will be spent *before* the click.

### Not yet

Alchemy consumes no plant stock — those ingredients are not tracked as items
yet, and the chat card says so rather than leaving it to be discovered.
Elapsed crafting hours are not carried across sessions.

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
