import { describe, it, expect } from "vitest";
import { rewardItem, rewardData } from "../src/ui/reward.js";

// The reward panel is what a kill, a craft or a binding yielded. Harvest,
// crafting and enchanting each hand over a slightly different shape, and the
// panel should not care which it got.

describe("rewardItem", () => {
  it("takes a Foundry item document's shape", () => {
    const r = rewardItem({ name: "Heart", img: "icons/h.webp", system: { rarity: "rare", quantity: 2 } });
    expect(r).toMatchObject({ name: "Heart", img: "icons/h.webp", rarityKey: "rare", quantity: 2 });
  });

  it("takes a bare object just as happily", () => {
    const r = rewardItem({ name: "Bone", rarity: "common" });
    expect(r.name).toBe("Bone");
    expect(r.rarityKey).toBe("common");
  });

  it("reads the several spellings of very rare as one key", () => {
    // The essence table says veryRare, manufacturing says "very rare". A
    // miss here silently paints a legendary drop in common grey.
    for (const spelling of ["veryRare", "very rare", "VERY RARE"]) {
      expect(rewardItem({ name: "x", rarity: spelling }).rarityKey, spelling).toBe("veryrare");
    }
  });

  it("falls back to common rather than an unstyled frame", () => {
    expect(rewardItem({ name: "x" }).rarityKey).toBe("common");
    expect(rewardItem({ name: "x", rarity: "mythical" }).rarityKey).toBe("common");
  });

  it("hides a quantity of one — the tile already means one", () => {
    expect(rewardItem({ name: "x", quantity: 1 }).quantity).toBeNull();
    expect(rewardItem({ name: "x" }).quantity).toBeNull();
    expect(rewardItem({ name: "x", quantity: 4 }).quantity).toBe(4);
  });

  it("gives a missing icon a fallback, so a gap is still a tile", () => {
    expect(rewardItem({ name: "x" }).img).toMatch(/^icons\//);
  });

  it("puts everything worth knowing in the tooltip, keeping the name short", () => {
    const r = rewardItem({ name: "Breath Sac", rarity: "veryRare", detail: "DC 25" });
    expect(r.name).toBe("Breath Sac");
    expect(r.tooltip).toContain("Breath Sac");
    expect(r.tooltip).toContain("DC 25");
  });

  it("survives nothing", () => {
    expect(rewardItem(null)).toBeNull();
  });
});

describe("rewardData", () => {
  it("shapes every item it is handed", () => {
    const d = rewardData({ items: [{ name: "a" }, { name: "b" }] });
    expect(d.items.map(i => i.name)).toEqual(["a", "b"]);
  });

  it("drops anything unshapeable rather than rendering a hole", () => {
    expect(rewardData({ items: [{ name: "a" }, null, undefined] }).items).toHaveLength(1);
  });

  it("says so plainly when nothing came away", () => {
    // A failed harvest is a result too, and deserves a sentence rather than
    // an empty frame.
    const d = rewardData({ items: [] });
    expect(d.items).toEqual([]);
    expect(d.emptyLabel.length).toBeGreaterThan(10);
  });

  it("carries the title, subtitle and flavour through", () => {
    const d = rewardData({ title: "Harvested", subtitle: "Dragon · CR 14", flavour: "Three cuts." });
    expect(d).toMatchObject({ title: "Harvested", subtitle: "Dragon · CR 14", flavour: "Three cuts." });
  });

  it("defaults to something sayable with no arguments at all", () => {
    const d = rewardData();
    expect(d.title).toBeTruthy();
    expect(d.acceptLabel).toBeTruthy();
    expect(d.items).toEqual([]);
  });

  it("drops empty notes rather than rendering blank lines", () => {
    expect(rewardData({ notes: ["real", "", null] }).notes).toEqual(["real"]);
  });
});
