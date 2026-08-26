import { describe, it, expect } from "vitest";
import {
  formatHours, formatCost, craftSummary, alchemySummary, enchantSummary, summaryToHtml
} from "../src/craft/summary.js";
import { getRecipe, planManufacture, selectReagents, analyseConcoction } from "../src/craft/logic.js";
import { enchantPlan } from "../src/enchant/logic.js";
import { NEAR_MISS } from "../src/craft/outcome.js";

const crafter = (parts = []) => ({
  abilities: { str: 3, dex: 2, con: 1, int: 4 },
  tools: ["Smith's tools", "Leatherworker's tools"],
  proficiency: 3,
  parts
});

// ─── formatHours ──────────────────────────────────────────────────────────────

describe("formatHours", () => {
  it("leaves a short job in hours", () => {
    expect(formatHours(2)).toBe("2 hours");
    expect(formatHours(1)).toBe("1 hour");
  });

  it("turns a long job into days", () => {
    // "160 hours" tells nobody whether that is an evening or a season.
    expect(formatHours(40)).toMatch(/5 days/);
  });

  it("turns a very long job into workweeks", () => {
    expect(formatHours(160)).toMatch(/4 workweeks/);
    expect(formatHours(640)).toMatch(/16 workweeks/);
  });

  it("turns the artifact tier into years, because it is", () => {
    // 100,000 hours is the artifact line on the remnant table. Printing it
    // raw would read as a typo rather than as a statement of intent.
    expect(formatHours(100000)).toMatch(/years/);
  });

  it("always keeps the raw hour count alongside", () => {
    for (const h of [40, 160, 640, 100000]) {
      expect(formatHours(h), `${h}`).toContain(String(h));
    }
  });

  it("handles nothing at all", () => {
    expect(formatHours(0)).toBe("no time at all");
    expect(formatHours(null)).toBe("no time at all");
  });
});

// ─── formatCost ───────────────────────────────────────────────────────────────

describe("formatCost", () => {
  it("says the gp figure is paid in parts, not coin", () => {
    // The house rule replaced gold with monster parts; a bare "3 gp" would
    // read as a price the party has to find.
    expect(formatCost(getRecipe("Leather"))).toMatch(/monster parts, not coin/);
    expect(formatCost(getRecipe("Leather"))).toContain("3");
  });

  it("defers to the GM where the book gives no figure", () => {
    expect(formatCost(getRecipe("Wondrous item"))).toBe("the GM's call");
  });
});

// ─── craftSummary ─────────────────────────────────────────────────────────────

describe("craftSummary", () => {
  const build = (name, parts) => {
    const recipe = getRecipe(name);
    const who = crafter(parts);
    return craftSummary({
      recipe,
      plan: planManufacture(recipe, who, parts),
      selection: selectReagents(recipe, parts)
    });
  };

  it("names the item in the question", () => {
    const s = build("Leather", [{ name: "Hide", dc: 20, id: "h" }]);
    expect(s.title).toBe("Craft Leather?");
  });

  it("states the check, the tool, the time and the cost", () => {
    const s = build("Leather", [{ name: "Hide", dc: 20, id: "h" }]);
    const labels = s.rows.map(r => r.label);
    expect(labels).toEqual(["Check", "Tool", "Time", "Materials"]);
    expect(s.rows[2].value).toContain("16");         // Leather is 16 hours
  });

  it("lists exactly what leaves the pack — not everything that matched", () => {
    // The player is agreeing to a cost, so it must be the real one.
    const parts = [
      { name: "Hide", dc: 20, id: "a" },
      { name: "Chitin", dc: 20, id: "b" },
      { name: "Bone", dc: 15, id: "c" }
    ];
    const s = build("Leather", parts);          // needs 3 potency; one part covers it
    expect(s.consumed.length).toBe(1);
  });

  it("counts repeats rather than listing them one by one", () => {
    const s = build("Plate", [{ name: "Bone", dc: 15, id: "stack", quantity: 4 }]);
    expect(s.consumed).toEqual(["Bone ×2"]);
  });

  it("states the actual rule about losing them, not a vague maybe", () => {
    // Whether a near miss costs the materials decides whether a player
    // attempts something above their level.
    const s = build("Leather", [{ name: "Hide", dc: 20, id: "h" }]);
    expect(s.warning).toContain(String(NEAR_MISS));
    expect(s.warning).toMatch(/near miss costs only the time/i);
  });

  it("warns about disadvantage when the tool is unfamiliar", () => {
    const recipe = getRecipe("Potion of Healing");     // alchemy tools
    const who = crafter([{ name: "Phial of Blood", dc: 5, id: "p" }]);
    const s = craftSummary({
      recipe,
      plan: planManufacture(recipe, who, who.parts),
      selection: selectReagents(recipe, who.parts)
    });
    expect(s.rows[0].value).toMatch(/disadvantage/);
    expect(s.notes.join(" ")).toMatch(/rolled twice and the worse kept/);
  });

  it("says nothing leaves the pack when nothing does", () => {
    const s = craftSummary({
      recipe: { name: "Odd", category: "Clockwork", tools: [], dc: 12, hours: 1 },
      plan: { bonus: 0, dc: 12, hours: 1, tool: null, disadvantage: false },
      selection: { parts: [] }
    });
    expect(s.consumed).toEqual([]);
    expect(s.warning).toBeNull();
  });

  it("returns nothing when there is nothing to summarise", () => {
    expect(craftSummary({})).toBeNull();
    expect(craftSummary()).toBeNull();
  });
});

