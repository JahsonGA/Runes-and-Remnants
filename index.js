// index.js
import { HarvestMenu } from "./src/harvest/menu.js";

const MODULE_ID = "runes-and-remnants";

/**
 * World setting: who can open the Harvest Menu
 * - true  => GM + Players can open
 * - false => GM-only can open
 */
Hooks.once("init", () => {
  console.log("Runes & Remnants | init");

  game.settings.register(MODULE_ID, "playersCanOpenHarvest", {
    name: "Allow Players to Open Harvest Menu",
    hint: "If enabled, players can open the Harvest Menu (and it will appear to all active users). If disabled, only GMs can open it.",
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
Hooks.once("ready", () => {
  if (!game.socket) return;
  game.socket.on(`module.${MODULE_ID}`, async (payload) => {
    if (!payload || payload.action !== "openHarvest") return;
    try {
      const doc = payload.tokenUuid ? await fromUuid(payload.tokenUuid) : null;
      // Accept TokenDocument or Token; normalize
      const tokenDoc = doc?.document ?? doc;
      new HarvestMenu(tokenDoc).render(true);
    } catch (err) {
      console.error(`${MODULE_ID} | Failed to open Harvest Menu via socket`, err);
    }
  });
});

/**
 * Add skull button to the Token HUD.
 * Who sees the button depends on the world setting above.
 */
Hooks.on("renderTokenHUD", (hud, html) => {
  const allowPlayers = game.settings.get(MODULE_ID, "playersCanOpenHarvest");

  // Who can open?
  const userCanOpen =
    game.user.isGM ||
    (allowPlayers && (hud.object?.actor?.isOwner || !!game.user?.character));

  if (!userCanOpen) return;

  const title = allowPlayers
    ? "Open Harvest (shows to all)"
    : "Open Harvest (GM-only opener)";

  const $btn = $(`<div class="control-icon harvest-menu" title="${title}">
    <i class="fas fa-skull-crossbones"></i>
  </div>`);

  $btn.on("click", async () => {
    const tokenDoc = hud.object?.document ?? null;

    // Always open locally for the clicker…
    new HarvestMenu(tokenDoc).render(true);

    // …and broadcast to all active users so they see the same window.
    try {
      const tokenUuid = tokenDoc?.uuid ?? null;
      game.socket?.emit(`module.${MODULE_ID}`, {
        action: "openHarvest",
        tokenUuid
      });
    } catch (err) {
      console.error(`${MODULE_ID} | broadcast failed`, err);
    }
  });

  html.find(".col.right").append($btn);
});