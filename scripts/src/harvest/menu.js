// ---------- Imports ----------
import {
  MODULE_ID,
  computeHarvestDC,
  outcome,
  bestSkillFor,
  rollSkillCheck,
  grantMaterial
} from "./logic.js";

// ---------- Harvest Menu ----------
export class HarvestMenu extends Application {
  constructor(initialTokenDoc = null, options = {}) {
    super(options);
    this.targetToken = initialTokenDoc ?? null;
    this.targetActor = this.targetToken?.actor ?? null;
    this.harvesters = []; // [{ actorId, name, img, owner }]
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

  /* ---------- Helpers ---------- */

  _actorSummary(actor) {
    const type =
      actor?.system?.details?.type?.value ??
      actor?.system?.details?.type ??
      "Unknown";
    const cr =
      actor?.system?.details?.cr ??
      actor?.system?.details?.challenge ??
      "—";
    return { type, cr };
  }

  _getPortrait(actor) {
    return (
      actor?.prototypeToken?.texture?.src ??
      actor?.img ??
      "icons/svg/mystery-man.svg"
    );
  }

  _getTargetPortrait() {
    return (
      this.targetToken?.texture?.src ??
      this.targetActor?.prototypeToken?.texture?.src ??
      this.targetActor?.img ??
      "icons/svg/skull.svg"
    );
  }

  async _ensureLootIndex() {
    if (this._lootLoaded) return;
    const pack = game.packs.get("runes-and-remnants.harvest-items");
    if (!pack) return;
    const idx = await pack.getIndex();
    this.loot = idx.contents ?? idx;
    this._lootLoaded = true;
  }

  /* ---------- Data ---------- */

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

  /* ---------- Build harvester dropdown ---------- */

  _getAvailableHarvesters() {
    if (!game?.actors) return [];
    const allActors = Array.from(game.actors.values());
    const activeUserIds = game.users.filter(u => u.active).map(u => u.id);
    const sceneTokenIds = canvas?.tokens?.placeables?.map(t => t.actor?.id) ?? [];

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

    // Exclude already added harvesters
    const takenIds = new Set(this.harvesters.map(h => h.actorId));
    const filtered = weighted.filter(w => !takenIds.has(w.actor.id));

    filtered.sort((a, b) => a.weight - b.weight || a.actor.name.localeCompare(b.actor.name));

    return filtered.map(w => ({
      id: w.actor.id,
      name: w.actor.name,
      img: this._getPortrait(w.actor),
      owners: w.ownerNames
    }));
  }

  /* ---------- Listeners ---------- */

  activateListeners(html) {
    super.activateListeners(html);

    // Add new harvester from dropdown
    html.find(".rnr-harvester-dropdown").on("change", ev => {
      const id = ev.currentTarget.value;
      if (!id) return;

      const actor = game.actors.get(id);
      if (!actor) return;

      const img = this._getPortrait(actor);
      const owners = game.users
        .filter(u => actor.testUserPermission(u, "OWNER"))
        .map(u => u.name)
        .join(", ") || "—";

      if (this.harvesters.some(h => h.actorId === id)) return;
      this.harvesters.push({
        actorId: id,
        name: actor.name,
        img,
        owner: owners
      });

      this.render(false);
    });

    // Move Up/Down/Remove
    html.find("[data-action]").on("click", ev => {
      const action = ev.currentTarget.dataset.action;
      const i = Number(ev.currentTarget.closest("li[data-index]")?.dataset.index);
      if (isNaN(i)) return;

      if (action === "remove-harvester") {
        this.harvesters.splice(i, 1);
      } else if (action === "move-up" || action === "move-down") {
        const j = i + (action === "move-up" ? -1 : 1);
        if (j >= 0 && j < this.harvesters.length) {
          [this.harvesters[i], this.harvesters[j]] = [
            this.harvesters[j],
            this.harvesters[i]
          ];
        }
      }

      this.render(false);
    });

    // Start Harvest
    html.find("[data-action='start-harvest']").on("click", async () => {
      if (!this.targetActor)
        return ui.notifications.warn("No target creature selected.");
      if (!this.harvesters.length)
        return ui.notifications.warn("Select at least one harvester.");
      if (!this.selectedLoot.size)
        return ui.notifications.warn("Select at least one material.");

      const pack = game.packs.get("runes-and-remnants.harvest-items");
      if (!pack)
        return ui.notifications.error("Harvest Items compendium not found.");

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

        const { total } = await rollSkillCheck(
          actor,
          best.key,
          `Harvest: ${item.name} (DC ${dc})`
        );
        const res = outcome(total, dc);

        if (res === "critical-success") {
          await grantMaterial({
            item,
            qty:
              typeof qty === "string"
                ? `(${qty})*2`
                : (Number(qty) * 2) || 2,
            toActor: actor,
            dropAt: this._tokenCenter(this.targetToken)
          });
          lines.push(
            `<li><b>${actor.name}</b> crit success: gained <b>${item.name}</b> ×2</li>`
          );
        } else if (res === "success") {
          await grantMaterial({
            item,
            qty,
            toActor: actor,
            dropAt: this._tokenCenter(this.targetToken)
          });
          lines.push(
            `<li><b>${actor.name}</b> success: gained <b>${item.name}</b></li>`
          );
        } else if (res === "failure") {
          lines.push(
            `<li><b>${actor.name}</b> failure: no <b>${item.name}</b></li>`
          );
        } else {
          lines.push(
            `<li><b>${actor.name}</b> crit failure: ruined <b>${item.name}</b></li>`
          );
        }
      }

      const content = `
        <p><b>Target:</b> ${this.targetActor.name} (Type: ${type}, CR: ${cr})</p>
        <ul>${lines.join("")}</ul>
        <p class="muted">Results broadcast by Runes & Remnants.</p>
      `;
      ChatMessage.create({ speaker: { alias: "Runes & Remnants" }, content });
    });
  }

  /* ---------- Helpers ---------- */

  _tokenCenter(tokenDoc) {
    const obj = tokenDoc?.object;
    if (obj?.center) return { x: obj.center.x, y: obj.center.y, scene: tokenDoc.parent?.id };
    const grid = canvas?.grid?.size ?? 100;
    const x = tokenDoc.x + (tokenDoc.width * grid) / 2;
    const y = tokenDoc.y + (tokenDoc.height * grid) / 2;
    return { x, y, scene: tokenDoc.parent?.id };
  }
}
