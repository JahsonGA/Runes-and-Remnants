import { MODULE_ID, computeHarvestDC, outcome, bestSkillFor, rollSkillCheck, grantMaterial } from "./logic.js";

export class HarvestMenu extends Application {
  constructor(initialTokenDoc = null, options = {}) {
    super(options);
    this.targetToken = initialTokenDoc ?? null;     // TokenDocument of the slain creature
    this.targetActor = this.targetToken?.actor ?? null;

    this.harvesters = []; // [{actorId, name, img}]
    this.loot = [];
    this._lootLoaded = false;
    this.selectedLoot = new Set();
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
    id: "rnr-harvest-menu",
    title: "Harvest Materials",
    template: "modules/runes-and-remnants/templates/harvest-dialog.html",
    width: 640,
    height: "auto",
    classes: ["rnr-harvest", "grimdark"],
    dragDrop: [
      { dropSelector: "[data-dropzone='target']" },
      { dropSelector: "[data-dropzone='harvesters']" }
    ]
  });
}

  /* ---------- Data ---------- */

  async _ensureLootIndex() {
    if (this._lootLoaded) return;
    const pack = game.packs.get("runes-and-remnants.harvest-items");
    if (!pack) return;
    const idx = await pack.getIndex();
    this.loot = idx.contents ?? idx;
    this._lootLoaded = true;
  }

  _actorSummary(actor) {
    const type = actor?.system?.details?.type?.value ?? actor?.system?.details?.type ?? "Unknown";
    const cr = actor?.system?.details?.cr ?? actor?.system?.details?.challenge ?? "—";
    return { type, cr };
  }

  async getData() {
    await this._ensureLootIndex();

    const targetName = this.targetActor?.name ?? "Drop a creature token…";
    const targetImg = this.targetToken?.texture?.src ??
                        this.targetActor?.prototypeToken?.texture?.src ??
                        this.targetActor?.img ??
                        "icons/svg/skull.svg";
    const { type, cr } = this._actorSummary(this.targetActor);

    return {
      hasTarget: !!this.targetActor,
      targetName, targetImg, type, cr,
      loot: this.loot,
      selectedLoot: Array.from(this.selectedLoot),
      harvesters: this.harvesters
    };
  }

  async _onDrop(event) {
  event.preventDefault();
  const dz = event.currentTarget?.dataset?.dropzone; // "target" | "harvesters"
  if (!dz) return;

  // Foundry may set multiple MIME types; prefer text/plain JSON
  let data;
  try {
    data = JSON.parse(event.dataTransfer.getData("text/plain"));
  } catch {
    return ui.notifications.warn("Unsupported drop payload.");
  }

  // Resolve any UUID to a document
  const uuid = data?.uuid ?? data?.data?.uuid;
  let tokenDoc = null;

  if (data?.type === "Token" || (uuid && uuid.includes(".Token."))) {
    const doc = uuid ? await fromUuid(uuid) : null;
    tokenDoc = doc?.document ?? doc ?? null;
  } else if (data?.type === "Actor") {
    // Allow dropping from the Actors Directory too (for harvesters)
    const actor = uuid ? await fromUuid(uuid) : (data?.actorId && game.actors.get(data.actorId));
    if (actor) tokenDoc = { actor, id: actor.id, object: null }; // shim with actor only
  }

  if (!tokenDoc?.actor) return ui.notifications.warn("Drop a token from the canvas (or an Actor for harvesters).");

  if (dz === "target") {
    // Set the harvested creature; do NOT auto-add to harvesters
    this.targetToken = tokenDoc.id ? tokenDoc : this.targetToken; // keep real token if we have one
    this.targetActor = tokenDoc.actor;
    this.render(false);
    return;
  }

  if (dz === "harvesters") {
    // Ignore if it’s the same as the current target creature
    const a = tokenDoc.actor;
    if (!a) return;
    if (this.targetActor && a.id === this.targetActor.id) {
      return ui.notifications.info("Target creature cannot be a harvester.");
    }
    if (this.harvesters.some(h => h.actorId === a.id)) return; // no duplicates
    this.harvesters.push({ actorId: a.id, name: a.name, img: a.img });
    this.render(false);
    return;
  }
}


  /* ---------- Listeners ---------- */

  activateListeners(html) {
    super.activateListeners(html);

    // Loot selection
    html.on("change", "input[name='lootChoice']", (ev) => {
      const id = ev.currentTarget.value;
      ev.currentTarget.checked ? this.selectedLoot.add(id) : this.selectedLoot.delete(id);
    });

    // Order controls
    html.on("click", "[data-action='move-up'], [data-action='move-down']", (ev) => {
      const li = ev.currentTarget.closest("li[data-index]");
      const i = Number(li.dataset.index);
      const j = i + (ev.currentTarget.dataset.action === "move-up" ? -1 : 1);
      if (j < 0 || j >= this.harvesters.length) return;
      [this.harvesters[i], this.harvesters[j]] = [this.harvesters[j], this.harvesters[i]];
      this.render(false);
    });

    // Remove harvester
    html.on("click", "[data-action='remove-harvester']", (ev) => {
      const i = Number(ev.currentTarget.closest("li[data-index]")?.dataset.index);
      if (!Number.isInteger(i)) return;
      this.harvesters.splice(i, 1);
      this.render(false);
    });

    // Start harvest
    html.on("click", "[data-action='start-harvest']", async () => {
      if (!this.targetActor) return ui.notifications.warn("Drop a target creature first.");
      if (!this.harvesters.length) return ui.notifications.warn("Add at least one harvester.");
      if (!this.selectedLoot.size) return ui.notifications.warn("Select at least one material.");

      const pack = game.packs.get("runes-and-remnants.harvest-items");
      if (!pack) return ui.notifications.error("Harvest Items compendium not found.");

      const { type, cr } = this._actorSummary(this.targetActor);
      const selectedIds = Array.from(this.selectedLoot);

      // Assign materials round-robin to harvesters (players set order in UI)
      const assignments = selectedIds.map((id, i) => ({ id, harvester: this.harvesters[i % this.harvesters.length] }));

      const lines = [];
      for (const job of assignments) {
        const item = await pack.getDocument(job.id);
        if (!item) { lines.push(`<li>⚠️ Unknown item (id: ${job.id})</li>`); continue; }

        // Flags drive per-material config (skills, rarity, baseDC, qty)
        const hflag = item.getFlag(MODULE_ID, "harvest") || {};
        const skills = hflag.skills || ["sur"];             // e.g., ["sur","med","nat","arc","inv"]
        const rarity = hflag.rarity || "common";            // common/uncommon/rare/very-rare/legendary
        const baseDC = Number(hflag.baseDC ?? 10);
        const qty = hflag.qty || "1";                       // number or roll formula like "1d2"

        const actor = game.actors.get(job.harvester.actorId);
        if (!actor) { lines.push(`<li>⚠️ Harvester not found for ${item.name}</li>`); continue; }

        // Pick best skill the actor has from allowed list
        const best = bestSkillFor(actor, skills);
        const dc = computeHarvestDC({ cr, type, rarity, baseDC });

        const { total } = await rollSkillCheck(actor, best.key, `Harvest: ${item.name} (DC ${dc})`);
        const res = outcome(total, dc);

        if (res === "critical-success") {
          await grantMaterial({
            item,
            qty: typeof qty === "string" ? `(${qty})*2` : (Number(qty) * 2) || 2,
            toActor: actor,
            dropAt: this.targetToken ? this._tokenCenter(this.targetToken) : null
          });
          lines.push(`<li><b>${actor.name}</b> crit success: gained <b>${item.name}</b> ×2</li>`);
        } else if (res === "success") {
          await grantMaterial({
            item,
            qty,
            toActor: actor,
            dropAt: this.targetToken ? this._tokenCenter(this.targetToken) : null
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
        <p class="muted">Item Piles drop is used if available; otherwise items are added to the harvester's inventory.</p>
      `;
      ChatMessage.create({ speaker: { alias: "Runes & Remnants" }, content });
    });

    // ✅ Initialize both dropzones
    //this._activateDropzones(html[0]);
  }

  _lootNames(ids) {
    const byId = new Map(this.loot.map(i => [i._id ?? i.id, i]));
    return ids.map(id => byId.get(id)?.name ?? "(Unknown)");
  }

  /*_activateDropzones(root) {
    const makeDZ = (el, onDrop) => {
      if (!el) return;
      el.addEventListener("dragover", ev => { ev.preventDefault(); el.classList.add("hover"); });
      el.addEventListener("dragleave", () => el.classList.remove("hover"));
      el.addEventListener("drop", async ev => {
        ev.preventDefault();
        el.classList.remove("hover");
        try {
          const data = JSON.parse(ev.dataTransfer.getData("text/plain"));
          const uuid = data?.uuid ?? data?.data?.uuid;
          if (!uuid) return ui.notifications.warn("Drop a token from the canvas.");
          const doc = await fromUuid(uuid);
          const tokenDoc = doc?.document ?? doc;
          if (!(tokenDoc?.actor)) return ui.notifications.warn("Drop a token, not a sheet link.");
          await onDrop(tokenDoc);
          this.render(false);
        } catch (e) {
          console.error(e);
          ui.notifications.error("Could not parse dropped data.");
        }
      });
    };

    // Target creature (single)
    makeDZ(root.querySelector("[data-dropzone='target']"), async (tokenDoc) => {
      this.targetToken = tokenDoc;
      this.targetActor = tokenDoc.actor;
    });

    // Harvesters (multiple)
    makeDZ(root.querySelector("[data-dropzone='harvesters']"), async (tokenDoc) => {
      const a = tokenDoc.actor;
      if (!a) return;
      if (this.harvesters.some(h => h.actorId === a.id)) return; // ignore duplicates
      this.harvesters.push({ actorId: a.id, name: a.name, img: a.img });
    });
  }*/

  // ✅ Needed by grantMaterial() when dropping Item Piles at the corpse
  _tokenCenter(tokenDoc) {
    const obj = tokenDoc.object;
    if (obj?.center) return { x: obj.center.x, y: obj.center.y, scene: tokenDoc.parent?.id };
    // fallback if object not on canvas (e.g., from UUID only)
    const grid = canvas?.grid?.size ?? 100;
    const x = tokenDoc.x + (tokenDoc.width * grid) / 2;
    const y = tokenDoc.y + (tokenDoc.height * grid) / 2;
    return { x, y, scene: tokenDoc.parent?.id };
  }
}
