import { describe, it, expect } from "vitest";
import { resolveCraft, consumptionPlan, OUTCOME, NEAR_MISS } from "../src/craft/outcome.js";
import { getRecipe, selectReagents, checkReagents } from "../src/craft/logic.js";

// ─── resolveCraft ─────────────────────────────────────────────────────────────

describe("resolveCraft", () => {
  it("meeting the DC exactly is a success", () => {
    const r = resolveCraft({ total: 15, dc: 15 });
    expect(r.success).toBe(true);
    expect(r.margin).toBe(0);
  });

  it("beating it by ten is exceptional", () => {
    expect(resolveCraft({ total: 25, dc: 15 }).outcome).toBe(OUTCOME.CRITICAL);
  });

  it("a natural 20 is exceptional however low the total", () => {
    // A first-level character with no proficiency should still be able to
    // get lucky, or the ceiling of what they can attempt never moves.
    const r = resolveCraft({ total: 21, dc: 40, natural: 20 });
    expect(r.outcome).toBe(OUTCOME.CRITICAL);
    expect(r.success).toBe(true);
  });

  it("a natural 1 ruins it however high the total", () => {
    const r = resolveCraft({ total: 39, dc: 10, natural: 1 });
    expect(r.outcome).toBe(OUTCOME.DISASTER);
    expect(r.success).toBe(false);
  });

  it("a near miss costs the hours but spares the materials", () => {
    // Wiping a CR 21 essence on one bad d20 makes crafting something nobody
    // attempts. The harvest is the part the party earned.
    const r = resolveCraft({ total: 14, dc: 15 });
    expect(r.outcome).toBe(OUTCOME.NEAR_MISS);
    expect(r.consumesReagents).toBe(false);
    expect(r.consumesTime).toBe(true);
  });

  it("a bad miss spoils the materials", () => {
    const r = resolveCraft({ total: 15 - NEAR_MISS, dc: 15 });
    expect(r.outcome).toBe(OUTCOME.FAILURE);
    expect(r.consumesReagents).toBe(true);
  });

  it("the near-miss band is exactly one below the DC down to the threshold", () => {
    for (let under = 1; under < NEAR_MISS; under++) {
      expect(resolveCraft({ total: 20 - under, dc: 20 }).outcome, `${under} under`)
        .toBe(OUTCOME.NEAR_MISS);
    }
    expect(resolveCraft({ total: 20 - NEAR_MISS, dc: 20 }).outcome).toBe(OUTCOME.FAILURE);
  });

  it("every outcome carries a label and something to read", () => {
    for (const total of [30, 15, 14, 5, 0]) {
      const r = resolveCraft({ total, dc: 15 });
      expect(r.label.length).toBeGreaterThan(0);
      expect(r.note.length).toBeGreaterThan(0);
    }
  });

  it("survives being called with nothing", () => {
    expect(() => resolveCraft()).not.toThrow();
  });
});

// ─── selectReagents ───────────────────────────────────────────────────────────

