import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { HUB_TABS, HUB_TAB_IDS, DEFAULT_TAB, resolveTab } from "../src/data/hub-tabs.js";

// ─── Structure ────────────────────────────────────────────────────────────────

describe("HUB_TABS — structure", () => {
  it("defines the three systems", () => {
    expect(HUB_TABS.map(t => t.id)).toEqual(["harvest", "crafting", "enchanting"]);
  });

  it("every tab has an id, label, icon, hint and status", () => {
    for (const tab of HUB_TABS) {
      for (const field of ["id", "label", "icon", "hint", "status"]) {
        expect(typeof tab[field], `"${tab.id}" is missing ${field}`).toBe("string");
        expect(tab[field].trim().length, `"${tab.id}" has an empty ${field}`).toBeGreaterThan(0);
      }
      expect(["live", "partial", "planned"], `"${tab.id}" has odd status`).toContain(tab.status);
      expect(typeof tab.locked, `"${tab.id}" is missing locked`).toBe("boolean");
    }
  });

  it("locked is derived from status, so the two cannot disagree", () => {
    for (const tab of HUB_TABS) {
      expect(tab.locked, `"${tab.id}"`).toBe(tab.status !== "live");
    }
  });

  it("ids are unique", () => {
    expect(HUB_TAB_IDS.size).toBe(HUB_TABS.length);
  });

  it("all three systems roll, spend and grant", () => {
    // Phase 5 landed; nothing in the hub is a placeholder any more. The
    // three-state model stays because Phase 6 will need `partial` again.
    for (const tab of HUB_TABS) {
      expect(tab.status, `"${tab.id}"`).toBe("live");
      expect(tab.locked, `"${tab.id}"`).toBe(false);
    }
  });
});

// ─── Icons ────────────────────────────────────────────────────────────────────

describe("HUB_TABS — icons", () => {
  it("uses Foundry core assets, never bundled or remote art", () => {
    // Core paths resolve in every install; a bundled path would need shipping
    // and a remote one would 404 behind a firewall.
    for (const tab of HUB_TABS) {
      expect(tab.icon, `"${tab.id}" icon should be a core asset`).toMatch(/^icons\//);
      expect(tab.icon, `"${tab.id}" icon should not be remote`).not.toMatch(/^https?:/);
    }
  });

  it("icon paths are the ones specified for each system", () => {
    const byId = Object.fromEntries(HUB_TABS.map(t => [t.id, t.icon]));
    expect(byId.harvest).toBe("icons/tools/cooking/knife-cleaver-steel-grey.webp");
    expect(byId.crafting).toBe("icons/skills/trades/academics-merchant-scribe.webp");
    expect(byId.enchanting).toBe("icons/skills/trades/academics-book-study-purple.webp");
  });

  it("each tab has a distinct icon", () => {
    const icons = HUB_TABS.map(t => t.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });
});

// ─── resolveTab ───────────────────────────────────────────────────────────────

describe("resolveTab", () => {
  it("passes through a known tab", () => {
    expect(resolveTab("crafting")).toBe("crafting");
  });

  it("falls back to harvest for an unknown tab", () => {
    expect(resolveTab("smithing")).toBe(DEFAULT_TAB);
  });

  it("falls back for undefined and null", () => {
    expect(resolveTab()).toBe(DEFAULT_TAB);
    expect(resolveTab(null)).toBe(DEFAULT_TAB);
  });

  it("honours a caller-supplied fallback", () => {
    expect(resolveTab(undefined, "enchanting")).toBe("enchanting");
  });

  it("ignores an invalid fallback rather than returning it", () => {
    expect(resolveTab("nope", "also-nope")).toBe(DEFAULT_TAB);
  });
});

// ─── Panel wiring ─────────────────────────────────────────────────────────────

describe("hub panels", () => {
  const hub = fs.readFileSync("templates/hub.html", "utf8");

  it("every tab has a panel template on disk", () => {
    for (const tab of HUB_TABS) {
      const path = `templates/panels/${tab.id}.html`;
      expect(fs.existsSync(path), `missing ${path}`).toBe(true);
    }
  });

  it("the hub template renders a partial for every tab", () => {
    for (const tab of HUB_TABS) {
      expect(hub, `hub.html has no branch for "${tab.id}"`).toContain(`"${tab.id}"`);
    }
  });

  it("every partial the hub uses is registered in index.js", () => {
    const used = [...hub.matchAll(/\{\{>\s*(\w+)\s*\}\}/g)].map(m => m[1]);
    const index = fs.readFileSync("index.js", "utf8");
    expect(used.length).toBeGreaterThan(0);
    for (const name of used) {
      expect(index, `partial "${name}" is used but never registered`).toContain(name);
    }
  });

  it("unfinished panels say where they stop, rather than looking broken", () => {
    // A panel that silently does less than it appears to is worse than one
    // that names its own limit, so every non-live panel must carry a status
    // note. The wording differs — "planned" and "reference only" are not the
    // same promise — so this checks for the marker class, not a phrase.
    for (const tab of HUB_TABS.filter(t => t.status !== "live")) {
      const body = fs.readFileSync(`templates/panels/${tab.id}.html`, "utf8");
      expect(body, `"${tab.id}" panel is missing its status note`).toContain("rnr-status");
    }
  });
});
