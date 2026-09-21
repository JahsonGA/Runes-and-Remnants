// =========================================================
// Runes & Remnants — reading a shipped compendium
//
// Foundry has stored packs as LevelDB directories since v11; the single-file
// NeDB `.db` format is legacy. Editing a compendium in Foundry produces
// LevelDB, so that is what the repo ships and what the tests read.
//
// Keys look like `!items!<id>`. Anything with more segments is an embedded
// document — an effect or an activity belonging to an item — and must not be
// counted as a pack entry in its own right.
// =========================================================

import { ClassicLevel } from "classic-level";

const TOP_LEVEL_SEGMENTS = 3;   // "", "items", "<id>"

/**
 * Every top-level document in a pack.
 * @param {string} dir  path to the pack directory, e.g. "packs/harvest-items"
 * @returns {Promise<object[]>}
 */
export async function readPack(dir) {
  const db = new ClassicLevel(dir, { valueEncoding: "json" });
  const docs = [];
  try {
    for await (const [key, value] of db.iterator()) {
      if (!key.startsWith("!items!")) continue;
      if (key.split("!").length > TOP_LEVEL_SEGMENTS) continue;
      docs.push(value);
    }
  } finally {
    // Always release the lock, or a failed read leaves the pack unopenable
    // for every test that follows.
    await db.close();
  }
  return docs;
}
