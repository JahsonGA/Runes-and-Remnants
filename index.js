// This Source Code Form is subject to the terms of the MPL, v. 2.0

// index.js
import { HarvestMenu } from "./src/harvest/menu.js";

const MODULE_ID = "runes-and-remnants";

Hooks.once("ready", () => console.log("Runes & Remnants ready!"));

/**
 * World setting: who can open the Harvest Menu
 * - true  => GM + Players can open
 * - false => GM-only can open
 */
Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "playersCanOpenHarvest", {
    name: "Allow Players to Open Harvest Menu",
    hint: "If enabled, players can open the Harvest Menu (it will appear to all active users). If disabled, only GMs can open it.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
});

Hooks.once("init", () => {
  Handlebars.registerHelper("eq", (a, b) => a === b);
});


/**
 * Socket listener: when anyone opens the Harvest Menu, broadcast so
 * all active users get the same window (pointing at the same token).
 */
Hooks.once("ready", () => {
  game.socket?.on(`module.${MODULE_ID}`, async (payload) => {
    if (!payload || payload.action !== "openHarvest") return;
    // Optional pre-target
    const token = payload.tokenUuid ? await fromUuid(payload.tokenUuid) : null;
    const tokenDoc = token?.document ?? token ?? null;
    new HarvestMenu(tokenDoc).render(true);
  });
});

/**
 * Add cleaver button to the Token HUD.
 * Who sees the button depends on the world setting above.
 *
 * Foundry v13 migrated TokenHUD to ApplicationV2, which passes a native
 * HTMLElement to render hooks; v11/v12 pass jQuery. Normalising here — and
 * building the button with the DOM API instead of jQuery — keeps a single
 * build working across v11 through v14.
 */
Hooks.on("renderTokenHUD", (hud, html) => {
  const allowPlayers = game.settings.get(MODULE_ID, "playersCanOpenHarvest");
  const canOpen = game.user.isGM || (allowPlayers && (hud.object?.actor?.isOwner || !!game.user?.character));
  if (!canOpen) return;

  const root = html instanceof HTMLElement ? html : html?.[0];
  const column = root?.querySelector(".col.right");
  if (!column) return;

  const title = allowPlayers ? "Open Harvest (shows to all)" : "Open Harvest (GM-only opener)";

  const btn = document.createElement("div");
  btn.className = "control-icon harvest-menu";
  btn.title = title;

  const icon = document.createElement("img");
  icon.src = "icons/tools/cooking/knife-cleaver-steel-grey.webp";
  btn.appendChild(icon);

  btn.addEventListener("click", () => {
    const tokenDoc = hud.object?.document ?? null;
    new HarvestMenu(tokenDoc).render(true);
    game.socket?.emit(`module.${MODULE_ID}`, { action: "openHarvest", tokenUuid: tokenDoc?.uuid ?? null });
  });

  column.appendChild(btn);
});