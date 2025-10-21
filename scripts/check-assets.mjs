// scripts/check-assets.mjs
import fs from "fs";
import path from "path";

const REQUIRED = [
  "module.json",
  "index.js",
  "src/harvest/logic.js",
  "src/harvest/menu.js",
  "styles/module.css",
  "templates/harvest-dialog.html"
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

  console.log("✅ module.json validated successfully.");
} catch (err) {
  console.error("❌ Failed to parse module.json:", err.message);
  process.exit(1);
}

console.log("✅ Asset check completed successfully.");
