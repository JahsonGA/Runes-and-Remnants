// =========================================================
// Runes & Remnants — the reward panel's Foundry side
//
// Separate from reward.js because `extends Application` reaches for a
// Foundry global at module scope, and that one line would make the shaping
// functions unimportable outside a world — taking their tests with them.
// Same split as logic.js / execute.js everywhere else in the module.
// =========================================================

import { rewardData, MODULE_ID } from "./reward.js";

export class RewardPanel extends Application {
  constructor(data = {}, resolve = () => {}) {
    super();
    this.rewardContext = rewardData(data);
    this._resolve = resolve;
    this._settled = false;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "rnr-reward",
      title: "Runes & Remnants",
      template: `modules/${MODULE_ID}/templates/reward.html`,
      width: 460,
      height: "auto",
      classes: ["rnr-harvest", "grimdark", "rnr-reward-app"]
    });
  }

  getData() {
    return this.rewardContext;
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.on("click", "[data-action='reward-accept']", () => this.close());
  }

  async close(options) {
    this._settle();
    return super.close(options);
  }

  /**
   * Resolve once, however the panel was dismissed.
   *
   * This reports what already happened — the items are granted before it
   * opens — so closing it is not a refusal and there is nothing to cancel.
   * A caller awaiting it must never be left hanging because someone hit the
   * window's X instead of the button.
   */
  _settle() {
    if (this._settled) return;
    this._settled = true;
    this._resolve();
  }

  /** Show one, awaiting dismissal. */
  static show(data = {}) {
    return new Promise(resolve => new RewardPanel(data, resolve).render(true));
  }
}
