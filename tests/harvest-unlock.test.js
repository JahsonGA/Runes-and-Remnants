import { describe, it, expect } from "vitest";
import {
  getComponentDC,
  buildHarvestList,
  resolveHarvest,
  harvestOutcome,
  getEssenceByCR
} from "../src/harvest/logic.js";

// The harvest list is the core mechanic: harvesters pick components AND the
// order to take them in, and each entry's Harvest DC is the running total of
// every component before it. Ordering is therefore a real tactical decision,
// and these tests pin that behaviour down.

// ─── getComponentDC ───────────────────────────────────────────────────────────

describe("getComponentDC", () => {
  it("finds a component's own DC from the creature's table", () => {
    expect(getComponentDC("dragon", "Eye")).toBe(5);
    expect(getComponentDC("dragon", "Breath Sac")).toBe(25);
  });

  it("prices essence by CR rather than creature type", () => {
    expect(getComponentDC("dragon", "Remnant (Robust)", 10)).toBe(30);
    expect(getComponentDC("beast", "Remnant (Robust)", 10)).toBe(30);
  });

  it("only matches the essence for the creature's own CR", () => {
    // A CR 10 creature has robust essence; deific is not on its table.
    expect(getComponentDC("dragon", "Remnant (Deific)", 10)).toBeNull();
  });

  it("returns null for a component the creature does not have", () => {
    expect(getComponentDC("dragon", "Gears")).toBeNull();
  });

  it("falls back to the 'other' table for unknown creature types", () => {
    expect(getComponentDC("swarm-of-wasps", "Flesh")).toBe(5);
  });
});

// ─── buildHarvestList — cumulative DCs ────────────────────────────────────────

describe("buildHarvestList — cumulative DCs", () => {
  it("reproduces the worked example from the source rules", () => {
    // Pouch of teeth (10), Eye (5), Eye (5), Breath sac (25), essence (30)
    // -> Harvest DCs 10, 15, 20, 45, 75
    const list = buildHarvestList(
      ["Pouch of Teeth", "Eye", "Eye", "Breath Sac", "Remnant (Robust)"],
      "dragon",
      10
    );
    expect(list.map(e => e.harvestDC)).toEqual([10, 15, 20, 45, 75]);
  });

  it("preserves the order given, never sorting by cost", () => {
    const list = buildHarvestList(["Breath Sac", "Eye"], "dragon");
    expect(list.map(e => e.name)).toEqual(["Breath Sac", "Eye"]);
    expect(list.map(e => e.harvestDC)).toEqual([25, 30]);
  });

  it("makes order change the totals — the whole point of the mechanic", () => {
    const cheapFirst = buildHarvestList(["Eye", "Breath Sac"], "dragon");
    const dearFirst  = buildHarvestList(["Breath Sac", "Eye"], "dragon");

    // The cheap component is reachable first, or pushed out of reach.
    expect(cheapFirst[0].harvestDC).toBe(5);
    expect(dearFirst[1].harvestDC).toBe(30);
    // Both orderings cost the same in total.
    expect(cheapFirst[1].harvestDC).toBe(dearFirst[1].harvestDC);
  });

  it("allows duplicates — a creature can yield two of the same part", () => {
    const list = buildHarvestList(["Eye", "Eye", "Eye"], "dragon");
    expect(list.map(e => e.harvestDC)).toEqual([5, 10, 15]);
  });

  it("numbers entries from 1", () => {
    const list = buildHarvestList(["Eye", "Bone"], "dragon");
    expect(list.map(e => e.order)).toEqual([1, 2]);
  });

  it("returns an empty list for no selection", () => {
    expect(buildHarvestList([], "dragon")).toEqual([]);
  });
});

// ─── buildHarvestList — unknown components ────────────────────────────────────

describe("buildHarvestList — unknown components", () => {
  it("flags a component the creature cannot yield", () => {
    const list = buildHarvestList(["Eye", "Gears"], "dragon");
    expect(list[1].unknown).toBe(true);
    expect(list[1].componentDC).toBeNull();
  });

  it("an unknown component does not corrupt later Harvest DCs", () => {
    const list = buildHarvestList(["Eye", "Gears", "Bone"], "dragon");
    expect(list[0].harvestDC).toBe(5);   // Eye
    expect(list[2].harvestDC).toBe(15);  // Eye + Bone, Gears contributed nothing
  });
});

