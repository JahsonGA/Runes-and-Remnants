// src/harvest/menu.js
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
      classes: ["rnr-harvest", "grimdark"]
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
    const targetImg = this.targetActor?.img ?? "icons/svg/skull.svg";
    const { type, cr } = this._actorSummary(this.targetActor);

    return {
      hasTarget: !!this.targetActor,
      targetName, targetImg, type, cr,
      loot: this.loot,
      selectedLoot: Array.from(this.selectedLoot),
      harvesters: this.harvesters
    };
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

    // Start harvest (dice wiring comes next step)
    html.on("click", "[data-action='start-harvest']", async () => {
      if (!this.targetActor) return ui.notifications.warn("Drop a target creature first.");
      if (!this.harvesters.length) return ui.notifications.warn("Add at least one harvester.");
      if (!this.selectedLoot.size) return ui.notifications.warn("Select at least one material.");

      const lootNames = this._lootNames(Array.from(this.selectedLoot)).join(", ");
      const order = this.harvesters.map(h => h.name).join(" → ");
      const { type, cr } = this._actorSummary(this.targetActor);
      const content = `
        <p><b>Target:</b> ${this.targetActor.name} (Type: ${type}, CR: ${cr})</p>
        <p><b>Materials:</b> ${lootNames}</p>
        <p><b>Order:</b> ${order}</p>
        <p><i>(Next step will roll skills & apply results.)</i></p>`;
      ChatMessage.create({ speaker: { alias: "Runes & Remnants" }, content });
    });

    // Drag & drop zones
    this._activateDropzones(html[0]);
  }

  _lootNames(ids) {
    const byId = new Map(this.loot.map(i => [i._id ?? i.id, i]));
    return ids.map(id => byId.get(id)?.name ?? "(Unknown)");
  }

  _activateDropzones(root) {
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
  }
}