// ─── alchemySummary ───────────────────────────────────────────────────────────

describe("alchemySummary", () => {
  const bench = ["Wild Sageroot", "Milkweed Seeds"];
  const summary = () => alchemySummary({ concoction: analyseConcoction(bench), bench, bonus: 7 });

  it("shows the DC the ingredients add up to", () => {
    expect(summary().rows[0].value).toContain(String(analyseConcoction(bench).dc));
  });

  it("lists the ingredients going in", () => {
    expect(summary().consumed).toEqual(bench);
  });

  it("admits that alchemy stock is not deducted yet", () => {
    // Better said here than discovered when a stock never goes down.
    expect(summary().notes.join(" ")).toMatch(/by hand/i);
  });
});

// ─── enchantSummary ───────────────────────────────────────────────────────────

describe("enchantSummary", () => {
  const plan = () => enchantPlan({
    enchantment: "Keen",
    item: { name: "Longsword", type: "weapon" },
    remnant: { name: "Essence (Potent)", creatureType: "dragon" },
    component: { name: "Pouch of Teeth" },
    caster: { ability: "int", abilityMod: 4, skills: ["Survival"], proficiency: 3, isCaster: true }
  });

  it("names both the enchantment and the item", () => {
    expect(enchantSummary({ plan: plan() }).title).toBe("Bind Keen into Longsword?");
  });

  it("leads with the fact the materials go whatever the roll", () => {
    // The single most important thing to have agreed to before clicking.
    expect(enchantSummary({ plan: plan() }).warning).toMatch(/whatever the roll/i);
  });

  it("lists the remnant and the component", () => {
    expect(enchantSummary({ plan: plan() }).consumed)
      .toEqual(["Essence (Potent)", "Pouch of Teeth"]);
  });

  it("says when a stronger remnant raised the rarity", () => {
    const row = enchantSummary({ plan: plan() }).rows.find(r => r.label === "Result");
    expect(row.value).toMatch(/very rare/);
    expect(row.value).toMatch(/raised from uncommon/);
  });

  it("warns that the item can be destroyed outright", () => {
    expect(enchantSummary({ plan: plan() }).notes.join(" ")).toMatch(/destroyed/i);
  });

  it("refuses to summarise a plan that cannot go ahead", () => {
    const blocked = enchantPlan({ enchantment: "Keen" });
    expect(enchantSummary({ plan: blocked })).toBeNull();
  });
});

// ─── summaryToHtml ────────────────────────────────────────────────────────────

describe("summaryToHtml", () => {
  const s = () => craftSummary({
    recipe: getRecipe("Leather"),
    plan: planManufacture(getRecipe("Leather"), crafter(), [{ name: "Hide", dc: 20, id: "h" }]),
    selection: selectReagents(getRecipe("Leather"), [{ name: "Hide", dc: 20, id: "h" }])
  });

  it("renders every row and everything consumed", () => {
    const html = summaryToHtml(s());
    expect(html).toContain("Check");
    expect(html).toContain("Hide");
    expect(html).toContain("Leaves the pack");
  });

  it("escapes names it does not control", () => {
    // Item names come out of compendiums this module did not write.
    const html = summaryToHtml({
      kind: "craft", title: "x", rows: [{ label: "Check", value: "<script>bad()</script>" }],
      consumed: ['Bone" onerror="x'], warning: null, notes: []
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain('onerror="x');
  });

  it("survives nothing at all", () => {
    expect(summaryToHtml(null)).toBe("");
  });
});
