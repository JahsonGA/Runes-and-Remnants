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
- Difficulty Class (DC) is computed dynamically:
  - Assessor and Harvester will roll there checks and their combine total will determine how many of the listed items are earns
- Each helper adds a **partial or full proficiency** bonus (capped by creature size).
- Final results categorize as:
  - **Full Success** → Abundant yield  
  - **Success** → Partial yield  
  - **Failure** → No yield  

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
