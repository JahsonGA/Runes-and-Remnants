# Runes and Remnants  
*A Foundry VTT module inspired by Heliana’s Guide to Monster Hunting and the legacy of Ancestral Weapons.*

![FoundryVTT](https://img.shields.io/badge/FoundryVTT-Compatible-success?style=flat-square)
![License: MPL-2.0](https://img.shields.io/badge/License-MPL--2.0-green.svg?style=flat-square)
![Auto Release](https://img.shields.io/github/actions/workflow/status/JahsonGA/Runes-and-Remnants/release-on-version-bump.yml?label=Auto%20Release&style=flat-square)
![Static Badge](https://img.shields.io/badge/Development_Stage-Beta_(v1.0.8a39)--Active-orange?style=flat-square)

---

## Overview
**Runes and Remnants** introduces a modular **monster harvesting** and **upgradable weapon** system for Foundry VTT.  
Game Masters and players can harvest slain creatures using a **streamlined, grimdark Harvest Menu** that automates rolls, helper bonuses, and loot generation.

Inspired by *Heliana’s Guide to Monster Hunting* and *Ancestral Weapons*, this module forms the foundation of a complete **Rynok-style monster hunting and forging system**, designed for flexibility and future expansions.

---

## Harvest Menu
### Core Features
- Right-click a slain creature’s **token** → select the **cleaver icon** to open the **Harvest Menu**.
- Automatically detects:
  - Target creature’s **name**, **CR**, **Type**, and **token portrait**.
  - Corresponding **loot and materials** from the `runes-and-remnants.harvest-items` compendium.
- Assign actor roles dynamically:
  - **Assessor** — evaluates the creature (Int-based check).
  - **Harvester** — extracts components (Dex-based check).
  - **Helpers** — assist with harvesting (bonus based on proficiency).
- Helpers have a **size-based limit** (e.g., 2 for Medium, 4 for Large, etc.).
- Results broadcast to **chat** with rolls, bonuses, and total outcomes.
- Optional **Item Piles integration**: drop harvested items directly onto the map.

### Role Rules & Conditions
- The same actor **can** be both Assessor and Harvester.  
  → Doing so incurs **disadvantage** on both rolls, automatically applied.
- A warning appears in the UI and chat log if this occurs.
- An actor assigned as either Assessor or Harvester **cannot also be a Helper**.
- Each role includes **inline portrait icons** and **remove buttons** for clarity.

---

## Automation Logic
### Behind the Scenes
- Rolls use the appropriate 5e skill based on **creature type**:
  - e.g., `Survival` for Beasts, `Arcana` for Aberrations, `Medicine` for Undead, etc.
- The Assessor and Harvester each roll, and their **combined total** (plus helper
  bonus) determines how much of the creature's material table is unlocked:

  ```
  assessment (1d20 + INT + prof) + carving (1d20 + DEX + prof) + helper bonus
  ```

- Materials are gated by **flat DCs — 20 / 30 / 40** — defined per creature type
  in `src/data/harvest-table.js`. Tiers are additive: meeting DC 30 also grants
  the DC 20 materials.
- **Essence** is gated separately by a **CR-scaled DC** (25 → 50) from
  `ESSENCE_TABLE`. This is where creature difficulty is expressed; the material
  tiers themselves are deliberately flat.
- Each helper adds a **partial or full proficiency** bonus (capped by creature size).
- Outcome is derived from how many tiers were unlocked:
  - **Critical Success** → every tier unlocked
  - **Success** → most tiers unlocked
  - **Partial** → first tier only
  - **Failure** → nothing unlocked

> Only materials the target creature can actually yield are listed in the menu,
> grouped by the DC required to reach them. Leave everything unticked to take
> whatever the roll unlocks, or tick specific materials to take only those.

---

## Developer Controls
### GM Settings
> **Allow Players to Open Harvest Menu**

- Enabled — Players and GMs can open the Harvest Menu.  
- Disabled — Only GMs can initiate harvests.  
- Regardless, the menu updates **in real-time** for all connected users.

### Roll Integration
- Uses Foundry’s built-in 5e skill system (no custom roll formulas required).
- Rolls automatically post results via `ChatMessage.create()`.
- Optional API hooks:
  ```js
  game.modules.get("runes-and-remnants").api.rollAssessment(actor, type);
  game.modules.get("runes-and-remnants").api.rollCarving(actor, type, { disadvantage: true });
  ```

---

## Documentation Map

Detailed per-folder documentation. Each `*Details.md` covers every file in its
folder; `*Breakdown.md` files are deep dives into intricate logic.

| Area | Document | Covers |
|---|---|---|
| **Source root** | [`src/SrcDetails.md`](src/SrcDetails.md) | Module structure, logic/Foundry split, data flow |
| **Harvest system** | [`src/harvest/HarvestDetails.md`](src/harvest/HarvestDetails.md) | Full export reference for `logic.js` and `menu.js` |
| ↳ *deep dive* | [`src/harvest/LogicBreakdown.md`](src/harvest/LogicBreakdown.md) | The DC model, unlock resolution, essence gating |
| ↳ *deep dive* | [`src/harvest/MenuBreakdown.md`](src/harvest/MenuBreakdown.md) | `_startHarvest()` step by step, render behaviour |
| **Game data** | [`src/data/DataDetails.md`](src/data/DataDetails.md) | `HARVEST_TABLE` contract and how to extend it |
| **Compendium** | [`packs/PacksDetails.md`](packs/PacksDetails.md) | Pack invariants and the Foundry→repo authoring workflow |
| **Templates** | [`templates/TemplatesDetails.md`](templates/TemplatesDetails.md) | Handlebars context and `data-action` conventions |
| **Styles** | [`styles/StylesDetails.md`](styles/StylesDetails.md) | Theme tokens, class conventions, animations |
| **Tests** | [`tests/TestDetails.md`](tests/TestDetails.md) | What each suite protects and what isn't covered |
| **CI/CD** | [`.github/workflows/WorkflowsDetails.md`](.github/workflows/WorkflowsDetails.md) | Branch model and version-triggered releases |
| **Planning** | [`docs/DocsDetails.md`](docs/DocsDetails.md) → [`docs/ROADMAP.md`](docs/ROADMAP.md) | Phased plan and design rationale |

### Root files

| File | Purpose |
|---|---|
| `index.js` | Foundry entry point — registers the `playersCanOpenHarvest` setting, the `eq` Handlebars helper, the socket listener, and the Token HUD cleaver button |
| `module.json` | Manifest — id `runes-and-remnants`, dnd5e, Foundry v11–v12, declares the `harvest-items` pack. **Bumping `version` here triggers a release** |
| `package.json` | Dev tooling only (`vitest`, `glob`); `npm test` and `npm run check:assets` |

### Where to start

- **Changing harvest difficulty?** Read [ROADMAP § 1.2](docs/ROADMAP.md) first —
  the flat-DC design is deliberate and easy to break by "fixing".
- **Adding materials?** [`src/data/DataDetails.md`](src/data/DataDetails.md) and
  [`packs/PacksDetails.md`](packs/PacksDetails.md) — item *names* are the join key.
- **Touching the harvest flow?** [`MenuBreakdown.md`](src/harvest/MenuBreakdown.md).
