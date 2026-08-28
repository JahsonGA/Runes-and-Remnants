import { describe, it, expect } from "vitest";
import { CraftPanel } from "../src/craft/panel.js";

// Four bones, any one of which would cover a cheap build. The panel used to
// draw all four as chosen while only one was going in.
const bones = () => ([
  { id: "b1", name: "Bone", dc: 10, stamped: true },
  { id: "b2", name: "Bone", dc: 10, stamped: true },
  { id: "b3", name: "Bone", dc: 10, stamped: true },
  { id: "b4", name: "Bone", dc: 10, stamped: true }
]);

const crafter = (parts = bones()) => ({
  abilities: { str: 3, dex: 4, con: 1, int: 2 },
  tools: ["Leatherworker's tools"],
  proficiency: 3,
  parts
});

const panelFor = (recipe, over = {}) => {
  const panel = new CraftPanel();
  panel.recipe = recipe;
  Object.assign(panel, over);
  return panel;
};

describe("choosing which parts to spend", () => {
  it("marks only the parts actually going in", () => {
    // The bug: every matching part carried the "picked" class, so four Bones
    // all looked chosen when the build needed one.
    const data = panelFor("Leather").getData(crafter());
    const used = data.plan.reagents.used;

    expect(used).toHaveLength(4);
    expect(used.filter(p => p.spending).length).toBe(1);
    expect(used.filter(p => !p.spending && !p.excluded).length).toBe(3);
  });

  it("gives every part an id, so it can be clicked", () => {
    for (const part of panelFor("Leather").getData(crafter()).plan.reagents.used) {
      expect(part.id, `"${part.name}" has no id to toggle`).toBeTruthy();
    }
  });

  it("switching one off makes the build reach for another", () => {
    const panel = panelFor("Leather");
    const first = panel.getData(crafter()).plan.reagents.used.find(p => p.spending);

    panel.reagentExcluded.add(first.id);
    const after = panel.getData(crafter()).plan.reagents.used;

    expect(after.find(p => p.id === first.id).excluded).toBe(true);
    expect(after.find(p => p.id === first.id).spending).toBe(false);
    // Still buildable — it simply used a different bone.
    expect(after.filter(p => p.spending).length).toBe(1);
  });

  it("keeps a switched-off part on screen so it can be switched back", () => {
    // A part that vanishes when clicked reads as destroyed.
    const panel = panelFor("Leather", { reagentExcluded: new Set(["b1", "b2"]) });
    const used = panel.getData(crafter()).plan.reagents.used;
    expect(used).toHaveLength(4);
    expect(used.filter(p => p.excluded).map(p => p.id)).toEqual(["b1", "b2"]);
  });

  it("switching off enough to fall short blocks the build and says so", () => {
    const panel = panelFor("Leather", {
      reagentExcluded: new Set(["b1", "b2", "b3", "b4"])
    });
    const data = panel.getData(crafter());
    expect(data.plan.blocked).toBe(true);
    expect(data.craftBlocked).toBe(true);
    expect(data.craftHint).toMatch(/short/i);
  });

  it("the running total counts only what is still in play", () => {
    const panel = panelFor("Leather", { reagentExcluded: new Set(["b1", "b2"]) });
    const reagents = panel.getData(crafter()).plan.reagents;
    // Two bones left, 5 potency each.
    expect(reagents.potency).toBe(10);
    expect(reagents.excludedCount).toBe(2);
  });

  it("the button promises exactly what the list highlights", () => {
    // These are computed separately, and drifting apart is how a bench ends
    // up spending something it never showed.
    const panel = panelFor("Plate");
    const data = panel.getData(crafter());
    const highlighted = data.plan.reagents.used.filter(p => p.spending);

    expect(data.craftHint).toMatch(/^Spends /);
    // Counted by name rather than by splitting on commas — the hint appends
    // a disadvantage clause that carries a comma of its own.
    const named = data.craftHint.match(/Bone/g) ?? [];
    expect(named.length).toBe(highlighted.length);
    expect(highlighted.length).toBeGreaterThan(0);
  });

  it("hands the excluded ids over for the request that does the spending", () => {
    const panel = panelFor("Leather", { reagentExcluded: new Set(["b2"]) });
    expect(panel.excludedIds()).toEqual(["b2"]);
  });

  it("filters a pile down to what is still in play", () => {
    const panel = panelFor("Leather", { reagentExcluded: new Set(["b1"]) });
    expect(panel.includedParts(bones()).map(p => p.id)).toEqual(["b2", "b3", "b4"]);
  });

  it("survives an exclusion for a part no longer carried", () => {
    // Sold the bone, kept the note.
    const panel = panelFor("Leather", { reagentExcluded: new Set(["gone"]) });
    expect(() => panel.getData(crafter())).not.toThrow();
    expect(panel.getData(crafter()).plan.blocked).toBe(false);
  });

  it("starts with nothing switched off", () => {
    expect(new CraftPanel().excludedIds()).toEqual([]);
  });
});
