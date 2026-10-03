// =========================================================
// Runes & Remnants — the reward panel's Foundry side
//
// Separate from reward.js because `extends Application` reaches for a
// Foundry global at module scope, and that one line would make the shaping
// functions unimportable outside a world — taking their tests with them.
// Same split as logic.js / execute.js everywhere else in the module.
// =========================================================

import { rewardData, MODULE_ID } from "./reward.js";
import { actorOwners, isRecipient } from "./reward-broadcast.js";

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
    if (this._reassert) Hooks.off("renderRunesHub", this._reassert);
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
    return new Promise(resolve => {
      const panel = new RewardPanel(data, resolve);
      panel.render(true);

      // The hub that triggered this re-renders right after — "inventory
      // changed; the bench must catch up" — and Foundry brings an
      // Application to the front on every render, not just its first. Left
      // alone, that re-render steals the front-most spot back from a panel
      // that had just opened, so the reward lands behind the hub that
      // granted it.
      //
      // A fixed delay (this used to be setTimeout(..., 0)) assumed the hub's
      // own re-render would finish within one tick, which it does not
      // reliably — Foundry's render pipeline is genuinely async (template
      // fetch and compile included), so the timer could fire before the hub
      // had actually bumped its own z-index, and the fix did nothing.
      // Listening for the hub's own render hook instead reacts to when it
      // actually finishes, however long that takes. "RunesHub" is named
      // directly rather than imported — this file stays loadable without the
      // rest of the hub, same reasoning as not importing Application-derived
      // code elsewhere in this split. Left listening (not `once`) for as
      // long as the panel is open, since the hub can legitimately re-render
      // more than once while a player decides whether to accept; removed in
      // close() so it cannot reach a panel that no longer exists. A later,
      // genuine click on the hub still brings it forward normally — that
      // goes through Foundry's own focus handling, not this hook, and runs
      // after whatever this last reasserted.
      const reassert = () => { if (panel.rendered) panel.bringToTop(); };
      panel._reassert = reassert;
      Hooks.on("renderRunesHub", reassert);
    });
  }
}

/**
 * Show a reward to whoever owns the actor, not the whole table.
 *
 * Crafting and enchanting are GM-authoritative: a player's request is
 * executed on the GM's client, so `game.user` here is often the GM, not the
 * player who asked. This client only renders locally when it is itself a
 * recipient (solo play, or a GM-owned test character); otherwise it relies
 * entirely on the broadcast reaching the owner's own session, where the same
 * check runs again and passes.
 */
export function showRewardToOwner(actor, reward) {
  const recipients = actorOwners(actor);

  if (isRecipient(recipients, game.user.id, game.user.isGM)) {
    RewardPanel.show(reward);
  }

  // Foundry's socket relay does not echo back to the sender, so this is what
  // reaches every other connected client — including the actual owner, who
  // was not reachable any other way from here.
  game.socket?.emit(`module.${MODULE_ID}`, {
    action: "showReward",
    reward,
    recipients
  });
}
