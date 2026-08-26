// =========================================================
// Runes & Remnants — Confirmation dialog
//
// One place that asks "are you sure", because the API for doing so changed
// under us. v13 introduced foundry.applications.api.DialogV2 and deprecated
// the old `Dialog`; v11 and v12 have only `Dialog`. Feature-detecting here
// keeps a single build working across all of them, and keeps the choice out
// of the callers.
// =========================================================

export const MODULE_ID = "runes-and-remnants";
export const SETTING_CONFIRM = "confirmSpending";

/**
 * Ask before spending something that cannot be got back.
 *
 * Returns true when the player agreed. Returns true *without asking* when the
 * GM has turned confirmations off — a table that crafts constantly should not
 * have to click twice forever.
 *
 * @param {object} args
 * @param {string} args.title
 * @param {string} args.content  HTML body
 * @param {string} [args.confirmLabel]
 * @returns {Promise<boolean>}
 */
export async function confirmSpend({ title, content, confirmLabel = "Do it" } = {}) {
  if (!wantsConfirmation()) return true;

  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (DialogV2) {
    return DialogV2.confirm({
      window: { title },
      content,
      yes: { label: confirmLabel },
      no: { label: "Cancel" },
      // Cancelling must never be mistaken for agreement.
      rejectClose: false,
      modal: true
    }).catch(() => false);
  }

  // v11 / v12.
  return new Promise(resolve => {
    new Dialog({
      title,
      content,
      buttons: {
        yes: { icon: '<i class="fas fa-check"></i>', label: confirmLabel, callback: () => resolve(true) },
        no:  { icon: '<i class="fas fa-times"></i>', label: "Cancel", callback: () => resolve(false) }
      },
      default: "yes",
      // Closing the window is a refusal, not a silent yes.
      close: () => resolve(false)
    }).render(true);
  });
}

/** Whether the world wants to be asked. Defaults to yes. */
export function wantsConfirmation() {
  try {
    return game.settings.get(MODULE_ID, SETTING_CONFIRM) !== false;
  } catch {
    // Setting not registered yet (or no game at all) — ask, which is the
    // safe side of the guess.
    return true;
  }
}

/** Called from index.js during init. */
export function registerConfirmSetting() {
  game.settings.register(MODULE_ID, SETTING_CONFIRM, {
    name: "Confirm before spending materials",
    hint: "Show a summary of what will be consumed, what it costs and how long it takes "
        + "before crafting or enchanting. Turn off once your table knows the numbers.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
}