describe("selectReagents", () => {
  const superior = getRecipe("Potion of Superior Healing");   // vital, 10

  it("spends only what the budget needs, not everything that matches", () => {
    // checkReagents reports what COULD count; taking all of it would empty a
    // player's pack to make one potion.
    const parts = [
      { name: "Phial of Blood", dc: 5, id: "a" },
      { name: "Phial of Blood", dc: 5, id: "b" },
      { name: "Heart", dc: 20, id: "c" },
      { name: "Liver", dc: 15, id: "d" }
    ];
    expect(checkReagents(superior, parts).used).toHaveLength(4);
    const chosen = selectReagents(superior, parts);
    expect(chosen.met).toBe(true);
    expect(chosen.parts.length).toBeLessThan(4);
  });

  it("burns scraps before trophies", () => {
    const parts = [
      { name: "Heart", dc: 20, id: "trophy" },
      { name: "Phial of Blood", dc: 5, id: "s1" },
      { name: "Phial of Blood", dc: 5, id: "s2" },
      { name: "Liver", dc: 15, id: "s3" }
    ];
    const chosen = selectReagents(superior, parts);
    expect(chosen.parts.map(p => p.id)).not.toContain("trophy");
  });

  it("reaches for a themed part first, since it buys 2 off the DC", () => {
    // A giant's heart sorts to the expensive end and would never be picked
    // by a purely cheapest-first rule, losing the bonus entirely.
    const giant = getRecipe("Potion of Hill Giant Strength");   // vital, 5, giant
    const chosen = selectReagents(giant, [
      { name: "Phial of Blood", dc: 5, id: "cheap" },
      { name: "Heart", dc: 20, id: "giant-heart", creatureType: "giant" }
    ]);
    expect(chosen.parts.map(p => p.id)).toContain("giant-heart");
  });

  it("reports a shortfall rather than pretending", () => {
    const chosen = selectReagents(superior, [{ name: "Liver", dc: 15, id: "x" }]);
    expect(chosen.met).toBe(false);
    expect(chosen.shortfall).toBe(3);
  });

  it("spends nothing on a recipe that needs nothing", () => {
    const invented = { name: "Soulforge Engine", category: "Clockwork", tools: [], dc: 15, hours: 4 };
    const chosen = selectReagents(invented, [{ name: "Heart", dc: 20, id: "x" }]);
    expect(chosen.parts).toEqual([]);
    expect(chosen.met).toBe(true);
  });

  it("spends a stack unit by unit, not all at once", () => {
    // A stack of four bones is worth four bones of potency, and must cost
    // four bones to spend. Crediting the stack while deducting one item
    // would let the same bones be spent over and over.
    const chosen = selectReagents(getRecipe("Plate"), [
      { name: "Bone", dc: 15, id: "stack", quantity: 4 }   // 7 each, 28 total
    ]);
    expect(chosen.met).toBe(true);
    expect(chosen.potency).toBe(14);            // Plate needs 14 — two bones
    expect(chosen.parts).toHaveLength(2);
    expect(consumptionPlan(chosen.parts)).toEqual({
      deletes: [], updates: [{ _id: "stack", quantity: 2 }]
    });
  });

  it("empties a stack it needs all of", () => {
    const chosen = selectReagents(getRecipe("Plate"), [
      { name: "Bone", dc: 15, id: "stack", quantity: 2 }   // exactly 14
    ]);
    expect(chosen.met).toBe(true);
    expect(consumptionPlan(chosen.parts).deletes).toEqual(["stack"]);
  });

  it("ignores parts of the wrong property entirely", () => {
    const chosen = selectReagents(getRecipe("Plate"), [{ name: "Heart", dc: 20, id: "x" }]);
    expect(chosen.parts).toEqual([]);
    expect(chosen.met).toBe(false);
  });
});

// ─── consumptionPlan ──────────────────────────────────────────────────────────

describe("consumptionPlan", () => {
  it("deletes an item spent down to nothing", () => {
    const plan = consumptionPlan([{ name: "Heart", id: "a", quantity: 1 }]);
    expect(plan.deletes).toEqual(["a"]);
    expect(plan.updates).toEqual([]);
  });

  it("decrements a stack rather than deleting it", () => {
    // Five bones minus one is four bones, not no bones.
    const plan = consumptionPlan([{ name: "Bone", id: "a", quantity: 5 }]);
    expect(plan.deletes).toEqual([]);
    expect(plan.updates).toEqual([{ _id: "a", quantity: 4 }]);
  });

  it("counts repeats of the same item against one stack", () => {
    // selectReagents hands back one entry per unit, so three entries sharing
    // an id means three off that stack of five.
    const unit = { name: "Bone", id: "a", quantity: 1, held: 5 };
    expect(consumptionPlan([unit, unit, unit]).updates).toEqual([{ _id: "a", quantity: 2 }]);
  });

  it("deletes when a stack is spent exactly out", () => {
    const unit = { name: "Bone", id: "a", quantity: 1, held: 2 };
    expect(consumptionPlan([unit, unit]).deletes).toEqual(["a"]);
  });

  it("skips anything with no id — nothing unidentifiable gets destroyed", () => {
    const plan = consumptionPlan([{ name: "Heart" }, null, { name: "Bone", id: "b", quantity: 1 }]);
    expect(plan.deletes).toEqual(["b"]);
  });

  it("survives an empty spend", () => {
    expect(consumptionPlan()).toEqual({ deletes: [], updates: [] });
  });
});
