import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import Handlebars from "handlebars";
import { CraftPanel } from "../src/craft/panel.js";
import { HUB_TABS } from "../src/data/hub-tabs.js";

// A broken template does not fail the build, it fails silently in Foundry
// with an empty panel and a console trace nobody is watching. These tests
// compile and render the real templates against real panel data, so a typo
// in a field name or a malformed block is caught here instead of at a table.

const TEMPLATES = [
  "templates/hub.html",
  "templates/panels/harvest.html",
  "templates/panels/crafting.html",
  "templates/panels/enchanting.html"
];

beforeAll(() => {
  Handlebars.registerHelper("eq", (a, b) => a === b);
});

describe("templates compile", () => {
  it.each(TEMPLATES)("%s is valid Handlebars", path => {
    const source = fs.readFileSync(path, "utf8");
    expect(() => Handlebars.compile(source)).not.toThrow();
  });

  it("no template references a partial the hub never registers", () => {
    const index = fs.readFileSync("index.js", "utf8");
    for (const path of TEMPLATES) {
      const used = [...fs.readFileSync(path, "utf8").matchAll(/\{\{>\s*([\w-]+)/g)].map(m => m[1]);
      for (const name of used) {
        expect(index, `"${name}" is used in ${path} but never registered`).toContain(name);
      }
    }
  });
});

describe("crafting panel renders", () => {
  const render = data => {
    const tpl = Handlebars.compile(fs.readFileSync("templates/panels/crafting.html", "utf8"));
    return tpl(data);
  };

  const crafter = (parts = []) => ({
    abilities: { str: 3, dex: 2, con: 1, int: 4 },
    tools: ["Smith's tools", "Alchemist's supplies"],
    proficiency: 3,
    parts
  });

  it("renders the catalogue with nobody at the bench", () => {
    const html = render(new CraftPanel().getData(null));
    expect(html).toContain("Armour");
    expect(html).toContain("Potion of Healing");
  });

  it("states the requirement rather than a shortfall when no one is assigned", () => {
    const panel = new CraftPanel();
    panel.recipe = "Plate";
    const html = render(panel.getData(null));
    expect(html).toContain("Structural or Fibrous");
    expect(html).toContain("Assign a harvester");
    expect(html).not.toContain("Short by");
  });

  it("shows the shortfall once someone is at the bench empty-handed", () => {
    const panel = new CraftPanel();
    panel.recipe = "Plate";
    const html = render(panel.getData(crafter([])));
    expect(html).toContain("Short by");
    expect(html).toContain("No reagents on hand");
  });

  it("renders a build made of the parts the source books describe", () => {
    const panel = new CraftPanel();
    panel.recipe = "Plate";
    const html = render(panel.getData(crafter([
      { name: "Chitin", dc: 20, creatureType: "monstrosity", stamped: true },
      { name: "Hide", dc: 20, creatureType: "aberration", stamped: true }
    ])));
    expect(html).toContain("Chitin");
    expect(html).not.toContain("Short by");
    expect(html).not.toContain("No reagents on hand");
  });

  it("flags an unlabelled part so the player knows they may be owed more", () => {
    const panel = new CraftPanel();
    panel.recipe = "Dagger";
    const html = render(panel.getData(crafter([{ name: "Talon" }])));
    expect(html).toContain("Talon");
    expect(html).toContain("Unlabelled");
  });

  it("renders the alchemy bench", () => {
    const panel = new CraftPanel();
    panel.mode = "alchemy";
    panel.bench = ["Wild Sageroot", "Mandrake Root"];
    const html = render(panel.getData(crafter()));
    expect(html).toContain("Wild Sageroot");
    expect(html).toContain("Alchemy Attempt");
  });

  it("leaves no unresolved mustaches behind", () => {
    const panel = new CraftPanel();
    panel.recipe = "Longsword";
    const html = render(panel.getData(crafter([{ name: "Bone", dc: 15 }])));
    expect(html).not.toMatch(/\{\{/);
  });
});

describe("hub shell renders", () => {
  it("draws every tab with its badge and the active panel", () => {
    const hubSrc = fs.readFileSync("templates/hub.html", "utf8");
    for (const tab of HUB_TABS) {
      Handlebars.registerPartial(
        `rnr${tab.id[0].toUpperCase()}${tab.id.slice(1)}Panel`,
        fs.readFileSync(`templates/panels/${tab.id}.html`, "utf8")
      );
    }

    const panel = new CraftPanel();
    const html = Handlebars.compile(hubSrc)({
      ...panel.getData(null),
      activeTab: "crafting",
      tabs: HUB_TABS.map(t => ({ ...t, active: t.id === "crafting" }))
    });

    expect(html).toContain("Harvest");
    expect(html).toContain("Reference");   // crafting's status badge
    expect(html).toContain("Planned");     // enchanting's
    expect(html).not.toMatch(/\{\{/);
  });
});
