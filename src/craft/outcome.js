// =========================================================
// Runes & Remnants — Crafting outcomes
//
// What a roll means, and what it costs. Pure functions, no Foundry, so the
// rules can be tested without a world.
//
// The design question this file answers: what happens when you fail?
//
// Losing everything on a miss is the obvious answer and the wrong one. A
// legendary potion takes a CR 21 essence and a thousand hours; wiping that on
// one bad d20 makes crafting something nobody attempts. So a failure is
// graded — a near miss costs time, a bad miss costs materials, and only a
// catastrophe costs both. The materials are the *harvest* the party earned,
// and taking them back too readily punishes the wrong part of the loop.
// =========================================================

/** How far under the DC before materials start burning. */
export const NEAR_MISS = 5;

export const OUTCOME = {
  CRITICAL:  "critical",
  SUCCESS:   "success",
  NEAR_MISS: "near-miss",
  FAILURE:   "failure",
  DISASTER:  "disaster"
};

export const OUTCOME_LABEL = {
  critical:    "Exceptional work",
  success:     "Success",
  "near-miss": "So close",
  failure:     "Failure",
  disaster:    "Ruined"
};

/**
 * Read a crafting roll.
 *
 * @param {object} args
 * @param {number} args.total  the check total
 * @param {number} args.dc     the DC it was made against
 * @param {number} [args.natural] the raw d20, for crit and fumble
 * @returns {{outcome: string, label: string, margin: number,
 *            consumesReagents: boolean, consumesTime: boolean, note: string}}
 */
export function resolveCraft({ total = 0, dc = 10, natural = null } = {}) {
  const margin = total - dc;

  // A natural 20 is exceptional work; a natural 1 ruins the batch. Everything
  // between is decided by the margin, so a high bonus still matters.
  if (natural === 20) return grade(OUTCOME.CRITICAL, margin);
  if (natural === 1)  return grade(OUTCOME.DISASTER, margin);

  if (margin >= 10) return grade(OUTCOME.CRITICAL, margin);
  if (margin >= 0)  return grade(OUTCOME.SUCCESS, margin);
  if (margin > -NEAR_MISS) return grade(OUTCOME.NEAR_MISS, margin);
  return grade(OUTCOME.FAILURE, margin);
}

const RULES = {
  [OUTCOME.CRITICAL]:  { reagents: true,  time: true,  note: "Finished early and finished well." },
  [OUTCOME.SUCCESS]:   { reagents: true,  time: true,  note: "It works." },
  [OUTCOME.NEAR_MISS]: { reagents: false, time: true,  note: "Botched, but the materials survive. Try again — the hours are gone." },
  [OUTCOME.FAILURE]:   { reagents: true,  time: true,  note: "The materials are spoiled." },
  [OUTCOME.DISASTER]:  { reagents: true,  time: true,  note: "Ruined, and the workspace with it." }
};

function grade(outcome, margin) {
  const rule = RULES[outcome];
  return {
    outcome,
    label: OUTCOME_LABEL[outcome],
    margin,
    success: outcome === OUTCOME.CRITICAL || outcome === OUTCOME.SUCCESS,
    consumesReagents: rule.reagents,
    consumesTime: rule.time,
    note: rule.note
  };
}

/**
 * Turn the parts being spent into edits an actor's inventory can take.
 *
 * Returns deletes and quantity decrements separately, because a stack of five
 * bones should lose one rather than vanish.
 *
 * Each entry from selectReagents is a single unit, so three entries sharing
 * an id means three off that stack. `held` carries the stack size the unit
 * came from; without it, spending two of four would read as a delete.
 *
 * @param {object[]} parts  unit entries from selectReagents()
 * @returns {{deletes: string[], updates: {_id: string, quantity: number}[]}}
 */
export function consumptionPlan(parts = []) {
  const spent = new Map();
  for (const part of parts) {
    if (!part?.id) continue;
    const seen = spent.get(part.id);
    spent.set(part.id, {
      take: (seen?.take ?? 0) + 1,
      held: seen?.held ?? Math.max(1, Number(part.held ?? part.quantity) || 1)
    });
  }

  const deletes = [];
  const updates = [];
  for (const [id, { take, held }] of spent) {
    if (take >= held) deletes.push(id);
    else updates.push({ _id: id, quantity: held - take });
  }
  return { deletes, updates };
}
