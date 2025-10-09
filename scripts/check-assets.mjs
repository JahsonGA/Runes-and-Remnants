import fs from "node:fs";
import path from "node:path";

const fail = (msg) => { console.error("❌", msg); process.exitCode = 1; };
const ok   = (msg) => console.log("✅", msg);

const root = process.cwd();
const modPath = path.join(root, "module.json");

if (!fs.existsSync(modPath)) {
  console.error("❌ module.json not found at repo root");
  process.exit(1);
}

const json = JSON.parse(fs.readFileSync(modPath, "utf8"));

// Basic required fields
["id","title","version","esmodules","compatibility"].forEach(k=>{
  if (json[k] == null) fail(`Missing required field: ${k}`);
});

if (!Array.isArray(json.esmodules) || json.esmodules.length === 0) {
  fail("esmodules must be a non-empty array");
} else {
  // Check JS files
  json.esmodules.forEach(f => {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) fail(`Missing esmodule: ${f}`);
  });
}

// Check styles
if (Array.isArray(json.styles)) {
  json.styles.forEach(f => {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) fail(`Missing style: ${f}`);
  });
}

// Check packs .db files
if (Array.isArray(json.packs)) {
  json.packs.forEach(pack => {
    const p = path.join(root, pack.path || "");
    if (!pack.path) fail(`Pack missing "path": ${JSON.stringify(pack)}`);
    else if (!fs.existsSync(p)) fail(`Missing pack db: ${pack.path}`);
  });
}

// Check templates directory exists (optional)
const tmplDir = path.join(root, "templates");
if (!fs.existsSync(tmplDir)) {
  console.warn("ℹ️ templates/ not found (ok if you don't use html templates)");
} else {
  ok("templates/ exists");
}

// Check download points to .zip and includes version tag
if (json.download) {
  if (!json.download.endsWith(".zip")) fail("download should end with .zip");
  if (!json.version || !json.download.includes(`/v${json.version}/`)) {
    fail(`download should contain /v${json.version}/`);
  }
} else {
  console.warn("ℹ️ No download field in module.json (install via folder).");
}

// Compatibility sanity
if (!json.compatibility?.minimum) fail("compatibility.minimum missing");
ok("Asset check completed (problems above if any).");

// Exit with nonzero if failures occurred
process.exit(process.exitCode ?? 0);
