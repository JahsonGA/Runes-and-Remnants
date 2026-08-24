# Docs Details

Project documentation that isn't user-facing. The player/GM-facing feature
description lives in the root [`README.md`](../README.md).

## Files

| File | Purpose |
|---|---|
| [`ROADMAP.md`](ROADMAP.md) | Phased development plan, design rationale, deferred issues |

---

## `ROADMAP.md`

The reference for **why the systems look the way they do**, not just what they
do. Consult it before changing the difficulty model — several non-obvious
decisions are recorded there with their reasoning.

### Structure

| Phase | Status | Scope |
|---|---|---|
| 1 — Stabilize Harvest | current | Crash fix, unified DC model, type-filtered loot, compendium integrity |
| 2 — Item Metadata | planned | Category/rarity/source/crafting-tag flags on every item |
| 3 — Main Hub UI | done | Unified Harvest / Crafting / Enchanting shell |
| 4 — Crafting | partial | Recipes, DCs and alchemy maths live; execution and third-party loading next |
| 5 — Runes / Enchantment | planned | Socketing, evolution, corruption |
| 6 — Ancestral Weapons | planned | Unlock trees, rune infusion, milestone evolution |

Phase 1 subsections carry the detail worth reading: § 1.2 explains why two DC
models existed and how they were reconciled, § 1.4 documents the compendium
integrity problems, and § 1.5b holds the measured difficulty curve.

### Load-bearing content

**§ 1.2 — the DC model.** Explains why material tier DCs are flat at 20/30/40
and why creature difficulty is expressed through CR-scaled essence instead.
Changing tier DCs without reading this will reintroduce a gate that never gates.

**§ 1.5b — the measured curve.** Monte Carlo results over 200k simulated
harvests. Records that the curve is well-spread through roughly level 11 and
then **saturates** — a high-level party unlocks everything every time. That is
the accepted cost of flat DCs, noted for Phase 2 rather than papered over.

**Known deferred issues.** Currently the multi-client double-grant: the socket
broadcast renders the menu on every client and any of them can execute a
harvest, granting items more than once. Deferred to Phase 3, when the socket
layer is being reworked anyway.

---

## Conventions

- **Record the reasoning, not just the decision.** Anything that will look
  arbitrary in six months gets a "why" — the flat-DC choice and the CR-scaled
  essence gate are both easy to "fix" incorrectly without it.
- **Deferred issues stay listed**, with the reason for deferral. A known bug
  that is written down is a decision; one that isn't is a surprise.
- Code comments reference sections by number (`see docs/ROADMAP.md § 1.2`), so
  renumbering sections means updating those references.

## Packaging note

`docs/` is **not** excluded from the release zip, so it currently ships to end
users. Harmless, but see
[workflows](../.github/workflows/WorkflowsDetails.md) if that should change.

## Related

- [Root README](../README.md) — user-facing feature documentation
- [Harvest details](../src/harvest/HarvestDetails.md) — the systems the roadmap plans
