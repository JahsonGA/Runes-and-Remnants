// =========================================================
// Runes & Remnants — Harvest Menu
// =========================================================

// Difficulty comes entirely from the flat tier DCs in HARVEST_TABLE plus the
// CR-scaled essence DCs in ESSENCE_TABLE. See docs/ROADMAP.md § 1.2.

import {
  MODULE_ID,
  grantMaterial,
  getHarvestOptions,
  rollAssessment,
  rollCarving,
  buildHarvestList,
  resolveHarvest,
  getEssenceByCR,
  harvestOutcome,
  pickExecutorId,
  computeHelperBonus,
  findCompendiumEntry,
  HARVEST_SKILL_BY_TYPE
} from "./logic.js";

export class HarvestMenu extends Application {
  constructor(initialTokenDoc = null, options = {}) {
    super(options);
    this.targetToken = initialTokenDoc ?? null;
    this.targetActor = this.targetToken?.actor ?? null;

    this.loot = [];
    this._lootLoaded = false;

    // Ordered component names — the "harvest list". Order is the whole point:
    // each entry's Harvest DC is the running total of everything before it.
    // A plain array, not a Set, because a creature can yield duplicates.
    this.harvestList = [];

    // Roles
    this.assessor = null;
    this.harvester = null;
    this.helpers = [];
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "rnr-harvest-menu",
      title: "Harvest Materials",
      template: "modules/runes-and-remnants/templates/harvest-dialog.html",
      width: 700,
      height: "auto",
      classes: ["rnr-harvest", "grimdark"]
    });
  }

  // ---------------------- Data Loading ----------------------

  async _ensureLootIndex() {
    if (this._lootLoaded) return;

    const pack = game.packs.get("runes-and-remnants.harvest-items");
    if (!pack) return;
    const idx = await pack.getIndex();
    // Full compendium index, kept only to resolve item names to documents.
    // What the player actually sees is built by _buildComponentPool().
    this.loot = idx.contents ?? idx;

    this._lootLoaded = true;
  }

  /**
   * The pool of components this creature can yield, grouped by component DC.
   * These are per-component costs, not thresholds — actual difficulty is the
   * running total built in the harvest list.
   */
  _buildComponentPool() {
    if (!this.targetActor) return { tiers: [], essence: null };

    const { type, cr } = this._actorSummary(this.targetActor);
    const typeKey = String(type).toLowerCase();
    const countTaken = name => this.harvestList.filter(n => n === name).length;

    const tiers = getHarvestOptions(type).map(tier => ({
      dc: tier.dc,
      items: tier.items.map(name => ({
        name,
        taken: countTaken(name),
        missing: !findCompendiumEntry(this.loot, name, typeKey)
      }))
    }));

    // Essence is appended to every creature's table and priced by CR.
    const essence = getEssenceByCR(Number(cr) || 0);
    return {
      tiers,
      essence: { dc: essence.dc, name: essence.name, taken: countTaken(essence.name) }
    };
  }

  _actorSummary(actor) {
    const type = actor?.system?.details?.type?.value ?? actor?.system?.details?.type ?? "Unknown";
    const cr = actor?.system?.details?.cr ?? actor?.system?.details?.challenge ?? "—";
    return { type, cr };
  }

  _getPortrait(actor) {
    if (!actor) return "icons/svg/mystery-man.svg";
    return actor.img || actor.prototypeToken?.texture?.src || "icons/svg/mystery-man.svg";
  }

  _skillKeyForType(type) {
    const nameToKey = { Arcana: "arc", Survival: "sur", Religion: "rel", Investigation: "inv", Medicine: "med", Nature: "nat" };
    const skillName = HARVEST_SKILL_BY_TYPE[String(type).toLowerCase()] ?? "Survival";
    return { skillName, skillKey: nameToKey[skillName] ?? "sur" };
  }

  _getAvailableActors() {
    const allActors = Array.from(game.actors.values());
    const activeUsers = game.users.filter(u => u.active);
    const activeUserIds = new Set(activeUsers.map(u => u.id));

    const sceneActorIds = new Set(
      (canvas?.tokens?.placeables ?? [])
        .map(t => t.actor?.id)
        .filter(Boolean)
    );

    const weighted = allActors.map(a => {
      const isPC = a.type === "character";
      const owners = game.users.filter(u => a.testUserPermission(u, "OWNER"));
      const activeOwners = owners.filter(u => activeUserIds.has(u.id));

      let priority = 3;
      if (isPC && activeOwners.length) priority = 1;
      else if (sceneActorIds.has(a.id)) priority = 2;

      return {
        id: a.id,
        name: a.name,
        img: this._getPortrait(a),
        priority
      };
    });

    weighted.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
    return weighted;
  }

  // ---------------------- Data for Template ----------------------

  async getData() {
    await this._ensureLootIndex();

    const targetName = this.targetActor?.name ?? "Unknown Target";
    const targetImg = this._getPortrait(this.targetActor);
    const { type, cr } = this._actorSummary(this.targetActor);
    const sizeKey = this.targetActor?.system?.traits?.size ?? "med";

    const { skillName, skillKey } = this._skillKeyForType(type);
    const { total: helperBonus, cap: helperCap } = computeHelperBonus(this.helpers, skillKey, sizeKey);
    this._helperCap = helperCap;

    const helperBonusClass =
      helperBonus <= 0 ? "none" :
      helperBonus <= 3 ? "low" :
      helperBonus <= 6 ? "medium" : "high";

    const sameActor = !!(this.assessor?.actorId && this.harvester?.actorId &&
                         this.assessor.actorId === this.harvester.actorId);

    const availableActors = this._getAvailableActors();
    const takenHelperIds = new Set(this.helpers.map(h => h.actorId));
    const assessorId  = this.assessor?.actorId  ?? null;
    const harvesterId = this.harvester?.actorId ?? null;

    const availableForAssessor  = availableActors.filter(a => !takenHelperIds.has(a.id));
    const availableForHarvester = availableActors.filter(a => !takenHelperIds.has(a.id));
    const availableHelpers      = availableActors.filter(a => a.id !== assessorId && a.id !== harvesterId && !takenHelperIds.has(a.id));


    const { tiers: componentTiers, essence } = this._buildComponentPool();

    // The ordered list, with each entry's running Harvest DC.
    const harvestList = buildHarvestList(this.harvestList, type, Number(cr) || 0);
    const lastEntry = harvestList[harvestList.length - 1];

    return {
      hasTarget: !!this.targetActor,
      targetName, targetImg, type, cr, sizeKey,
      componentTiers,
      essence,
      hasComponents: componentTiers.some(t => t.items.length > 0),
      harvestList,
      hasHarvestList: harvestList.length > 0,
      finalDC: lastEntry?.harvestDC ?? 0,
      assessor: this.assessor,
      harvester: this.harvester,
      helpers: this.helpers,
      helperBonus, helperBonusClass, helperCap,
      availableForAssessor, availableForHarvester, availableHelpers,
      sameActor
    };
  }

  // ---------------------- UI Listeners ----------------------

  activateListeners(html) {
  super.activateListeners(html);

  // --- Assessor Selection ---
  html.on("click", "[data-action='set-assessor']", ev => {
    const el = ev.currentTarget;
    const actorId = el.dataset.actorId;

    // Allow same actor to be harvester (for disadvantage case)
    this.assessor = { actorId, name: el.dataset.actorName, img: el.dataset.actorImg };

    // Remove from helpers only
    this.helpers = this.helpers.filter(h => h.actorId !== actorId);
    this.render(true);
  });

  html.on("click", "[data-action='remove-assessor']", () => {
    this.assessor = null;
    this.render(true);
  });

  // --- Harvester Selection ---
  html.on("click", "[data-action='set-harvester']", ev => {
    const el = ev.currentTarget;
    const actorId = el.dataset.actorId;

    // Allow same actor to be assessor (for disadvantage case)
    this.harvester = { actorId, name: el.dataset.actorName, img: el.dataset.actorImg };

    // Remove from helpers only
    this.helpers = this.helpers.filter(h => h.actorId !== actorId);
    this.render(true);
  });

  html.on("click", "[data-action='remove-harvester']", () => {
    this.harvester = null;
    this.render(true);
  });

  // --- Helper Add/Remove ---
  html.on("click", "[data-action='add-helper']", ev => {
    const el = ev.currentTarget;
    const actorId = el.dataset.actorId;

    // Prevent using same actor if they’re already assessor or harvester
    if (this.assessor?.actorId === actorId || this.harvester?.actorId === actorId)
      return ui.notifications.warn("That actor already has a role.");
    if (this.helpers.some(h => h.actorId === actorId)) return;

    const { type } = this._actorSummary(this.targetActor);
    const sizeKey = this.targetActor?.system?.traits?.size ?? "med";
    const { skillKey } = this._skillKeyForType(type);
    const { cap } = computeHelperBonus([], skillKey, sizeKey);

    if (this.helpers.length >= cap)
      return ui.notifications.warn(`You cannot assign more than ${cap} helpers for a ${sizeKey} creature.`);

    this.helpers.push({ actorId, name: el.dataset.actorName, img: el.dataset.actorImg });
    this.render(true);
  });

  html.on("click", "[data-action='remove-helper']", ev => {
    const li = ev.currentTarget.closest("li[data-index]");
    const i = Number(li.dataset.index);
    if (Number.isInteger(i)) this.helpers.splice(i, 1);
    this.render(true);
  });

  // --- Harvest List: add a component ---
  // Appended, never sorted: the order the harvesters pick IS the order the
  // cumulative Harvest DCs are built from. Duplicates are allowed because a
  // creature can yield more than one of the same part.
  html.on("click", "[data-action='add-component']", ev => {
    this.harvestList.push(ev.currentTarget.dataset.name);
    this.render(true);
  });

  html.on("click", "[data-action='remove-component']", ev => {
    const i = Number(ev.currentTarget.closest("[data-index]")?.dataset.index);
    if (Number.isInteger(i)) this.harvestList.splice(i, 1);
    this.render(true);
  });

  // --- Harvest List: reorder ---
  html.on("click", "[data-action='move-up']", ev => {
    const i = Number(ev.currentTarget.closest("[data-index]")?.dataset.index);
    if (i > 0) {
      [this.harvestList[i - 1], this.harvestList[i]] = [this.harvestList[i], this.harvestList[i - 1]];
      this.render(true);
    }
  });

  html.on("click", "[data-action='move-down']", ev => {
    const i = Number(ev.currentTarget.closest("[data-index]")?.dataset.index);
    if (Number.isInteger(i) && i < this.harvestList.length - 1) {
      [this.harvestList[i], this.harvestList[i + 1]] = [this.harvestList[i + 1], this.harvestList[i]];
      this.render(true);
    }
  });

  html.on("click", "[data-action='clear-list']", () => {
    this.harvestList = [];
    this.render(true);
  });

  // --- Begin Harvest ---
  html.on("click", "[data-action='start-harvest']", async () => this._startHarvest());
}

  // ---------------------- Harvest Request ----------------------

  /**
   * Validates locally, then hands the harvest to the one client authorised to
   * run it. The menu is open on every connected client, so executing here
   * would let each of them grant the same loot again.
   */
  async _startHarvest() {
    if (this._submitting) return;

    if (!this.targetActor)
      return ui.notifications.warn("No target creature selected.");

    if (!this.assessor || !this.harvester)
      return ui.notifications.warn("Assign both an Assessor and a Harvester first.");

    if (!this.targetToken?.uuid)
      return ui.notifications.error("This target has no token on the canvas to harvest.");

    if (!this.harvestList.length)
      return ui.notifications.warn("Add at least one component to the harvest list first.");

    const executorId = pickExecutorId(Array.from(game.users ?? []));
    if (!executorId)
      return ui.notifications.error("A GM must be connected to run a harvest.");

    const payload = {
      action: "requestHarvest",
      requesterId: game.user.id,
      tokenUuid: this.targetToken.uuid,
      assessor: { actorId: this.assessor.actorId, name: this.assessor.name },
      harvester: { actorId: this.harvester.actorId, name: this.harvester.name },
      helpers: (this.helpers ?? []).map(h => ({ actorId: h.actorId, name: h.name })),
      harvestList: [...this.harvestList]
    };

    // Latch immediately — a double-click would otherwise send twice.
    this._submitting = true;

    try {
      if (game.user.id === executorId) {
        await HarvestMenu.executeHarvest(payload);
      } else {
        game.socket?.emit(`module.${MODULE_ID}`, payload);
        ui.notifications.info("Harvest sent to the GM.");
      }
      this.close();
    } finally {
      this._submitting = false;
    }
  }

  // ---------------------- Harvest Execution ----------------------

  /**
   * Runs a harvest to completion. Static and payload-driven because it runs on
   * the designated GM's client, which may never have had the menu open and so
   * has none of the instance state.
   *
   * Guarded against concurrent execution per target token: two players can
   * submit the same corpse before the first request finishes.
   */
  static async executeHarvest(payload = {}) {
    const { tokenUuid, harvestList = [] } = payload;
    if (!tokenUuid) return;

    if (HarvestMenu._inFlight.has(tokenUuid)) {
      console.warn(`[${MODULE_ID}] Harvest already running for ${tokenUuid} — ignoring duplicate request.`);
      return;
    }
    HarvestMenu._inFlight.add(tokenUuid);

    try {
      await HarvestMenu._runHarvest(payload, harvestList);
    } catch (err) {
      console.error(`[${MODULE_ID}] Harvest failed:`, err);
      ui.notifications.error("The harvest failed — see the console for details.");
    } finally {
      HarvestMenu._inFlight.delete(tokenUuid);
    }
  }

  static async _runHarvest(payload, orderedNames) {
    const targetToken = await fromUuid(payload.tokenUuid);
    const targetActor = targetToken?.actor;
    if (!targetActor)
      return ui.notifications.error("The harvested creature could not be found.");

    const helpers = payload.helpers ?? [];
    const type = targetActor?.system?.details?.type?.value ?? targetActor?.system?.details?.type ?? "Unknown";
    const cr   = targetActor?.system?.details?.cr ?? targetActor?.system?.details?.challenge ?? 0;
    const sizeKey = targetActor?.system?.traits?.size ?? "med";

    const pack = game.packs.get("runes-and-remnants.harvest-items");
    if (!pack)
      return ui.notifications.error("Harvest Items compendium not found.");

    const idx = await pack.getIndex();
    const loot = idx.contents ?? idx;

    const assessorActor = game.actors.get(payload.assessor?.actorId);
    const harvesterActor = game.actors.get(payload.harvester?.actorId);
    if (!assessorActor || !harvesterActor)
      return ui.notifications.error("One or more assigned actors could not be found.");

    // This runs with GM permission, so a request from a player must be checked:
    // otherwise anyone could ask the GM to grant loot to an actor they do not
    // own. GMs may harvest to any actor.
    const requester = game.users.get(payload.requesterId);
    if (requester && !requester.isGM && !harvesterActor.testUserPermission(requester, "OWNER")) {
      console.warn(`[${MODULE_ID}] ${requester.name} requested a harvest to an actor they do not own — rejected.`);
      return ui.notifications.warn(`${requester.name} cannot harvest to ${harvesterActor.name}.`);
    }

    // --- Handle same-actor disadvantage ---
    const sameActor = assessorActor.id === harvesterActor.id;
    if (sameActor)
      ui.notifications.warn(`${assessorActor.name} is performing both roles — both rolls are made at disadvantage.`);

    // --- Perform Rolls ---
    const assess = await rollAssessment(assessorActor, type, { disadvantage: sameActor });
    const carve  = await rollCarving(harvesterActor, type, { disadvantage: sameActor });

    // --- Totals ---
    const harvestTotal = assess.total + carve.total;
    const skillName = HARVEST_SKILL_BY_TYPE[String(type).toLowerCase()] ?? "Survival";
    const skillKey = skillName.toLowerCase().slice(0, 3);

    // --- Helper Bonus ---
    const { total: helperBonus, breakdown: helperBreakdown } =
      computeHelperBonus(helpers, skillKey, sizeKey);

    const totalRoll = harvestTotal + helperBonus;

    // --- Resolve the harvest list against the check ---
    // Each entry's Harvest DC is the running total of every component before
    // it, so the party extracts the leading run of their chosen order and
    // loses everything from the first component the corpse beat them on.
    const typeKey = String(type || "other").toLowerCase();
    const harvestList = buildHarvestList(orderedNames, typeKey, Number(cr) || 0);
    const { awarded, missed } = resolveHarvest(harvestList, totalRoll);

    const result = harvestOutcome(awarded.length, harvestList.length);
    const materials = awarded.map(e => e.name);

    // --- Drop or Grant Materials ---
    const dropPoint = targetToken?.object?.center ?? null;
    for (const itemName of materials) {
      const indexEntry = findCompendiumEntry(loot, itemName, typeKey);
      if (!indexEntry) {
        console.warn(`[${MODULE_ID}] No compendium entry for "${itemName}" — skipping.`);
        continue;
      }
      try {
        const itemDoc = await pack.getDocument(indexEntry._id);
        await grantMaterial({ item: itemDoc, qty: 1, toActor: harvesterActor, dropAt: dropPoint });
      } catch (err) {
        console.warn(`[${MODULE_ID}] Failed to grant "${itemName}":`, err);
      }
    }

    // --- Build Helper Breakdown ---
    const helperList = helperBreakdown.length
      ? helperBreakdown.map(h =>
          `<li>${h.name}: +${h.contribution} (${h.proficient ? "proficient" : "half"})</li>`
        ).join("")
      : "<li>None</li>";

    // --- Build Chat Output ---
    const disadvantageNote = sameActor
      ? `<p class="warning">⚠️ ${assessorActor.name} performed both roles — both rolls at disadvantage.</p>`
      : "";

    // The harvest list in order, showing each running Harvest DC and where
    // the check ran out. This is the part that makes the ordering legible.
    const listRows = harvestList.map(e => {
      const got = !e.unknown && totalRoll >= e.harvestDC;
      const mark = e.unknown ? "⚠" : (got ? "✔" : "✘");
      const style = e.unknown ? "color:#a08a6a;"
                  : got ? "color:#80ff80;" : "color:#ff8080;opacity:.75;";
      const dc = e.unknown ? "—" : `DC ${e.harvestDC}`;
      const cost = e.unknown ? "not on this creature's table" : `+${e.componentDC}`;
      return `<tr style="${style}">
        <td>${e.order}.</td><td>${mark} ${e.name}</td>
        <td style="text-align:right;">${cost}</td>
        <td style="text-align:right;"><b>${dc}</b></td>
      </tr>`;
    }).join("");

    const chatContent = `
    <div class="rnr-harvest-summary">
      <hr>
      <h3><b>Harvest Summary</b></h3>
      ${disadvantageNote}
      <p><b>Target:</b> ${targetActor.name} (CR ${cr}, ${type})</p>
      <ul>
        <li><b>Assessment:</b> ${assessorActor.name} — ${skillName} (INT) — rolled ${assess.total}</li>
        <li><b>Carving:</b> ${harvesterActor.name} — ${skillName} (DEX) — rolled ${carve.total}</li>
        <li><b>Helpers:</b><ul>${helperList}</ul></li>
      </ul>
      <p><b>Harvesting check:</b> ${assess.total} + ${carve.total} + ${helperBonus} =
        <b style="color:#8ef;">${totalRoll}</b></p>
      <table style="width:100%;font-size:0.9em;">
        <tr><th colspan="2" style="text-align:left;">Harvest List</th>
            <th style="text-align:right;">Cost</th>
            <th style="text-align:right;">Harvest DC</th></tr>
        ${listRows}
      </table>
      <p><b>Outcome:</b> <span style="color:${result.includes('success') ? '#80ff80' : '#ff8080'};">${result}</span>
        — ${awarded.length} of ${harvestList.length} recovered</p>
      <p><b>Recovered:</b> ${materials.join(', ') || 'Nothing recovered'}</p>
    </div>
    `;

    // --- Create Final Chat Message ---
    console.log(`[${MODULE_ID}] Harvest summary posted`, { totalRoll, awarded: awarded.length, missed: missed.length, result });

    // Wait briefly so roll cards appear first
    await new Promise(r => setTimeout(r, 500));

    await ChatMessage.create({
      speaker: { alias: "Runes & Remnants" },
      content: chatContent
    });

    // Allow UI to update before token deletion
    await new Promise(r => setTimeout(r, 200));

    // targetToken is a TokenDocument (fromUuid returns the document) — it has
    // no .document. This always runs on a GM client, and only deletes the
    // corpse if something was actually recovered, so a total failure leaves it
    // in place for another attempt.
    if (materials.length) {
      try {
        await targetToken.delete();
      } catch (err) {
        console.warn(`[${MODULE_ID}] Could not delete harvested token:`, err);
      }
    }

    // The corpse is gone, so every client's copy of the menu now points at a
    // token that no longer exists. Close them all rather than leaving a stale
    // window someone can submit again.
    HarvestMenu.closeAll();
    game.socket?.emit(`module.${MODULE_ID}`, { action: "closeHarvest" });
  }

  /** Closes every Harvest Menu open on this client. */
  static closeAll() {
    for (const app of Object.values(ui.windows ?? {})) {
      if (app instanceof HarvestMenu) app.close();
    }
  }
}

/** Target tokens with a harvest currently executing on this client. */
HarvestMenu._inFlight = new Set();