/*import {
  MODULE_ID,
  computeHarvestDC,
  outcome,
  bestSkillFor,
  rollSkillCheck,
  grantMaterial
} from "./logic.js";*/

export class HarvestMenu extends Application {
  constructor(initialTokenDoc = null, options = {}) {
    super(options);
    this.targetToken = initialTokenDoc ?? null;
    this.targetActor = this.targetToken?.actor ?? null;

    this.harvesters = [];
    this.loot = [];
    this._lootLoaded = false;
    this.selectedLoot = new Set();
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

  /* ========================= DATA LOAD ========================= */
  async _ensureLootIndex() {
    if (this._lootLoaded) return;
    const pack = game.packs.get("runes-and-remnants.harvest-items");
    if (!pack) return;
    const idx = await pack.getIndex();
    this.loot = idx.contents ?? idx;
    this._lootLoaded = true;
  }

  _actorSummary(actor) {
    const type =
      actor?.system?.details?.type?.value ??
      actor?.system?.details?.type ??
      "Unknown";
    const cr = actor?.system?.details?.cr ??
      actor?.system?.details?.challenge ?? "—";
    return { type, cr };
  }

  /* ========================= PORTRAIT FIX ========================= */
  _getPortrait(actor) {
    try {
      if (!actor) return "icons/svg/mystery-man.svg";
      const actorData = actor.toObject?.() ?? actor;
      const actorImg = actorData.img || actor.img;
      const protoImg = actor.prototypeToken?.texture?.src;

      // Try fallback from item if both missing
      let itemImg = null;
      if (actor.items?.size > 0) {
        const firstItem = actor.items.find(i => i.img && i.img !== "icons/svg/mystery-man.svg");
        if (firstItem) itemImg = firstItem.img;
      }

      const resolved =
        protoImg && protoImg !== "icons/svg/mystery-man.svg" ? protoImg :
        actorImg && actorImg !== "icons/svg/mystery-man.svg" ? actorImg :
        itemImg && itemImg !== "icons/svg/mystery-man.svg" ? itemImg :
        "icons/svg/mystery-man.svg";

      return resolved;
    } catch (err) {
      console.warn(`[${MODULE_ID}] Portrait resolution failed:`, err);
      return "icons/svg/mystery-man.svg";
    }
  }

  _getTargetPortrait() {
    return this._getPortrait(this.targetActor);
  }

  /* ========================= DATA RENDER ========================= */
  async getData() {
  await this._ensureLootIndex();

  const targetName = this.targetActor?.name ?? "Unknown Target";
  const targetImg = this._getTargetPortrait();
  const { type, cr } = this._actorSummary(this.targetActor);

  const availableHarvesters = this._getAvailableHarvesters();

  return {
    hasTarget: !!this.targetActor,
    targetName,
    targetImg,
    type,
    cr,
    loot: this.loot,
    selectedLoot: Array.from(this.selectedLoot),
    harvesters: this.harvesters,
    availableHarvesters
  };
}


  /* ========================= HARVESTER DROPDOWN LOGIC ========================= */
  _getAvailableHarvesters() {
    const activeUserIds = game.users.filter(u => u.active).map(u => u.id);
    const sceneTokenIds = (canvas?.tokens?.placeables ?? []).map(t => t.actor?.id);
    const allActors = Array.from(game.actors.values());

    const weighted = allActors.map(a => {
      const isPC = a.type === "character";
      const owners = game.users.filter(u => a.testUserPermission(u, "OWNER"));
      const activeOwners = owners.filter(u => activeUserIds.includes(u.id));
      let weight = 99;

      if (isPC && activeOwners.length) weight = 1;
      else if (isPC && owners.length) weight = 2;
      else if (sceneTokenIds.includes(a.id)) weight = 3;
      else weight = 4;

      return {
        actor: a,
        ownerNames: owners.map(u => u.name).join(", ") || "—",
        weight
      };
    });

    weighted.sort((a, b) => a.weight - b.weight || a.actor.name.localeCompare(b.actor.name));

    const takenIds = new Set(this.harvesters.map(h => h.actorId));

    return weighted
      .filter(w => !takenIds.has(w.actor.id))
      .map(w => ({
        id: w.actor.id,
        name: w.actor.name,
        img: this._getPortrait(w.actor),
        owners: w.ownerNames
      }));
  }

  /* ========================= EVENT HANDLERS ========================= */
  activateListeners(html) {
    super.activateListeners(html);

    // enable drop region
      /*this._dragDrop = [{
        dragSelector: null,
        dropSelector: "section.rnr-columns",
        callbacks: { drop: this._onDrop.bind(this) }
      }];
      this._dragDrop.bind(html[0]);*/

    // Add new harvester
    html.on("click", "[data-action='add-harvester']", ev => {
      const el = ev.currentTarget;
      const id = el.dataset.actorId;
      const name = el.dataset.actorName;
      const img = el.dataset.actorImg;
      const owners = el.dataset.actorOwners;

      if (this.harvesters.some(h => h.actorId === id)) return;
      this.harvesters.push({ actorId: id, name, img, owner: owners });
      this.render(true);
    });

    // Drag and Drop logic
    /*html.on("dragenter", "section.rnr-columns", ev => ev.currentTarget.classList.add("drag-hover"));
    html.on("dragleave", "section.rnr-columns", ev => ev.currentTarget.classList.remove("drag-hover"));
    html.on("drop", "section.rnr-columns", ev => ev.currentTarget.classList.remove("drag-hover"));*/


    // Move Up / Down / Remove
    html.on("click", "[data-action='move-up'], [data-action='move-down'], [data-action='remove-harvester']", ev => {
      const li = ev.currentTarget.closest("li[data-index]");
      const i = Number(li.dataset.index);
      if (!Number.isInteger(i)) return;

      const action = ev.currentTarget.dataset.action;
      if (action === "remove-harvester") {
        this.harvesters.splice(i, 1);
      } else {
        const j = i + (action === "move-up" ? -1 : 1);
        if (j >= 0 && j < this.harvesters.length) {
          [this.harvesters[i], this.harvesters[j]] = [this.harvesters[j], this.harvesters[i]];
        }
      }
      this.render(true);
    });

    // Loot selection
    html.on("change", "input[name='lootChoice']", ev => {
      const id = ev.currentTarget.value;
      ev.currentTarget.checked ? this.selectedLoot.add(id) : this.selectedLoot.delete(id);
    });

    // Start Harvest
    html.on("click", "[data-action='start-harvest']", async () => this._startHarvest());
  }

  /* ========================= DRAG & DROP ========================= */
  async _onDrop(event) {
    event.preventDefault();
    const data = event.dataTransfer.getData("text/plain");
    if (!data) return;

    let dropped;
    try {
      dropped = JSON.parse(data);
    } catch {
      console.warn(`[${MODULE_ID}] Invalid drop data.`);
      return;
    }

    // Handle compendium drops
    if (dropped.pack && dropped.id) {
      const pack = game.packs.get(dropped.pack);
      if (!pack) return;
      const item = await pack.getDocument(dropped.id);
      if (item?.type !== "loot" && item?.type !== "material") return;
      this.loot.push(item);
    }

    // Handle actor/item drops directly from sidebar or sheet
    else if (dropped.type === "Item") {
      const item = await Item.implementation.fromDropData(dropped);
      this.loot.push(item);
    }

    // Re-render to show new loot entry
    this.render(true);
  }


  /* ========================= HARVEST EXECUTION ========================= */
  async _startHarvest() {
    if (!this.targetActor) return ui.notifications.warn("No target creature selected.");
    if (!this.harvesters.length) return ui.notifications.warn("Select at least one harvester.");
    if (!this.selectedLoot.size) return ui.notifications.warn("Select at least one material to harvest.");

    const pack = game.packs.get("runes-and-remnants.harvest-items");
    if (!pack) return ui.notifications.error("Harvest Items compendium not found.");

    const { type, cr } = this._actorSummary(this.targetActor);
    const selectedIds = Array.from(this.selectedLoot);
    const assignments = selectedIds.map((id, i) => ({
      id,
      harvester: this.harvesters[i % this.harvesters.length]
    }));

    const lines = [];
    for (const job of assignments) {
      const item = await pack.getDocument(job.id);
      if (!item) {
        lines.push(`<li>⚠️ Unknown item (id: ${job.id})</li>`);
        continue;
      }

      const hflag = item.getFlag(MODULE_ID, "harvest") || {};
      const skills = hflag.skills || ["sur"];
      const rarity = hflag.rarity || "common";
      const baseDC = Number(hflag.baseDC ?? 10);
      const qty = hflag.qty || "1";

      const actor = game.actors.get(job.harvester.actorId);
      if (!actor) {
        lines.push(`<li>⚠️ Harvester not found for ${item.name}</li>`);
        continue;
      }

      const best = bestSkillFor(actor, skills);
      const dc = computeHarvestDC({ cr, type, rarity, baseDC });

      const { total } = await rollSkillCheck(actor, best.key, `Harvest: ${item.name} (DC ${dc})`);
      const res = outcome(total, dc);

      if (res === "critical-success") {
        await grantMaterial({
          item,
          qty: typeof qty === "string" ? `(${qty})*2` : (Number(qty) * 2) || 2,
          toActor: actor,
          dropAt: this._tokenCenter(this.targetToken)
        });
        lines.push(`<li><b>${actor.name}</b> crit success: gained <b>${item.name}</b> ×2</li>`);
      } else if (res === "success") {
        await grantMaterial({
          item,
          qty,
          toActor: actor,
          dropAt: this._tokenCenter(this.targetToken)
        });
        lines.push(`<li><b>${actor.name}</b> success: gained <b>${item.name}</b></li>`);
      } else if (res === "failure") {
        lines.push(`<li><b>${actor.name}</b> failure: no <b>${item.name}</b></li>`);
      } else {
        lines.push(`<li><b>${actor.name}</b> crit failure: ruined <b>${item.name}</b></li>`);
      }
    }

    const content = `
      <p><b>Target:</b> ${this.targetActor.name} (Type: ${type}, CR: ${cr})</p>
      <ul>${lines.join("")}</ul>
      <p class="muted">Results broadcast by Runes & Remnants.</p>
    `;
    ChatMessage.create({ speaker: { alias: "Runes & Remnants" }, content });
  }

  _tokenCenter(tokenDoc) {
    const obj = tokenDoc?.object;
    if (obj?.center) return { x: obj.center.x, y: obj.center.y, scene: tokenDoc.parent?.id };
    const grid = canvas?.grid?.size ?? 100;
    const x = tokenDoc.x + (tokenDoc.width * grid) / 2;
    const y = tokenDoc.y + (tokenDoc.height * grid) / 2;
    return { x, y, scene: tokenDoc.parent?.id };
  }
}
