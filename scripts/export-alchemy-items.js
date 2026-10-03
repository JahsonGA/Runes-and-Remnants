/* =========================================================
   Runes & Remnants — export hand-built alchemy items
   =========================================================

   Paste into a Foundry macro (Script type) and run it.

   Finds the ten brews in the Items sidebar by name, strips everything
   world-specific, and downloads them as one JSON file. Hand that file back
   and it becomes a shipped compendium.

   Building the items in the sheet rather than by hand in JSON means the
   schema is already right for whichever dnd5e version this world runs —
   the export just carries that shape along.
   ========================================================= */

const WANTED = [
  "Potion of Wild Sageroot",
  "Potion of Mandrake Root",
  "Potion of Hyancinth Nectar",
  "Potion of Fennel Silk",
  "Potion of Bloodgrass",
  "Poison of Wyrmtongue Petals",
  "Poison of Basilisk Breath",
  "Elixir of Arrow Root",
  "Elixir of Primordial Balm",
  "Elixir of Silver Hibiscus"
];

const found = [];
const missing = [];

for (const name of WANTED) {
  // Case-insensitive, so a stray capital does not lose an item you did make.
  const item = game.items.find(i => i.name.toLowerCase() === name.toLowerCase());
  if (!item) { missing.push(name); continue; }

  const data = item.toObject();

  // Nothing world-specific travels: ids are regenerated on import, ownership
  // and folders are meaningless outside this world, and _stats records who
  // and when.
  delete data._id;
  delete data.ownership;
  delete data.folder;
  delete data.sort;
  delete data._stats;

  found.push(data);
}

const payload = {
  exported: new Date().toISOString(),
  system: game.system.id,
  systemVersion: game.system.version,
  foundry: game.version ?? game.data?.version,
  items: found
};

console.log(`Runes & Remnants | exported ${found.length} of ${WANTED.length}`);
if (missing.length) console.warn("Runes & Remnants | not found:", missing);

const json = JSON.stringify(payload, null, 2);
const save = globalThis.saveDataToFile ?? foundry?.utils?.saveDataToFile;
save(json, "text/json", "runes-and-remnants-alchemy-items.json");

ui.notifications[missing.length ? "warn" : "info"](
  missing.length
    ? `Exported ${found.length}. Missing: ${missing.join(", ")}`
    : `Exported all ${found.length} alchemy items.`
);
