// =========================================================
// Layout — does the panel fit, and can a person read it?
//
// These run in a real browser against the real templates and stylesheet.
// They catch the class of bug that string assertions cannot: content that
// renders correctly but lays out unusably.
// =========================================================

import { test, expect } from "@playwright/test";
import { hubPage, fullCrafter, fullCaster, allRecipeNames, HUB_WIDTH } from "./harness.js";
import { SCROLL_REGIONS } from "../../src/data/hub-tabs.js";

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
    // An image is not text. object-fit and a portrait that fails to load both
    // give scrollWidth != clientWidth without anything being cut off.
    if (el.tagName === "IMG") continue;
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

/**
 * Content that overflows its box with no way to reach it.
 *
 * This is worse than an overflow that sticks out: the player sees a panel cut
 * off mid-row and has no scrollbar, no wheel target, nothing. It is what
 * `overflow: hidden` on a card with no inner scroller produces.
 */
const unreachable = () => {
  const out = [];
  const scrolls = el => {
    const o = getComputedStyle(el).overflowY;
    return o === "auto" || o === "scroll";
  };
  for (const el of document.querySelectorAll(".rnr-hub, .rnr-hub *")) {
    if (el.scrollHeight <= el.clientHeight + 1) continue;   // nothing hidden
    if (el.clientHeight === 0) continue;
    if (scrolls(el)) continue;                              // it can be scrolled
    if (getComputedStyle(el).overflowY !== "hidden") continue; // it just sticks out
    out.push({
      cls: String(el.className).slice(0, 40),
      hidden: el.scrollHeight - el.clientHeight
    });
  }
  return out;
};

test.describe("nothing is cut off with no way to reach it", () => {
  for (const tab of ["harvest", "crafting", "enchanting"]) {
    test(`"${tab}" keeps its overflow reachable`, async ({ page }) => {
      await page.setContent(hubPage({ tab }));
      expect(await page.evaluate(unreachable),
        `content is clipped on the "${tab}" tab with nothing to scroll`).toEqual([]);
    });
  }

  test("the harvest panel scrolls its own components", async ({ page }) => {
    // The panel that reported this: a dragon's five tiers ran past the card
    // and the card clipped them dead.
    await page.setContent(hubPage({ tab: "harvest" }));
    const state = await page.evaluate(() => {
      const card = [...document.querySelectorAll(".rnr-card")]
        .find(c => c.textContent.includes("Components"));
      return card && {
        overflow: getComputedStyle(card).overflowY,
        taller: card.scrollHeight > card.clientHeight
      };
    });
    expect(state, "no Components card rendered").toBeTruthy();
    expect(state.taller, "a dragon should not fit without scrolling").toBe(true);
    expect(state.overflow, "the card clips instead of scrolling").toBe("auto");
  });

  test("every scrolling region shows a scrollbar rather than hiding one", async ({ page }) => {
    // This is the bug as reported: "there is no scroll bar". Chromium defaults
    // to OVERLAY scrollbars, which reserve no width and fade when idle, and
    // the default thumb is a grey that vanishes against these panels — so a
    // full catalogue simply looks cut off.
    //
    // Gutter width is host-dependent, so the durable assertion is that the
    // module has said something explicit about the scrollbar rather than
    // taking whatever the platform gives it.
    for (const tab of ["harvest", "crafting"]) {
      await page.setContent(hubPage({ tab }));
      const regions = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll(".rnr-hub, .rnr-hub *")) {
          if (el.scrollHeight <= el.clientHeight + 1 || el.clientHeight === 0) continue;
          const s = getComputedStyle(el);
          if (s.overflowY !== "auto" && s.overflowY !== "scroll") continue;
          out.push({
            cls: String(el.className).slice(0, 30),
            gutter: el.offsetWidth - el.clientWidth,
            colour: s.scrollbarColor
          });
        }
        return out;
      });

      expect(regions.length, `nothing scrolls on the "${tab}" tab`).toBeGreaterThan(0);
      for (const r of regions) {
        expect(r.colour, `"${r.cls}" takes the default invisible thumb`).not.toBe("auto");
        expect(r.gutter, `"${r.cls}" reserves no room for a scrollbar`).toBeGreaterThan(4);
      }
    }
  });
});

