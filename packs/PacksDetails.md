# Packs Details

Foundry compendium packs shipped with the module.

## Files

| File | Entries | Type | Declared as |
|---|---|---|---|
| `harvest-items.db` | 70 | `Item` (dnd5e) | `runes-and-remnants.harvest-items` |

Registered in [`module.json`](../module.json) under `packs`, and bundled into
every release zip.

---

## `harvest-items.db`

NeDB format — **one JSON document per line**, no wrapping array. Do not
pretty-print it; Foundry parses it line-by-line.

### Contents

Monster components across four rough categories:

- **Materials** — Hide, Pelt, Chitin, Bark, Stone, Plating, Bone, Bone Shards, Fur
- **Organs** — Heart, Liver, Brain, Breath Sac, Poison Gland, Silk Sack, Vesicle
- **Essences** — Frail, Robust, Potent, Mythic, Deific (the CR-scaled tier)
- **Fluids & sundries** — Phial of Blood/Acid/Sap/Oil/Wax/Mucus, Pouch of
  Scales/Teeth/Claws/Feathers/Dust/Spore/Pollen/Hyphae/Leaves

dnd5e item types in use: `loot`, `consumable`, `equipment`.

### Required invariants

Enforced by [`tests/harvest-pack.test.js`](../tests/TestDetails.md):

| Invariant | Why |
|---|---|
| Every entry has a unique 16-char `_id` | Without one, Foundry regenerates IDs per install, so the pack is non-deterministic and nothing can reference into it |
| Item names are unique | Names are the join key from `HARVEST_TABLE`; a duplicate resolves to whichever entry sorts first |
| No `@UUID[Item.…]` links | That form points at *world* items — a broken link in every world but the author's |
| Every `@UUID` resolves inside the pack | Links use `@UUID[Compendium.runes-and-remnants.harvest-items.Item.<id>]` |
| Every `HARVEST_TABLE` / `ESSENCE_TABLE` name exists here | Otherwise the material silently never drops |

### Disambiguated names

Four entries were renamed because they collided on the join key:

| Was | Now | Distinguished by |
|---|---|---|
| `Bone` (×2) | `Bone` / `Bone Shards` | "Bone of another…" vs "Broken shards of a skeleton" |
| `Hair` (×2) | `Hair` / `Fur` | "Hair of an unlucky solider" vs "Matted and filthy" |
| `Membrane` (×2) | `Membrane (Ooze)` / `Membrane (Plant)` | ooze surface vs plant membrane |

A `Phail of Mucus` typo orphan (placeholder description, referenced by nothing)
was removed, taking the pack from 71 to 70 entries.

Parenthetical qualifiers are the naming convention for variants — see also
`Poison Gland (Material)` / `Poison Gland (Poison)` and the `Essence (…)` tiers.

---

## Authoring workflow

The pack is edited **in Foundry**, then synced back to the repo:

1. Create or edit items in the Foundry compendium
2. Export/sync into the module's pack file
3. Copy the updated `.db` into `packs/`
4. **Run `npm test`** — `harvest-pack.test.js` catches missing `_id`s, duplicate
   names, world-item links and broken table references before they ship
5. Commit, then bump `module.json` to trigger a release

> Step 4 is the important one. Foundry's own export does not guarantee the
> invariants above — the `_id`-less, world-linked state that prompted these
> tests came straight out of a normal export.

### Legacy flags

Entries still carry `flags` from the world they were authored in —
`scene-packer`, `rest-recovery`, `midiProperties`, `midi-qol`, and an
`exportSource` naming world `dividedecay`, dnd5e 3.3.1, core 11.315. These are
inert for consumers but explain the file's size.

## Planned

`system.rarity` is empty on most entries, and there are no module-owned flags
for category, creature source, or crafting tags. Adding them is
[ROADMAP Phase 2](../docs/ROADMAP.md) — the data layer crafting will query
instead of string-matching names.

## Related

- [Harvest table](../src/data/DataDetails.md) — what references these names
- [Pack tests](../tests/TestDetails.md)
