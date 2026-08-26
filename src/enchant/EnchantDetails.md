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

## Related

- [Craft](../craft/CraftDetails.md) — makes the mundane item, and owns the property tags
- [Harvest](../harvest/HarvestDetails.md) — produces both the components and the remnants
- [Hub](../hub/HubDetails.md) — owns the `EnchantPanel`
- [Roadmap](../../docs/ROADMAP.md) — Phase 6 is Ancestral Weapons