test.describe("scroll position survives a re-render", () => {
  test("every region that scrolls is declared in scrollY", async ({ page }) => {
    // Foundry rebuilds the DOM on render and restores scroll only for the
    // selectors named in `scrollY`. A region that scrolls but is not listed
    // silently snaps to the top on every click — which is what adding a
    // fourth component to a harvest list used to do.
    for (const tab of ["harvest", "crafting", "enchanting"]) {
      await page.setContent(hubPage({ tab, caster: fullCaster(), crafter: fullCrafter() }));

      const undeclared = await page.evaluate(selectors => {
        const out = [];
        for (const el of document.querySelectorAll(".rnr-hub, .rnr-hub *")) {
          const o = getComputedStyle(el).overflowY;
          if (o !== "auto" && o !== "scroll") continue;
          if (el.scrollHeight <= el.clientHeight + 1) continue;    // not actually scrolling
          if (selectors.some(s => el.matches(s))) continue;
          out.push(String(el.className).slice(0, 40));
        }
        return out;
      }, SCROLL_REGIONS);

      expect(undeclared, `"${tab}" has scrolling regions missing from scrollY`).toEqual([]);
    }
  });

  test("scrollY names nothing that does not exist", async ({ page }) => {
    // A stale selector is dead weight and hides the fact that the region it
    // was meant to cover has been renamed.
    const seen = new Set();
    for (const tab of ["harvest", "crafting", "enchanting"]) {
      await page.setContent(hubPage({ tab, caster: fullCaster(), crafter: fullCrafter() }));
      for (const sel of SCROLL_REGIONS) {
        if (await page.locator(sel).count()) seen.add(sel);
      }
    }
    const dead = SCROLL_REGIONS.filter(s => !seen.has(s));
    expect(dead, "scrollY selectors that match nothing in any panel").toEqual([]);
  });
});

test.describe("a narrow window stacks rather than squeezes", () => {
  const narrow = (page, tab, width, extra = {}) => page.setContent(
    hubPage({ tab, ...extra }).replace(`width: ${HUB_WIDTH}px`, `width: ${width}px`));

  test("two columns while there is room for both", async ({ page }) => {
    await narrow(page, "enchanting", HUB_WIDTH, { caster: fullCaster() });
    const rows = await page.evaluate(() => {
      const [a, b] = [...document.querySelector(".rnr-columns").children];
      return a.getBoundingClientRect().top === b.getBoundingClientRect().top;
    });
    expect(rows, "should sit side by side at the default width").toBe(true);
  });

  test("one column when there is not", async ({ page }) => {
    // A fixed two-column grid squeezed each card to 169px in a narrow window.
    // Everything was still rendered, just too cramped to use — which reads as
    // "the option is missing" rather than "the option is tiny".
    await narrow(page, "enchanting", 400, { caster: fullCaster() });
    const { stacked, width } = await page.evaluate(() => {
      const [a, b] = [...document.querySelector(".rnr-columns").children];
      return {
        stacked: a.getBoundingClientRect().top !== b.getBoundingClientRect().top,
        width: a.getBoundingClientRect().width
      };
    });
    expect(stacked).toBe(true);
    expect(width, "a stacked card should take the full width").toBeGreaterThan(300);
  });

  test("every picker stays reachable at any width", async ({ page }) => {
    for (const width of [HUB_WIDTH, 520, 400]) {
      await narrow(page, "enchanting", width, {
        caster: fullCaster(), enchant: { itemId: "a1", enchantment: "Enduring" }
      });
      for (const action of ["pick-enchant-item", "pick-enchantment", "pick-remnant"]) {
        const control = page.locator(`[data-action="${action}"]`).first();
        await expect(control, `"${action}" is unreachable at ${width}px`).toBeVisible();
        const box = await control.boundingBox();
        expect(box.width, `"${action}" is too narrow at ${width}px`).toBeGreaterThan(40);
      }
    }
  });

  test("nothing hangs off the bottom once stacked", async ({ page }) => {
    // Stacked there are two grid rows; constraining only the first would let
    // the second size to its content and run off the window.
    await narrow(page, "enchanting", 400, { caster: fullCaster() });
    const overflows = await page.evaluate(() => {
      const frame = document.getElementById("app").getBoundingClientRect();
      return [...document.querySelector(".rnr-columns").children]
        .filter(c => c.getBoundingClientRect().bottom > frame.bottom + 1).length;
    });
    expect(overflows, "a card runs past the bottom of the window").toBe(0);
  });
});
