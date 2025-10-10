// src/harvest/menu.js
export class HarvestMenu extends Application {
  constructor(tokenDoc = null, options = {}) {
    super(options);
    this.tokenDoc = tokenDoc;        // TokenDocument (slain creature)
    this.actor = tokenDoc?.actor ?? null;
    this.loot = [];                  // compendium index (loot choices)
    this.selectedLoot = new Set();   // item IDs
    this.harvesters = [];            // [{actorId, name}]
    this._lootLoaded = false;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "rnr-harvest-menu",
      title: "Harvest Materials",
      template: "modules/runes-and-remnants/templates/harvest-dialog.html",
      width: 560,
      height: "auto",
      classes: ["rnr-harvest", "grimdark"]
    });
  }

  async _ensureLootIndex() {
    if (this._lootLoaded) return;
    const pack = game.packs.get("runes-and-remnants.harvest-items");
    if (!pack) return;
    // getIndex returns basic index (name, _id)
    const idx = await pack.getIndex();
    this.loot = idx.contents ?? idx; // FVTT v11/v12 differences
    this._lootLoaded = true;
    this.render(false);
  }

  /** Collect player-controlled actors on the scene as default harvesters */
  _gatherDefaultHarvesters() {
    const actors = new Map();
    // Scene tokens owned by any active player
    for (const t of canvas.tokens.placeables) {
      const a = t.actor;
      if (!a) continue;
      const owned = game.users.some(u => u.active && a.testUserPermission(u, "OWNER"));
      if (owned && !actors.has(a.id)) actors.set(a.id, { actorId: a.id, name: a.name });
    }
    this.harvesters = Array.from(actors.values());
  }

  async getData() {
    // kick off loot load
    this._ensureLootIndex();
    if (!this.harvesters.length) this._gatherDefaultHarvesters();

    const type = this.actor?.system?.details?.type?.value ?? this.actor?.system?.details?.type ?? "Unknown";
    const cr = this.actor?.system?.details?.cr ?? this.actor?.system?.details?.challenge ?? "—";

    return {
      targetName: this.actor?.name ?? "Drop a creature token…",
      type,
      cr,
      hasTarget: !!this.actor,
      loot: this.loot,
      selectedLoot: Array.from(this.selectedLoot),
      harvesters: this.harvesters
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Select loot items
    html.on("change", "input[name='lootChoice']", (ev) => {
      const id = ev.currentTarget.value;
      if (ev.currentTarget.checked) this.selectedLoot.add(id);
      else this.selectedLoot.delete(id);
    });

    // Reorder harvesters
    html.on("click", "[data-action='move-up'], [data-action='move-down']", (ev) => {
      const idx = Number(ev.currentTarget.closest("[data-index]")?.dataset.index);
      if (Number.isNaN(idx)) return;
      const dir = ev.currentTarget.dataset.action === "move-up" ? -1 : 1;
      const j = idx + dir;
      if (j < 0 || j >= this.harvesters.length) return;
      const tmp = this.harvesters[idx];
      this.harvesters[idx] = this.harvesters[j];
      this.harvesters[j] = tmp;
      this.render(false);
    });

    // Remove harvester
    html.on("click", "[data-action='remove-harvester']", (ev) => {
      const idx = Number(ev.currentTarget.closest("[data-index]")?.dataset.index);
      if (!Number.isInteger(idx)) return;
      this.harvesters.splice(idx, 1);
      this.render(false);
    });

    // Add harvester from actor picker
    html.on("click", "[data-action='add-harvester']", async (_ev) => {
      const actors = game.actors?.filter(a => a.isOwner) ?? [];
      const choices = actors.map(a => `<option value="${a.id}">${a.name}</option>`).join("");
      const content = `<div class="rnr-prompt"><label>Choose actor:</label><select name="pick">${choices}</select></div>`;
      const picked = await Dialog.wait({
        title: "Add Harvester",
        content,
        buttons: {
          ok: { label: "Add", callback: html => html.find("select[name='pick']").val() },
          cancel: { label: "Cancel" }
        },
        default: "ok"
      });
      if (picked) {
        const a = game.actors.get(picked);
        if (a && !this.harvesters.find(h => h.actorId === a.id)) {
          this.harvesters.push({ actorId: a.id, name: a.name });
          this.render(false);
        }
      }
    });

    // Start harvest (dice logic will come in next step)
    html.on("click", "[data-action='start-harvest']", async () => {
      if (!this.actor) return ui.notifications.warn("Drop a creature token first.");
      if (!this.selectedLoot.size) return ui.notifications.warn("Select at least one material to harvest.");
      if (!this.harvesters.length) return ui.notifications.warn("Add at least one harvester.");

      // For now, just summarize the plan to chat.
      const lootNames = this._lootNames(Array.from(this.selectedLoot));
      const order = this.harvesters.map(h => h.name).join(" → ");
      const type = this.actor?.system?.details?.type?.value ?? "Unknown";
      const cr = this.actor?.system?.details?.cr ?? "—";
      const content =
        `<p><b>Harvest Target:</b> ${this.actor?.name} (Type: ${type}, CR: ${cr})</p>
         <p><b>Materials:</b> ${lootNames.join(", ")}</p>
         <p><b>Order:</b> ${order}</p>
         <p><i>(Next step will roll skills & apply results.)</i></p>`;
      ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.harvesters[0]?.actorId && game.actors.get(this.harvesters[0].actorId) }), content });
    });

    // Drag & drop for target creature
    this._activateDragDrop(html[0]);
  }

  _lootNames(ids) {
    const byId = new Map(this.loot.map(i => [i._id ?? i.id, i]));
    return ids.map(id => byId.get(id)?.name ?? "(Unknown)");
  }

  _activateDragDrop(root) {
    const zone = root.querySelector("[data-dropzone='target']");
    if (!zone) return;

    zone.addEventListener("dragover", ev => { ev.preventDefault(); zone.classList.add("hover"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("hover"));
    zone.addEventListener("drop", async ev => {
      ev.preventDefault();
      zone.classList.remove("hover");
      try {
        const raw = ev.dataTransfer.getData("text/plain");
        const data = JSON.parse(raw);
        // Accept Token drops
        if (data?.type === "Token" || data?.type === "Scene" || data?.uuid?.includes(".Token.")) {
          const doc = await fromUuid(data.uuid ?? data?.data?.uuid);
          const tokenDoc = doc?.document ?? doc; // v11/v12 differences
          if (tokenDoc?.actor) {
            this.tokenDoc = tokenDoc;
            this.actor = tokenDoc.actor;
            this.render(false);
            return;
          }
        }
        ui.notifications.warn("Drop a token from the canvas.");
      } catch (e) {
        console.error(e);
        ui.notifications.error("Could not parse dropped data.");
      }
    });
  }
}
