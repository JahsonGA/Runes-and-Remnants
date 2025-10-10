export function computeHarvestDC({ cr, rarityMultiplier = 0 }) {
  // simple curve: base 10 + half-CR + rarity tweak
  const base = 10 + Math.floor((cr || 0) / 2);
  return Math.max(5, base + (rarityMultiplier || 0));
}

export function rollOutcome({ rollTotal, dc }) {
  if (rollTotal >= dc + 10) return "critical-success";
  if (rollTotal >= dc) return "success";
  if (rollTotal <= dc - 10) return "critical-failure";
  return "failure";
}
