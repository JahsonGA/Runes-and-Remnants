// This Source Code Form is subject to the terms of the MPL, v. 2.0

// index.js
import { HarvestMenu } from "./scripts/src/harvest/menu.js";

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

/**
 * Socket listener: when anyone opens the Harvest Menu, broadcast so
 * all active users get the same window (pointing at the same token).
 */
//! likely cause of the contenst repopulating issue
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
 */
Hooks.on("renderTokenHUD", (hud, html) => {
  const allowPlayers = game.settings.get(MODULE_ID, "playersCanOpenHarvest");
  const canOpen = game.user.isGM || (allowPlayers && (hud.object?.actor?.isOwner || !!game.user?.character));
  if (!canOpen) return;

  const title = allowPlayers ? "Open Harvest (shows to all)" : "Open Harvest (GM-only opener)";

  // Use your cleaver image as the icon
  const $btn = $(`
    <div class="control-icon harvest-menu" title="${title}">
      <img src="icons/tools/cooking/knife-cleaver-steel-grey.webp"/>
    </div>
  `);

  $btn.on("click", async () => {
    const tokenDoc = hud.object?.document ?? null;
    new HarvestMenu(tokenDoc).render(true);
    game.socket?.emit(`module.${MODULE_ID}`, { action: "openHarvest", tokenUuid: tokenDoc?.uuid ?? null });
  });

  html.find(".col.right").append($btn);
});