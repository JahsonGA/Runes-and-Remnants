import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { HARVEST_TABLE } from "../src/data/harvest-table.js";
import { ESSENCE_TABLE } from "../src/harvest/logic.js";

// Item NAMES are the join key between HARVEST_TABLE and the shipped compendium.
// These tests guard that contract — a rename on either side breaks harvesting
// silently at runtime, so it must break loudly here instead.

const items = fs
  .readFileSync("packs/harvest-items.db", "utf8")
  .split(/\r?\n/)
  .filter(Boolean)
  .map(line => JSON.parse(line));

const names = items.map(i => i.name);
const nameSet = new Set(names);

// ─── Pack integrity ───────────────────────────────────────────────────────────

describe("harvest-items pack — integrity", () => {
  it("every entry has a 16-character _id", () => {
    for (const i of items) {
      expect(typeof i._id, `"${i.name}" has no _id`).toBe("string");
      expect(i._id, `"${i.name}" has a malformed _id`).toMatch(/^[A-Za-z0-9]{16}$/);
    }
  });

  it("_id values are unique", () => {
    const ids = items.map(i => i._id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("item names are unique", () => {
    const dupes = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
    expect(dupes, `duplicate names: ${dupes.join(", ")}`).toEqual([]);
  });

  it("contains no world-item @UUID links", () => {
    // These would render as broken links in any world but the author's.
    for (const i of items) {
      const desc = i.system?.description?.value ?? "";
      expect(desc, `"${i.name}" links to a world item`).not.toMatch(/@UUID\[Item\./);
    }
  });

  it("every @UUID link resolves to an entry in this pack", () => {
    const ids = new Set(items.map(i => i._id));
    for (const i of items) {
      const desc = i.system?.description?.value ?? "";
      const links = [...desc.matchAll(
        /@UUID\[Compendium\.runes-and-remnants\.harvest-items\.Item\.([A-Za-z0-9]+)\]/g
      )];
      for (const [, id] of links) {
        expect(ids.has(id), `"${i.name}" links to unknown id ${id}`).toBe(true);
      }
    }
  });
});

// ─── Table ↔ pack contract ────────────────────────────────────────────────────

describe("HARVEST_TABLE ↔ pack", () => {
  it("every material named in the table exists in the pack", () => {
    const missing = [];
    for (const [type, tiers] of Object.entries(HARVEST_TABLE)) {
      for (const tier of tiers) {
        for (const item of tier.items) {
          if (!nameSet.has(item)) missing.push(`${type} DC${tier.dc}: ${item}`);
        }
      }
    }
    expect(missing, `missing from pack:\n${missing.join("\n")}`).toEqual([]);
  });

  it("every essence named in ESSENCE_TABLE exists in the pack", () => {
    for (const e of ESSENCE_TABLE) {
      expect(nameSet.has(e.name), `"${e.name}" missing from pack`).toBe(true);
    }
  });
});
