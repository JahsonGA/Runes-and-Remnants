// =========================================================
// Layout — does the panel fit, and can a person read it?
//
// These run in a real browser against the real templates and stylesheet.
// They catch the class of bug that string assertions cannot: content that
// renders correctly but lays out unusably.
// =========================================================

import { test, expect } from "@playwright/test";
import { hubPage, fullCrafter, allRecipeNames, HUB_WIDTH } from "./harness.js";

/**
 * Anything that sticks out past the window frame.
 *
 * Reported with the offending element's own text so a failure names the
 * culprit instead of just saying "something overflows".
 */
const overflowers = () => {
  const frame = document.getElementById("app").getBoundingClientRect();
  const out = [];
  for (const el of document.querySelectorAll(".rnr-hub *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right > frame.right + 1 || r.left < frame.left - 1) {
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className).slice(0, 40),
        text: (el.textContent || "").trim().slice(0, 60),
        overhang: Math.round(r.right - frame.right)
      });
    }
  }
  return out;
};

/** Elements whose content is cut off by their own box. */
const clipped = () => {
  const out = [];
  for (const el of document.querySelectorAll(".rnr-hub *")) {
    if (el.children.length) continue;             // only leaf text nodes
    const style = getComputedStyle(el);
    if (style.overflow === "auto" || style.overflow === "scroll") continue;
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
      out.push({ cls: String(el.className).slice(0, 40),
                 text: (el.textContent || "").trim().slice(0, 60),
                 scroll: el.scrollWidth, client: el.clientWidth });
    }
  }
  return out;
};

test.describe("the panel fits its window", () => {
  test("no horizontal scrollbar on any tab", async ({ page }) => {
    for (const tab of ["harvest", "crafting", "enchanting"]) {
      await page.setContent(hubPage({ tab }));
      const scrolls = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(scrolls, `"${tab}" tab scrolls sideways`).toBe(false);
    }
  });

  test("the catalogue stays inside the frame", async ({ page }) => {
    await page.setContent(hubPage({ tab: "crafting" }));
    expect(await page.evaluate(overflowers)).toEqual([]);
  });

  test("no recipe name is clipped in the catalogue", async ({ page }) => {
    // "Potion of Storm Giant Strength" is 30 characters and used to be
    // rendered with white-space: nowrap.
    await page.setContent(hubPage({ tab: "crafting" }));
    expect(await page.evaluate(clipped)).toEqual([]);
  });

  test("every recipe's workbench fits — with and without a crafter", async ({ page }) => {
    // "Wondrous item" and "Adventuring gear (generic)" accept all nineteen
    // artisan tools. Joined, that is 386 characters in one table cell, which
    // forced the table wider than the window and pushed Check, Ability, Time
    // and Materials off-screen entirely.
    //
    // BOTH states matter. With a crafter, planManufacture resolves the one
    // tool they can actually use and the long string never appears — an
    // earlier version of this test only checked that case and sailed past
    // the very bug it was written for.
    const names = await allRecipeNames();
    const failures = [];

    for (const name of names) {
      for (const [label, crafter] of [["nobody assigned", null], ["equipped", fullCrafter()]]) {
        await page.setContent(hubPage({ tab: "crafting", recipe: name, crafter }));
        const over = await page.evaluate(overflowers);
        if (over.length) failures.push({ recipe: name, state: label, over: over.slice(0, 2) });
      }
    }

    expect(failures, `${failures.length} of ${names.length * 2} states overflow`).toEqual([]);
  });

  test("no workbench value is clipped, in either state", async ({ page }) => {
    for (const crafter of [null, fullCrafter()]) {
      for (const name of ["Adventuring gear (generic)", "Wondrous item", "Rod, staff, wand"]) {
        await page.setContent(hubPage({ tab: "crafting", recipe: name, crafter }));
        expect(await page.evaluate(clipped), `"${name}"`).toEqual([]);
      }
    }
  });

  test("the workbench shows every field it promises", async ({ page }) => {
    // The regression that started this: the labels rendered, but their
    // values sat thousands of pixels to the right of the visible frame.
    // Rendered with no crafter, which is the state the report came from.
    await page.setContent(hubPage({
      tab: "crafting", recipe: "Adventuring gear (generic)", crafter: null
    }));

    const frame = page.locator("#app");
    for (const label of ["Check", "Ability", "Tool", "Time", "Materials"]) {
      const row = page.locator("tr", { hasText: label }).first();
      const value = row.locator("td").nth(1);
      await expect(value, `"${label}" has no value`).not.toBeEmpty();
      await expect(value).toBeInViewport();

      const box = await value.boundingBox();
      const frameBox = await frame.boundingBox();
      expect(box.x + box.width, `"${label}" value sits outside the window`)
        .toBeLessThanOrEqual(frameBox.x + frameBox.width + 1);
    }
  });

  test("a loaded alchemy bench fits", async ({ page }) => {
    await page.setContent(hubPage({
      tab: "crafting",
      mode: "alchemy",
      bench: ["Wild Sageroot", "Mandrake Root", "Bloodgrass", "Arctic Creeper"],
      crafter: fullCrafter()
    }));
    expect(await page.evaluate(overflowers)).toEqual([]);
  });

  test("survives a narrow window", async ({ page }) => {
    // Foundry windows are resizable and players do shrink them.
    await page.setViewportSize({ width: 420, height: 900 });
    await page.setContent(
      hubPage({ tab: "crafting", recipe: "Wondrous item", crafter: null })
        .replace(`width: ${HUB_WIDTH}px`, "width: 400px")
    );
    expect(await page.evaluate(overflowers)).toEqual([]);
  });
});
