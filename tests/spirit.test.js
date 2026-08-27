import { describe, it, expect, afterEach } from "vitest";
import {
  SPIRIT_ABILITIES, SPIRIT_TIERS, SPIRIT_AWAKEN, SPIRIT_FINAL, SPIRIT_TOTAL,
  SPIRIT_DEEDS, REMNANT_SPIRIT_VALUE
} from "../src/data/spirit.js";
import { REMNANT_TIERS } from "../src/data/enchanting.js";
import {
  spiritState, canUnlock, unlockPatch, earnPatch, abilityCost, getAbility,
  remnantValue, spendRemnantPatch, canStillEnchant, abilityLadder,
  registerSpiritAbilities, clearSpiritAbilities, allAbilities
} from "../src/enchant/spirit.js";

const MODULE_ID = "runes-and-remnants";

const blade = (earned = 0, unlocked = [], remnantSpent = false) => ({
  name: "Ancestral Blade",
  type: "weapon",
  flags: { [MODULE_ID]: { spirit: { ancestral: true, earned, unlocked, remnantSpent } } }
});

// ─── The ladder ───────────────────────────────────────────────────────────────

describe("the ability ladder", () => {
  it("fits inside a weapon's whole budget without being trivially fillable", () => {
    // 25 points should buy a real selection, not everything and not one thing.
    const cheapest = Math.min(...SPIRIT_ABILITIES.map(abilityCost));
    const total = SPIRIT_ABILITIES.reduce((n, a) => n + abilityCost(a), 0);
    expect(cheapest).toBeLessThanOrEqual(SPIRIT_TOTAL);
    expect(total, "the whole ladder fits in one weapon — no choice to make")
      .toBeGreaterThan(SPIRIT_TOTAL);
  });

  it("awakening plus the final points is the whole budget", () => {
    expect(SPIRIT_AWAKEN + SPIRIT_FINAL).toBe(SPIRIT_TOTAL);
  });

  it("every ability names a known tier and something it does", () => {
    for (const a of SPIRIT_ABILITIES) {
      expect(SPIRIT_TIERS, `"${a.name}" has an unknown tier`).toHaveProperty(a.tier);
      expect(a.effect.length, `"${a.name}" has no effect text`).toBeGreaterThan(10);
      expect(abilityCost(a), `"${a.name}" is free`).toBeGreaterThan(0);
    }
  });

  it("costs climb with tier", () => {
    const order = ["lesser", "greater", "major", "apex"];
    for (let i = 1; i < order.length; i++) {
      expect(SPIRIT_TIERS[order[i]].cost).toBeGreaterThan(SPIRIT_TIERS[order[i - 1]].cost);
    }
  });

  it("every prerequisite is an ability that exists", () => {
    // A requirement pointing at nothing is a permanently locked branch.
    const names = new Set(SPIRIT_ABILITIES.map(a => a.name.toLowerCase()));
    for (const a of SPIRIT_ABILITIES.filter(a => a.requires)) {
      expect(names.has(a.requires.toLowerCase()), `"${a.name}" requires a missing "${a.requires}"`)
        .toBe(true);
    }
  });

  it("no prerequisite chain costs more than a weapon can hold", () => {
    const by = Object.fromEntries(SPIRIT_ABILITIES.map(a => [a.name.toLowerCase(), a]));
    for (const a of SPIRIT_ABILITIES) {
      let total = 0;
      let node = a;
      const seen = new Set();
      while (node && !seen.has(node.name)) {
        seen.add(node.name);
        total += abilityCost(node);
        node = node.requires ? by[node.requires.toLowerCase()] : null;
      }
      expect(total, `"${a.name}" and its prerequisites cost ${total}, over the ${SPIRIT_TOTAL} cap`)
        .toBeLessThanOrEqual(SPIRIT_TOTAL);
    }
  });

  it("names deeds rather than drops — points cannot be farmed", () => {
    expect(SPIRIT_DEEDS.length).toBeGreaterThan(2);
    for (const d of SPIRIT_DEEDS) expect(d.length).toBeGreaterThan(15);
  });
});

// ─── spiritState ──────────────────────────────────────────────────────────────

