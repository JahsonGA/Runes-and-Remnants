# Enchant Details

The third step of the loop: **Kill → Harvest → Craft → Enchant → Evolve**.

Three things go in, and each answers a different question.

| Input | Question it answers |
|---|---|
| **The item** | What is being changed. It must already exist — you cannot enchant a sword you have not made. |
| **The component** | What it *becomes*. A venom gland makes a venomous blade; an eye makes a seeking one. |
| **The remnant** | How *strong* it becomes — the creature's essence, gathered before it faded. |

## Files

| File | Purpose |
|---|---|
| [`logic.js`](logic.js) | Pure: rarity ladder, remnant tiers, the plan, the outcome |
| [`panel.js`](panel.js) | `EnchantPanel` — the tab's state and template shaping |
| [`execute.js`](execute.js) | Rolls, consumes, rewrites the item. GM-authoritative |

Data lives in [`src/data/enchanting.js`](../data/enchanting.js).

---

## The remnant sets the ceiling

Every enchantment names a **floor** rarity. Bring a stronger remnant than it
asks for and the item comes out at *that* rarity instead — with the steeper DC
and the longer hours that go with it. Bring a weaker one and it cannot hold
the enchantment at all.

| Remnant | Rarity | DC | Hours |
|---|---|---|---|
| — | common | 12 | 1 |
| Frail | uncommon | 15 | 10 |
| Robust | rare | 18 | 40 |
| Potent | very rare | 21 | 160 |
| Mythic | legendary | 25 | 640 |
| Deific | artifact | 30 | 100,000 |

Attunement doubles the hours; a consumable takes a tenth.

**These tier names are the essences the harvest table already drops.** A
party's loot is the input to this system with no translation step — which is
the whole point of building the loop in this order.

### Rarity spellings

The essence table says `veryRare`, the manufacturing table says `very rare`,
and dnd5e says `veryRare`. `normaliseRarity` folds all of them together.
Comparing raw would treat a very rare remnant as *unknown* and silently
downgrade an item the party worked hard for, so it is worth the function.

## The check

```
1d20 + the caster's spellcasting ability + the corpse's skill
```

A wizard working a dragon's remnant rolls **Intelligence (Survival)** — the
ability is theirs, the skill belongs to the creature. `HARVEST_SKILL_BY_TYPE`
already maps creature type to skill, and harvest stamps the creature type onto
everything it grants, so this reads straight off the remnant.

Only a spellcaster can bind one. `casterFrom` takes the *best* spellcasting
ability across a multiclass rather than an arbitrary first.

## Failure is not nothing

A miss still binds — badly. The item gains flaws in proportion to how far the
check fell short.

| Margin | Result |
|---|---|
| 0 or better | Clean |
| −1 to −4 | One flaw |
| −5 to −8 | Two flaws |
| −9 to −12 | Three flaws |
| −13 or worse | **Item destroyed** |

This is more interesting than "nothing happens", and it lets a party reach
above their level and live with the result.

**A natural 1 gives three flaws rather than destroying the item.** Losing a
Deific remnant to a single die roll is not a risk anyone would take, and a
mechanic nobody uses may as well not exist.

The remnant and component are consumed **whatever the roll** — the power left
them the moment the binding began. The panel says so before the click.

## Enchantments key off properties

Same reason crafting does: a venomous blade should take *any* venom gland, not
one particular monster's. The 24 enchantments are keyed to the eight component
properties from [`src/data/reagents.js`](../data/reagents.js), crossed with
what kind of thing they go on (weapon, armour, wondrous).

A test asserts every enchantment has at least one component in the harvest
table that satisfies it, and that every item kind has something low-rarity to
make — a party that has only ever killed a wolf should still have an option.

## The item is rewritten, not replaced

`applyEnchantment` renames and updates the original document rather than
deleting and re-creating it, so anything already pointing at it — a sheet
slot, an active effect, a macro — keeps working. Flaws go in the description,
and the whole binding is recorded under `flags["runes-and-remnants"]`,
including `boundAt`, which Phase 6 needs to know an item has been bound once
already.

## Ancestral weapons — spirit points

The Evolve side of the same tab. One weapon per character, grown rather than
replaced, its abilities bought with **spirit points**.

Points are earned through **deeds**, not drops. That is the whole design: a
spirit point you can farm is just another material, and this module already
has plenty of those. Nothing awards them automatically — a GM does, from the
panel.

| | |
|---|---|
| Awakens at | **20** points earned |
| Finished at | **25** — 5 more after waking |
| Tiers | Lesser 1 · Greater 3 · Major 5 · Apex 8 |

Awakening keys off points **earned**, not points remaining: a weapon carried
through twenty points of deeds has woken whether or not its wielder spent
them.

Abilities can require another ability first, so a weapon grows along a path
rather than picking the best three in isolation. A test walks every
prerequisite chain and asserts none costs more than a weapon can hold — a
branch that is permanently unreachable is a bug that looks like content.

### The one-way door

A remnant may be spent in place of a deed. Doing so means the weapon **can
never be enchanted again** — and that is set in the same patch that adds the
points, not left to a caller to remember. Forgetting it would be the worst
kind of bug: the player finds out much later, with no way back. It also asks
for confirmation in the strongest wording anywhere in the module.

No single remnant is worth 20 points, so deeds have to do most of the work.
A test pins that, because the moment a Deific essence could awaken a weapon on
its own the currency stops meaning anything.

### Undoing it

Awarding has to be reversible or it is a trap. A GM can take points back, and
relock an ability to refund its cost — `spent` is derived from `unlocked`, so
dropping the name *is* the refund; there is no second number to keep in step.

Two rules hold it together. Points never drop **below what is already
committed to abilities**, because everything downstream assumes
`spent <= earned`. And relocking is **refused while something depends on it**
rather than cascading, since cascading would silently strip abilities the GM
never named.

`resetPatch` returns a weapon to ordinary and clears `remnantSpent` with it —
the one-way door is a rule about play, not a scar in the data.

### These costs are not a book's

Ancestral Weapons is a commercial supplement. Its ability list and point costs
are its text, and shipping them inside a publicly listed module is the same
risk this project already declined with Grim Hollow, Ryoko's and Heliana's.

What ships is the **engine** plus a ladder built to the two numbers the
campaign had already fixed — 20 to awaken, 5 to finish. A table that owns the
book replaces it in one of two ways:

- edit `SPIRIT_ABILITIES` in [`src/data/spirit.js`](../data/spirit.js), or
- call `registerSpiritAbilities(list, { replace: true })`, the same seam
  third-party recipes use.

The panel says so on screen, so nobody mistakes this module's scale for the
supplement's.

## Related

- [Craft](../craft/CraftDetails.md) — makes the mundane item, and owns the property tags
- [Harvest](../harvest/HarvestDetails.md) — produces both the components and the remnants
- [Hub](../hub/HubDetails.md) — owns the `EnchantPanel`
- [Roadmap](../../docs/ROADMAP.md) — Phase 6 is Ancestral Weapons