// ─── resolveHarvest ───────────────────────────────────────────────────────────

describe("resolveHarvest", () => {
  const list = () => buildHarvestList(
    ["Pouch of Teeth", "Eye", "Eye", "Breath Sac", "Remnant (Robust)"],
    "dragon",
    10
  );

  it("matches the source example — a 37 takes the teeth and both eyes", () => {
    const { awarded, missed } = resolveHarvest(list(), 37);
    expect(awarded.map(e => e.name)).toEqual(["Pouch of Teeth", "Eye", "Eye"]);
    expect(missed.map(e => e.name)).toEqual(["Breath Sac", "Remnant (Robust)"]);
  });

  it("awards a component when the check exactly equals its Harvest DC", () => {
    expect(resolveHarvest(list(), 20).awarded).toHaveLength(3);
    expect(resolveHarvest(list(), 19).awarded).toHaveLength(2);
  });

  it("awards nothing below the first Harvest DC", () => {
    const { awarded, missed } = resolveHarvest(list(), 9);
    expect(awarded).toHaveLength(0);
    expect(missed).toHaveLength(5);
  });

  it("awards everything on a high enough check", () => {
    expect(resolveHarvest(list(), 75).awarded).toHaveLength(5);
  });

  it("awards a contiguous leading run — never skips ahead", () => {
    // DCs only ever increase, so a component can't be taken while an
    // earlier, cheaper one was missed.
    const { awarded } = resolveHarvest(list(), 44);
    const names = awarded.map(e => e.name);
    expect(names).toEqual(["Pouch of Teeth", "Eye", "Eye"]);
  });

  it("excludes unknown components from both awarded and missed", () => {
    const withUnknown = buildHarvestList(["Eye", "Gears"], "dragon");
    const { awarded, missed } = resolveHarvest(withUnknown, 100);
    expect(awarded.map(e => e.name)).toEqual(["Eye"]);
    expect(missed).toHaveLength(0);
  });

  it("handles an empty list", () => {
    expect(resolveHarvest([], 50).awarded).toEqual([]);
  });
});

// ─── Ordering trade-off ───────────────────────────────────────────────────────

describe("ordering trade-off", () => {
  it("taking the prize first sacrifices the cheap parts", () => {
    const total = 30;
    const greedy = resolveHarvest(
      buildHarvestList(["Breath Sac", "Eye", "Bone"], "dragon"), total);
    const cautious = resolveHarvest(
      buildHarvestList(["Eye", "Bone", "Breath Sac"], "dragon"), total);

    // Greedy gets the breath sac (25) and the eye (30), but not the bone (40).
    expect(greedy.awarded.map(e => e.name)).toEqual(["Breath Sac", "Eye"]);
    // Cautious gets the cheap parts (5, 15) and the sac just lands at 40 > 30.
    expect(cautious.awarded.map(e => e.name)).toEqual(["Eye", "Bone"]);
    expect(cautious.missed.map(e => e.name)).toEqual(["Breath Sac"]);
  });
});

// ─── Essence ──────────────────────────────────────────────────────────────────

describe("essence in the harvest list", () => {
  it("essence is priced by CR and stacks like any other component", () => {
    const essence = getEssenceByCR(20); // Mythic, cost 40
    const list = buildHarvestList(["Eye", essence.name], "dragon", 20);
    expect(list[1].componentDC).toBe(40);
    expect(list[1].harvestDC).toBe(45); // 5 + 40
  });

  it("taking essence first makes it cheapest to reach", () => {
    const essence = getEssenceByCR(5); // Frail, cost 25
    const first = buildHarvestList([essence.name, "Eye"], "dragon", 5);
    expect(first[0].harvestDC).toBe(25);
  });
});

// ─── harvestOutcome ───────────────────────────────────────────────────────────

describe("harvestOutcome", () => {
  it("nothing recovered is a failure", () => {
    expect(harvestOutcome(0, 4)).toBe("failure");
  });

  it("one of several is partial", () => {
    expect(harvestOutcome(1, 4)).toBe("partial");
  });

  it("some but not all is a success", () => {
    expect(harvestOutcome(3, 4)).toBe("success");
  });

  it("the whole list is a critical success", () => {
    expect(harvestOutcome(4, 4)).toBe("critical-success");
  });

  it("an empty list is a failure, not a critical success", () => {
    expect(harvestOutcome(0, 0)).toBe("failure");
  });
});
