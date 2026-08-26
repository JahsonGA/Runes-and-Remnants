// This Source Code Form is subject to the terms of the MPL, v. 2.0

// index.js
import { HarvestMenu } from "./src/harvest/menu.js";
import { RunesHub } from "./src/hub/hub.js";
import { pickExecutorId } from "./src/harvest/logic.js";
import { registerExtraSettings, loadExtraRecipes } from "./src/craft/extras.js";
import { executeCraft, isCraftExecutor } from "./src/craft/execute.js";
import { executeEnchant, isEnchantExecutor } from "./src/enchant/execute.js";
import { registerConfirmSetting } from "./src/ui/confirm.js";

const MODULE_ID = "runes-and-remnants";

Hooks.once("ready", () => console.log("Runes & Remnants ready!"));

/**
 * World setting: who can open the Hub
 * - true  => GM + Players can open
 * - false => GM-only can open
 */
Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "playersCanOpenHarvest", {
    name: "Allow Players to Open the Hub",
    hint: "If enabled, players can open the Runes & Remnants hub (it will appear to all active users). If disabled, only GMs can open it.",
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
 * Third-party crafting content. The module ships SRD-safe names only;
 * anything from a commercial book is read out of the world's own compendium
 * at load. See src/craft/extras.js for why.
 */
Hooks.once("init", () => registerExtraSettings());
Hooks.once("init", () => registerConfirmSetting());
Hooks.once("ready", () => loadExtraRecipes());

/**
 * Register the hub's panels as Handlebars partials so hub.html can swap
 * between them without re-rendering a separate Application per tab.
 */
Hooks.once("init", async () => {
  const base = `modules/${MODULE_ID}/templates/panels`;
  const panels = {
    rnrHarvestPanel:    `${base}/harvest.html`,
    rnrCraftingPanel:   `${base}/crafting.html`,
    rnrEnchantingPanel: `${base}/enchanting.html`,
    rnrCrafterPicker:   `modules/${MODULE_ID}/templates/partials/crafter.html`
  };

  await loadTemplates(Object.values(panels));
  for (const [name, path] of Object.entries(panels)) {
    Handlebars.registerPartial(name, Handlebars.partials[path] ?? (await getTemplate(path)));
  }
});

/** Public API — lets macros open the hub on a given tab. */
Hooks.once("ready", () => {
  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.api = { openHub: (opts) => RunesHub.open(opts), RunesHub, HarvestMenu };
});

/**
 * Socket listener.
 *
 * - `openHarvest`  — broadcast so every active user gets the same window,
 *                    pointing at the same token.
 * - `requestHarvest` — a player asking for a harvest to be run. Only the one
 *                    designated GM acts on it; everyone else ignores it. This
 *                    is what stops every client granting the same loot.
 * - `closeHarvest` — the harvest finished and the corpse is gone; drop any
 *                    menu still pointing at it.
 */
Hooks.once("ready", () => {
  game.socket?.on(`module.${MODULE_ID}`, async (payload) => {
    if (!payload) return;

    if (payload.action === "openHarvest") {
      const token = payload.tokenUuid ? await fromUuid(payload.tokenUuid) : null;
      const tokenDoc = token?.document ?? token ?? null;
      RunesHub.open({ tokenDoc, tab: "harvest" });
      return;
    }

    if (payload.action === "requestEnchant") {
      if (!isEnchantExecutor()) return;
      await executeEnchant(payload);
      return;
    }

    if (payload.action === "requestCraft") {
      // Exactly one GM acts, or every connected GM crafts the same item.
      if (!isCraftExecutor()) return;
      await executeCraft(payload);
      return;
    }

    if (payload.action === "requestHarvest") {
      if (game.user.id !== pickExecutorId(Array.from(game.users ?? []))) return;
      await HarvestMenu.executeHarvest(payload);
      return;
    }

    if (payload.action === "closeHarvest") {
      HarvestMenu.closeAll();
    }
  });
});

/**
 * Add the cleaver button to the Token HUD. It opens the hub on the Harvest
 * tab with that token targeted, so the corpse you clicked is the corpse you
 * carve — crafting and enchanting are then a tab away.
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

  const title = allowPlayers
    ? "Open Runes & Remnants (shows to all)"
    : "Open Runes & Remnants (GM-only opener)";

  const btn = document.createElement("div");
  btn.className = "control-icon harvest-menu";
  btn.title = title;

  const icon = document.createElement("img");
  icon.src = "icons/tools/cooking/knife-cleaver-steel-grey.webp";
  btn.appendChild(icon);

  btn.addEventListener("click", () => {
    const tokenDoc = hud.object?.document ?? null;
    RunesHub.open({ tokenDoc, tab: "harvest" });
    game.socket?.emit(`module.${MODULE_ID}`, { action: "openHarvest", tokenUuid: tokenDoc?.uuid ?? null });
  });

  column.appendChild(btn);
});

/**
 * Scene-controls button, so crafting and enchanting are reachable without a
 * corpse selected.
 *
 * The control structure changed shape in v13 (array of groups -> keyed
 * object), so both are handled and the whole thing is guarded — a failure
 * here must never take the rest of the module down with it.
 */
Hooks.on("getSceneControlButtons", (controls) => {
  try {
    const allowPlayers = game.settings.get(MODULE_ID, "playersCanOpenHarvest");
    if (!game.user.isGM && !allowPlayers) return;

    const tool = {
      name: "rnr-hub",
      title: "Runes & Remnants",
      icon: "fas fa-mortar-pestle",
      button: true,
      visible: true,
      onClick: () => RunesHub.open({ tab: "harvest" }),
      onChange: () => RunesHub.open({ tab: "harvest" })
    };

    // v11/v12: controls is an array of groups with a `tools` array.
    if (Array.isArray(controls)) {
      const tokens = controls.find(c => c.name === "token" || c.layer === "tokens");
      if (tokens?.tools) tokens.tools.push(tool);
      return;
    }

    // v13+: controls is an object keyed by control name, tools keyed by name.
    const tokens = controls?.tokens ?? controls?.token;
    if (tokens?.tools) tokens.tools[tool.name] = { ...tool, order: 99 };
  } catch (err) {
    console.warn(`[${MODULE_ID}] Could not add the scene-controls button:`, err);
  }
});