describe("spiritState", () => {
  it("adds up what has been spent from what is unlocked", () => {
    const s = spiritState(blade(10, ["Whetted", "Keen Spirit"]));   // 1 + 3
    expect(s.spent).toBe(4);
    expect(s.available).toBe(6);
  });

  it("awakens on points EARNED, not points left", () => {
    // A weapon carried through twenty points of deeds has woken whether or
    // not its wielder has spent them.
    expect(spiritState(blade(SPIRIT_AWAKEN, ["Whetted"])).awakened).toBe(true);
    expect(spiritState(blade(SPIRIT_AWAKEN - 1)).awakened).toBe(false);
  });

  it("counts down to awakening and to finished", () => {
    const s = spiritState(blade(6));
    expect(s.toAwaken).toBe(SPIRIT_AWAKEN - 6);
    expect(s.toFinish).toBe(SPIRIT_TOTAL - 6);
  });

  it("reads a plain item as no ancestral weapon at all", () => {
    const s = spiritState({ name: "Longsword", type: "weapon" });
    expect(s.isAncestral).toBe(false);
    expect(s.earned).toBe(0);
    expect(s.unlocked).toEqual([]);
  });

  it("survives nothing", () => {
    expect(() => spiritState(null)).not.toThrow();
  });
});

// ─── canUnlock ────────────────────────────────────────────────────────────────

