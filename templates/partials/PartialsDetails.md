# Partials Details

Fragments shared between panels, registered in [`index.js`](../../index.js)
alongside the panels themselves.

| File | Partial name | Used by |
|---|---|---|
| [`crafter.html`](crafter.html) | `rnrCrafterPicker` | Crafting, Enchanting |

---

## The crafter picker

Answers one question on screen: **whose hands, and whose pack?**

Crafting and Enchanting used to take the harvester silently. That read as a
bug the moment the workbench knew someone's Dexterity but found none of their
supplies — nothing said whose inventory it was reading, so an empty reagent
list looked like a lookup failure rather than an empty pack.

It deliberately reuses the harvest tab's markup and classes — `rnr-role`,
`rnr-role-entry`, `rnr-dropdown` — so all three tabs behave identically
rather than becoming three near-copies that drift apart.

## What it shows

**An inherited choice is marked.** With no explicit pick, the hub falls back
to the harvester and the picker tags it `from Harvest`, so an inherited
crafter is never mistaken for a deliberate one. Clearing the choice falls back
to the harvester again rather than to nobody, which is the more useful of the
two.

**The role can restrict the list.** Enchanting passes `castersOnly`, and the
picker then offers only spellcasters — better than letting someone choose a
fighter and be refused by a blocker further down the panel. Where an inherited
enchanter cannot cast, it says so directly.

**An empty list explains itself.** "No spellcasters to choose from" and "no
characters you own" are different problems, and the partial distinguishes
them.

## Context it expects

| Key | Meaning |
|---|---|
| `crafterLabel` | "Crafter" or "Enchanter" |
| `crafterIcon` | Core-asset path for the role |
| `crafterActor` | `{ id, name, img, inherited, wrongForRole }`, or null |
| `castersOnly` | Restricts the list and changes the empty message |
| `availableForCrafter` | `{ id, name, img }[]` |

Built by `RunesHub._crafterRole()`. A partial cannot reach `game`, so
everything it needs arrives already shaped.

## Related

- [Panels](../panels/PanelsDetails.md)
- [Hub](../../src/hub/HubDetails.md) — builds this context and owns the actor
- [Templates](../TemplatesDetails.md)
