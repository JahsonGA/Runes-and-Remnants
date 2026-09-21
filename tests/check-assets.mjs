// scripts/check-assets.mjs
import fs from "fs";
import path from "path";

const REQUIRED = [
  "module.json",
  "index.js",
  "src/harvest/logic.js",
  "src/harvest/menu.js",
  "styles/module.css",
  "src/hub/hub.js",
  "src/craft/logic.js",
  "src/craft/panel.js",
  "src/craft/extras.js",
  "src/craft/outcome.js",
  "src/craft/execute.js",
  "src/enchant/logic.js",
  "src/enchant/panel.js",
  "src/enchant/execute.js",
  "src/enchant/spirit.js",
  "src/data/spirit.js",
  "src/craft/summary.js",
  "src/craft/grant.js",
  "src/craft/concoct.js",
  "src/data/alchemy-effects.js",
  "src/ui/confirm.js",
  "src/data/enchanting.js",
  "src/data/harvest-table.js",
  "src/data/hub-tabs.js",
  "src/data/manufacturing.js",
  "src/data/alchemy.js",
  "src/data/reagents.js",
  "templates/hub.html",
  "templates/panels/harvest.html",
  "templates/panels/crafting.html",
  "templates/panels/enchanting.html",
  "templates/partials/crafter.html"
];

let missing = [];

/**
 * ✅ Check that each required file exists
 */
for (const file of REQUIRED) {
  const exists = fs.existsSync(path.resolve(file));
  if (!exists) missing.push(file);
}

if (missing.length) {
  console.error("❌ Missing required files:");
  for (const file of missing) console.error("  -", file);
  process.exit(1);
} else {
  console.log("✅ All required module assets found.");
}

/**
 * ✅ Check the manifest for key fields
 */
try {
  const manifest = JSON.parse(fs.readFileSync("module.json", "utf8"));
  const requiredFields = ["id", "title", "version", "esmodules", "url"];
  const missingFields = requiredFields.filter(f => !manifest[f]);

  if (missingFields.length) {
    console.error("❌ Missing required fields in module.json:", missingFields.join(", "));
    process.exit(1);
  }

  /**
   * ✅ Every declared pack must actually be on disk.
   *
   * The manifest once declared `packs/alchemy-items.db` while the pack was a
   * LevelDB directory at `packs/alchemy-items`, and this guard stayed green
   * throughout — it validated the manifest's keys and never looked at what
   * they pointed at. A pack that does not load is silent at runtime: the
   * compendium simply is not there.
   */
  const badPacks = [];
  for (const pack of manifest.packs ?? []) {
    if (!pack.path) { badPacks.push(`${pack.name}: no path`); continue; }

    const full = path.resolve(pack.path);
    if (!fs.existsSync(full)) {
      // Name the likely cause rather than only the symptom.
      const asDir = fs.existsSync(full.replace(/\.db$/, ""));
      badPacks.push(`${pack.path} does not exist`
        + (asDir ? ` — but ${pack.path.replace(/\.db$/, "")} does; drop the .db` : ""));
      continue;
    }

    // Since v11 a pack is a LevelDB directory. A bare .db file is the legacy
    // NeDB format — Foundry still migrates it, but it should not be shipped
    // alongside the directory it migrates into.
    if (!fs.statSync(full).isDirectory()) {
      badPacks.push(`${pack.path} is a file; packs are LevelDB directories since v11`);
      continue;
    }
    if (!fs.existsSync(path.join(full, "CURRENT"))) {
      badPacks.push(`${pack.path} has no CURRENT — not a LevelDB pack`);
    }
  }

  if (badPacks.length) {
    console.error("❌ Packs declared in module.json that will not load:");
    for (const p of badPacks) console.error("  -", p);
    process.exit(1);
  }

  console.log(`✅ module.json validated successfully (${(manifest.packs ?? []).length} packs on disk).`);
} catch (err) {
  console.error("❌ Failed to parse module.json:", err.message);
  process.exit(1);
}

console.log("✅ Asset check completed successfully.");
