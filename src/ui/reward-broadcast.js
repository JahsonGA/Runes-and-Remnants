// =========================================================
// Runes & Remnants — who a reward is for
//
// Pure. Deliberately holds no import of reward-panel.js — that file does
// `extends Application` at module scope, which would make this file
// unimportable in Node the moment anything touched it, and take
// actorOwners() off the test suite's reach along with it. The Foundry-side
// function that actually calls RewardPanel.show lives in reward-panel.js,
// importing this instead of the other way around.
//
// This still calls `game.users` when invoked, so it is "pure" the way the
// rest of this module uses the word: importable and inspectable with no
// Foundry runtime present, even though running it for real needs one — the
// same relationship execute.js has to logic.js everywhere else here.
// =========================================================

/**
 * Active, non-GM users holding at least OWNER permission on the actor.
 *
 * Harvest broadcasts its reward to the whole party, because a kill is a
 * party moment everyone watched happen. A crafted dagger or a brewed potion
 * is not — it belongs to whoever made it, so recipients are computed from
 * ownership rather than "everyone connected."
 *
 * @param {object} actor  anything with a `testUserPermission(user, level)` method
 * @param {object[]} [users]  defaults to `game.users`; a parameter so this is
 *   callable with a fake roster in a test, with no Foundry runtime present
 */
export function actorOwners(actor, users = globalThis.game?.users) {
  if (!actor || !users) return [];
  return Array.from(users)
    .filter(u => !u.isGM && actor.testUserPermission(u, "OWNER"))
    .map(u => u.id);
}

/**
 * Whether a reward addressed to `recipients` belongs to `userId`.
 *
 * Falls back to true for a GM when the list is empty — an NPC, or a world
 * set up without player ownership, must still show the result to someone
 * rather than to no one at all.
 */
export function isRecipient(recipients, userId, isGM = false) {
  const list = recipients ?? [];
  return list.includes(userId) || (list.length === 0 && isGM);
}