describe("canUnlock", () => {
  it("allows an affordable ability with its path met", () => {
    expect(canUnlock("Keen Spirit", blade(10, ["Whetted"])).ok).toBe(true);
  });

  it("refuses what cannot be afforded, and says by how much", () => {
    const check = canUnlock("Soulrend", blade(2));
    expect(check.ok).toBe(false);
    expect(check.reasons.join(" ")).toMatch(/Needs 8 spirit points; 2 available/);
  });

  it("holds an ability behind its prerequisite", () => {
    expect(canUnlock("Keen Spirit", blade(20)).reasons.join(" ")).toMatch(/Whetted must come first/);
  });

  it("holds apex abilities behind awakening", () => {
    const check = canUnlock("Ancestral Voice", blade(10));
    expect(check.reasons.join(" ")).toMatch(/must awaken first — 10 more points/);
  });

  it("refuses to unlock the same ability twice", () => {
    expect(canUnlock("Whetted", blade(10, ["Whetted"])).reasons.join(" "))
      .toMatch(/already awakened/i);
  });

  it("refuses an ability the item cannot hold", () => {
    const armour = { name: "Plate", type: "equipment", system: { armor: { type: "heavy" } },
                     flags: { [MODULE_ID]: { spirit: { earned: 20, unlocked: [] } } } };
    expect(canUnlock("Whetted", armour).reasons.join(" ")).toMatch(/cannot take hold in armour/);
  });

  it("will not let a weapon exceed what it can hold in total", () => {
    // Earned is capped, but a house-ruled award could still overshoot.
    const stuffed = blade(99, ["Whetted", "Keen Spirit", "Spiritstrike", "Devouring",
                               "Kinbane", "Bloodscent", "Guardian", "Warding Spirit"]);
    const check = canUnlock("Soulrend", stuffed);
    expect(check.reasons.join(" ")).toMatch(new RegExp(`holds ${SPIRIT_TOTAL} points in all`));
  });

  it("gives every reason at once, not the first", () => {
    const check = canUnlock("Soulrend", blade(0));
    expect(check.reasons.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── patches ──────────────────────────────────────────────────────────────────

describe("patches", () => {
  it("unlocking adds the ability and keeps the rest", () => {
    const patch = unlockPatch("Whetted", blade(5, ["Bonded"]));
    const spirit = patch[`flags.${MODULE_ID}.spirit`];
    expect(spirit.unlocked).toEqual(["Bonded", "Whetted"]);
    expect(spirit.earned).toBe(5);
  });

  it("refuses to produce a patch for something it would not allow", () => {
    // A caller must not be able to apply a change canUnlock rejected.
    expect(unlockPatch("Soulrend", blade(1))).toBeNull();
  });

  it("earning adds points and marks the weapon ancestral", () => {
    const spirit = earnPatch(blade(3), 4)[`flags.${MODULE_ID}.spirit`];
    expect(spirit.earned).toBe(7);
    expect(spirit.ancestral).toBe(true);
  });

  it("earning cannot carry a weapon past what it holds", () => {
    const spirit = earnPatch(blade(24), 50)[`flags.${MODULE_ID}.spirit`];
    expect(spirit.earned).toBe(SPIRIT_TOTAL);
  });

  it("earning nothing is harmless", () => {
    expect(earnPatch(blade(5), 0)[`flags.${MODULE_ID}.spirit`].earned).toBe(5);
  });
});

// ─── the one-way door ─────────────────────────────────────────────────────────

describe("spending a remnant for points", () => {
  it("values a remnant by its tier", () => {
    expect(remnantValue("Essence (Frail)")).toBe(REMNANT_SPIRIT_VALUE.Frail);
    expect(remnantValue("Essence (Deific)")).toBe(REMNANT_SPIRIT_VALUE.Deific);
  });

  it("values every remnant tier the harvest table can drop", () => {
    for (const tier of REMNANT_TIERS.filter(t => t.remnant)) {
      expect(REMNANT_SPIRIT_VALUE[tier.remnant], `"${tier.remnant}" is worth nothing`)
        .toBeGreaterThan(0);
    }
  });

  it("is worth nothing for something that is not a remnant", () => {
    expect(remnantValue("Heart")).toBe(0);
    expect(spendRemnantPatch(blade(0), "Heart")).toBeNull();
  });

  it("closes the door on enchanting, in the same patch", () => {
    // Forgetting this silently would be the worst kind of bug — the player
    // would only find out much later, with no way back.
    const spirit = spendRemnantPatch(blade(2), "Essence (Potent)")[`flags.${MODULE_ID}.spirit`];
    expect(spirit.earned).toBe(2 + REMNANT_SPIRIT_VALUE.Potent);
    expect(spirit.remnantSpent).toBe(true);
  });

  it("a weapon that has taken a remnant can never be enchanted again", () => {
    expect(canStillEnchant(blade(5))).toBe(true);
    expect(canStillEnchant(blade(5, [], true))).toBe(false);
  });

  it("no remnant alone can awaken a weapon", () => {
    // Deeds have to do most of the work, or the whole currency is farmable.
    const best = Math.max(...Object.values(REMNANT_SPIRIT_VALUE));
    expect(best).toBeLessThan(SPIRIT_AWAKEN);
  });
});

// ─── the ladder, shaped for the panel ─────────────────────────────────────────

describe("abilityLadder", () => {
  it("groups by tier, cheapest first", () => {
    const ladder = abilityLadder(blade(10, ["Whetted"]));
    expect(ladder.map(g => g.tier)).toEqual(["lesser", "greater", "major", "apex"]);
    expect(ladder[0].cost).toBeLessThan(ladder[3].cost);
  });

  it("marks what is unlocked, what is affordable, and why not", () => {
    // 5 earned less the 1 already spent on Whetted leaves 4 — enough for a
    // greater ability, nowhere near an apex one.
    const ladder = abilityLadder(blade(5, ["Whetted"]));
    const flat = ladder.flatMap(g => g.items);
    expect(flat.find(a => a.name === "Whetted").unlocked).toBe(true);
    expect(flat.find(a => a.name === "Keen Spirit").available).toBe(true);
    const apex = flat.find(a => a.name === "Ancestral Voice");
    expect(apex.available).toBe(false);
    expect(apex.reason).toBeTruthy();
  });
});

// ─── replacing the ladder ─────────────────────────────────────────────────────

describe("registering a table's own abilities", () => {
  afterEach(() => clearSpiritAbilities());

  it("ships nothing third-party by default", () => {
    expect(allAbilities()).toHaveLength(SPIRIT_ABILITIES.length);
  });

  it("adds a table's own, keeping the shipped ones", () => {
    registerSpiritAbilities([{ name: "Hearthfire", tier: "lesser", kinds: ["weapon"], effect: "Warm." }]);
    expect(getAbility("Hearthfire")).toBeTruthy();
    expect(getAbility("Whetted")).toBeTruthy();
  });

  it("replaces the whole ladder when asked", () => {
    // A table with the book puts the real costs in and drops this module's
    // invented scale entirely.
    registerSpiritAbilities([{ name: "Only This", tier: "lesser", kinds: ["weapon"], effect: "Just it." }],
      { replace: true });
    expect(allAbilities()).toHaveLength(SPIRIT_ABILITIES.length + 1);
    registerSpiritAbilities([{ name: "Whetted", tier: "major", kinds: ["weapon"], effect: "Redefined." }],
      { replace: true });
    expect(abilityCost("Whetted")).toBe(SPIRIT_TIERS.major.cost);
  });

  it("honours an explicit cost over its tier's", () => {
    registerSpiritAbilities([{ name: "Odd", tier: "lesser", cost: 7, kinds: ["weapon"], effect: "Costly." }]);
    expect(abilityCost("Odd")).toBe(7);
  });

  it("ignores entries with no name or no tier", () => {
    expect(registerSpiritAbilities([{ name: "No tier" }, { tier: "lesser" }, null])).toBe(0);
  });
});
