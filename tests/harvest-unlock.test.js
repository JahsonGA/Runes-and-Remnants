import { describe, it, expect } from "vitest";
import { getUnlockedMaterials, harvestOutcome, getEssenceByCR } from "../src/harvest/logic.js";

// ─── getUnlockedMaterials — tier gating ───────────────────────────────────────

describe("getUnlockedMaterials — tier gating", () => {
  it("unlocks nothing below the first tier DC", () => {
    const r = getUnlockedMaterials("beast", 19, 1);
    expect(r.unlockedCount).toBe(0);
    expect(r.names).toEqual([]);
  });

  it("unlocks the first tier exactly at its DC", () => {
    const r = getUnlockedMaterials("beast", 20, 1);
    expect(r.unlockedCount).toBe(1);
    expect(r.names).toContain("Hide");
    expect(r.names).not.toContain("Marrow"); // DC 40
  });

  it("is additive — a DC 30 total also grants the DC 20 tier", () => {
    const r = getUnlockedMaterials("beast", 30, 1);
    expect(r.unlockedCount).toBe(2);
    expect(r.names).toContain("Hide");  // DC 20
    expect(r.names).toContain("Heart"); // DC 30
  });

  it("unlocks every tier at a high total", () => {
    const r = getUnlockedMaterials("beast", 45, 1);
    expect(r.unlockedCount).toBe(r.tierCount);
    expect(r.names).toContain("Marrow"); // DC 40
  });

  it("returns no duplicate names", () => {
    const r = getUnlockedMaterials("undead", 50, 20);
    expect(new Set(r.names).size).toBe(r.names.length);
  });

  it("falls back to the 'other' table for unknown creature types", () => {
    const unknown = getUnlockedMaterials("swarm-of-wasps", 30, 1);
    const other   = getUnlockedMaterials("other", 30, 1);
    expect(unknown.names).toEqual(other.names);
  });
});

// ─── getUnlockedMaterials — essence gating ────────────────────────────────────

describe("getUnlockedMaterials — essence gating", () => {
  it("withholds essence below its CR-scaled DC", () => {
    const essence = getEssenceByCR(20); // Essence (Mythic), DC 40
    const r = getUnlockedMaterials("dragon", essence.dc - 1, 20);
    expect(r.essenceUnlocked).toBe(false);
    expect(r.names).not.toContain(essence.name);
  });

  it("grants essence at exactly its DC", () => {
    const essence = getEssenceByCR(20);
    const r = getUnlockedMaterials("dragon", essence.dc, 20);
    expect(r.essenceUnlocked).toBe(true);
    expect(r.names).toContain(essence.name);
  });

  it("a Deific Essence (DC 50) stays out of reach of a mid total", () => {
    const r = getUnlockedMaterials("fiend", 40, 30);
    expect(r.essence.name).toBe("Essence (Deific)");
    expect(r.essenceUnlocked).toBe(false);
  });

  it("essence is selected by CR, not by creature type", () => {
    const a = getUnlockedMaterials("beast", 0, 8).essence.name;
    const b = getUnlockedMaterials("dragon", 0, 8).essence.name;
    expect(a).toBe(b);
    expect(a).toBe("Essence (Robust)");
  });

  it("essence can be unlocked even when no material tier is met", () => {
    // Low-CR fallback essence sits at DC 20, the same as tier one.
    const r = getUnlockedMaterials("beast", 20, 0);
    expect(r.essenceUnlocked).toBe(true);
    expect(r.names).toContain("Essence (Frail)");
  });
});

// ─── Essence DC calibration ───────────────────────────────────────────────────

describe("ESSENCE_TABLE calibration", () => {
  it("essence DCs rise with CR", () => {
    const dcs = [1, 4, 8, 14, 20, 30].map(cr => getEssenceByCR(cr).dc);
    for (let i = 1; i < dcs.length; i++) {
      expect(dcs[i], `essence DC fell at index ${i}: ${dcs}`).toBeGreaterThanOrEqual(dcs[i - 1]);
    }
  });

  it("essence DCs sit inside the reachable combined-total band", () => {
    // Combined total spans roughly 12–58; anything above that is unobtainable.
    for (const cr of [0, 5, 10, 15, 20, 25, 40]) {
      const { dc } = getEssenceByCR(cr);
      expect(dc).toBeGreaterThanOrEqual(20);
      expect(dc).toBeLessThanOrEqual(50);
    }
  });
});

// ─── harvestOutcome ───────────────────────────────────────────────────────────

describe("harvestOutcome", () => {
  it("no tiers unlocked is a failure", () => {
    expect(harvestOutcome(0, 3)).toBe("failure");
  });

  it("one tier of several is partial", () => {
    expect(harvestOutcome(1, 3)).toBe("partial");
  });

  it("some but not all tiers is a success", () => {
    expect(harvestOutcome(2, 3)).toBe("success");
  });

  it("every tier is a critical success", () => {
    expect(harvestOutcome(3, 3)).toBe("critical-success");
  });

  it("treats negative counts as failure", () => {
    expect(harvestOutcome(-1, 3)).toBe("failure");
  });
});
