# Runes and Remnants  
*A Foundry VTT module inspired by Heliana’s Guide to Monster Hunting and the legacy of Ancestral Weapons*

![FoundryVTT](https://img.shields.io/badge/FoundryVTT-Compatible-success?style=flat-square)
![License: MPL-2.0](https://img.shields.io/badge/License-MPL--2.0-green.svg?style=flat-square)
![Auto Release](https://img.shields.io/github/actions/workflow/status/JahsonGA/Runes-and-Remnants/release-on-version-bump.yml?label=Auto%20Release&style=flat-square)
![Static Badge](https://img.shields.io/badge/Development_Stage-In_Progress-red?style=flat-square)

---

## Overview
**Runes and Remnants** introduces a full **monster harvesting** and **upgradable weapon** system for FoundryVTT.  
Game Masters and players can harvest slain creatures for materials using a **streamlined, grim-dark Harvest Menu** that automatically detects CR, type, and available loot from your compendium.

Inspired by *Heliana’s Guide to Monster Hunting and Ancestral Weapons*, this module lays the foundation for a complete Rynok-style monster hunting and weapon-forging experience.

---

## Features
### Harvest Menu
- Right-click a token and select the **cleaver icon** to open the Harvest Menu.
- The slain creature becomes the **target creature**, with its **token art**, **Type**, and **CR** shown automatically.
- Add harvesters from a **custom dropdown panel** listing all player and NPC actors.
  - Uses **token portraits** beside each name for clarity.
  - The **first harvester** is treated as the **leader**.
- Reorder or remove harvesters using **inline control buttons** `[↑] [↓] [✕]`.
- Select materials to harvest from your compendium.
- Automatic **skill checks** and **DC calculation** based on creature type, rarity, and CR.
- Results are broadcast in **chat**, and (optionally) dropped via **Item Piles**.

### GM Controls
- GMs can choose whether **players** can open the Harvest Menu themselves.
- When opened, the menu automatically appears for **all active users**.
- Harvesters list respects GM visibility:
  1. Active PCs (owned by connected players)
  2. Inactive PCs
  3. NPCs on the current scene
  4. Other world actors

---

## Installation
You can always find the latest stable and beta releases here:  
**[Runes and Remnants — GitHub Releases](https://github.com/JahsonGA/Runes-and-Remnants/releases)**

Each release includes a ready-to-install `.zip` package and manifest URL for FoundryVTT.

---

## Usage
1. **Right-click** a creature’s token on the canvas.  
2. Click the **cleaver icon** to open the **Harvest Menu**.  
3. Review the target’s info and available materials.  
4. Select harvesters from the dropdown and arrange their order.  
5. Choose desired loot, then click **Start Harvest**.  
6. Results and rolls are displayed in chat — with optional loot drops via Item Piles.

---

## Permissions
The module includes a world setting:

> **Allow Players to Open Harvest Menu**

- If enabled → both GMs and players can initiate harvesting.  
- If disabled → only the GM can open the Harvest Menu.  
- Regardless, the menu is synchronized to **all active users** for visibility.

---

## Development Roadmap
| Stage | Feature | Status |
|--------|----------|--------|
| Core Framework | Module setup, version automation, CI/CD | ✅ Done |
| Harvest System | UI, dropdown logic, loot + rolls | 🟢 Current |
| Data Packs | Material compendium, rarity, and DC tables | 🔜 Next |
| Ancestral Weapons | Weapon evolution, socketing, crafting UI | ⏳ Planned |
| Integrations | Item Piles, Token HUD enhancements | ⏳ Planned |

## Reloading Development
1. **Keep your dev module active** in Foundry:
   - Open **Configuration → Manage Modules**
   - Ensure **“Runes & Remnants”** is checked ON.

2. **When you edit JS or HTML:**
   - Save the file.
   - Then in Foundry’s dev console (press **F12 → Console tab**), run:
     ```js
     game.modules.get("runes-and-remnants").api?.reload?.() ?? window.location.reload();
     ```
     or simply press **F5** to refresh Foundry.
   - Foundry will reload the module fresh with your latest files.

3. **To re-open the Harvest Menu instantly after reload:**
   ```js
   new game.modules.get("runes-and-remnants").api?.HarvestMenu?.();


---

## License
Licensed under the **Mozilla Public License 2.0 (MPL-2.0)**.

You may use, modify, and distribute this module under the same license.  
If you wish to incorporate *Runes and Remnants* into your own project, live stream, or commercial work, please credit the author and reach out for collaboration or attribution approval.

---

### Author
**JahsonGA**  
[GitHub Repository →](https://github.com/JahsonGA/Runes-and-Remnants)
