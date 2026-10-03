// =========================================================
// Runes & Remnants — "Are you sure?"
//
// Crafting and enchanting both spend things that cannot be got back without
// another hunt, and a bad roll spends them for nothing. So both confirm
// first, and the confirmation states plainly what leaves the pack, what it
// costs, and how long the character is at the bench.
//
// Pure. The dialog that shows this lives in src/ui/confirm.js; keeping the
// content here means the numbers a player is asked to agree to are the same
// numbers the tests check.
// =========================================================

import { materialYardstick } from "./logic.js";
import { NEAR_MISS } from "./outcome.js";

/** A workday and a workweek, for turning big hour counts into something real. */
const HOURS_PER_DAY = 8;
const DAYS_PER_WEEK = 5;

/**
 * Hours as something a player can picture.
 *
 * The potion table runs to a thousand hours and the artifact tier to a
 * hundred thousand; "100000 hrs" tells nobody anything.
 */
export function formatHours(hours) {
  const h = Math.max(0, Math.round(Number(hours) || 0));
  if (h <= 0) return "no time at all";

  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const label = plural(h, "hour");
  if (h < HOURS_PER_DAY * 2) return label;

  const days = h / HOURS_PER_DAY;
  if (days < DAYS_PER_WEEK * 2) return `${label} — about ${plural(Math.round(days), "day")} at the bench`;

  const weeks = days / DAYS_PER_WEEK;
  if (weeks < 52) return `${label} — about ${plural(Math.round(weeks), "workweek")}`;

  return `${label} — about ${plural(Math.round(weeks / 52), "year")} of work`;
}

/** The material yardstick, said the way the house rule means it. */
export function formatCost(recipe) {
  const gp = materialYardstick(recipe);
  if (gp === null) return "the GM's call";
  return `roughly ${gp} gp worth of material — paid in monster parts, not coin`;
}

/**
 * What a manufacturing attempt will cost, for the confirmation.
 *
 * @param {object} args { recipe, plan, selection } — selection from selectReagents
 */
export function craftSummary({ recipe, plan, selection } = {}) {
  if (!recipe || !plan) return null;

  const consumed = (selection?.parts ?? []).map(p => p.name);
  const tally = countUp(consumed);

  return {
    kind: "craft",
    title: `Craft ${recipe.name}?`,
    rows: [
      { label: "Check", value: `1d20 + ${signed(plan.bonus)} vs DC ${plan.dc}`
        + (plan.disadvantage ? " — at disadvantage" : "") },
      { label: "Tool", value: plan.tool ?? "—" },
      { label: "Time", value: formatHours(plan.hours) },
      { label: "Materials", value: formatCost(recipe) }
    ],
    consumed: tally,
    // Stated as the rule actually is, rather than a blanket "you may lose
    // these" — the difference decides whether a player attempts it.
    warning: tally.length
      ? `A miss by ${NEAR_MISS} or more spoils these. A near miss costs only the time.`
      : null,
    notes: plan.disadvantage
      ? [`No proficiency with ${plan.tool} — the check is rolled twice and the worse kept.`]
      : []
  };
}

/**
 * What an alchemy attempt will cost.
 *
 * Plant ingredients are not tracked as items yet, so nothing is deducted;
 * that is said here rather than left for a player to discover when their
 * stock never goes down.
 */
export function alchemySummary({ concoction, bench = [], bonus = 0 } = {}) {
  if (!concoction) return null;

  return {
    kind: "alchemy",
    title: `Brew ${concoction.kindLabel ?? "this"}?`,
    rows: [
      { label: "Check", value: `1d20 + ${signed(bonus)} vs DC ${concoction.dc}` },
      { label: "Tool", value: (concoction.tools ?? []).join(" or ") || "Alchemist's supplies" },
      { label: "Time", value: formatHours(1) },
      { label: "Yield", value: "one vial" }
    ],
    consumed: countUp(bench),
    warning: null,
    notes: ["Alchemy stock is not tracked yet — deduct these ingredients by hand."]
  };
}

/**
 * What a binding will cost.
 *
 * The remnant and component go whatever the roll, which is the single most
 * important thing for a player to have agreed to before clicking.
 */
export function enchantSummary({ plan } = {}) {
  if (!plan?.valid) return null;

  const consumed = countUp([plan.remnant, plan.component].filter(Boolean));

  return {
    kind: "enchant",
    title: `Bind ${plan.enchantment} into ${plan.item}?`,
    rows: [
      { label: "Check", value: `1d20 + ${signed(plan.bonus)} vs DC ${plan.dc}`
        + (plan.ability ? ` — ${plan.ability} (${plan.skill})` : "") },
      { label: "Result", value: `${plan.rarity}${plan.upgraded ? ` — raised from ${plan.askedRarity}` : ""}` },
      { label: "Time", value: formatHours(plan.hours) },
      { label: "Effect", value: plan.effect }
    ],
    consumed,
    warning: "The remnant and component are consumed whatever the roll — "
           + "the power leaves them the moment the binding begins.",
    notes: ["A miss still binds, with flaws. Miss by 13 or more and the item is destroyed."]
  };
}

/**
 * Render a summary as the dialog's body.
 *
 * Plain markup: Foundry dialogs take an HTML string, and the module's own
 * stylesheet is already loaded when one opens.
 */
export function summaryToHtml(summary) {
  if (!summary) return "";

  const rows = summary.rows
    .map(r => `<tr><td>${escape(r.label)}</td><td class="rnr-num">${escape(r.value)}</td></tr>`)
    .join("");

  const consumed = summary.consumed.length
    ? `<div class="rnr-tier rnr-tier-short">
         <div class="rnr-tier-header">Leaves the pack</div>
         <ul class="rnr-list rnr-pool">
           ${summary.consumed.map(c => `<li><span class="rnr-add rnr-picked">${escape(c)}</span></li>`).join("")}
         </ul>
       </div>`
    : `<p class="muted rnr-hint">Nothing leaves the pack.</p>`;

  const warning = summary.warning
    ? `<p class="warning">${escape(summary.warning)}</p>` : "";

  const notes = summary.notes.length
    ? summary.notes.map(n => `<p class="muted rnr-hint">${escape(n)}</p>`).join("") : "";

  return `<div class="rnr-confirm">
    <table class="rnr-ref">${rows}</table>
    ${consumed}
    ${warning}
    ${notes}
  </div>`;
}

/* ---------------------------------------------
   helpers
--------------------------------------------- */

/** "Bone ×3" rather than three lines saying Bone. */
function countUp(names = []) {
  const counts = new Map();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name));
}

function signed(n) {
  const v = Number(n) || 0;
  return v >= 0 ? `${v}` : `${v}`;
}

/** Item names come from compendiums the module does not control. */
function escape(text) {
  return String(text ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}
