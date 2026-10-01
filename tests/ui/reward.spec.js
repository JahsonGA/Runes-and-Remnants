// =========================================================
// Reward panel — does the payoff read at a glance?
//
// Six tiles land at once after a dragon. Rarity is the one thing a player
// reads first, so the frame colour has to be right and the names have to be
// legible without hovering anything.
// =========================================================

import { test, expect } from "@playwright/test";
import { rewardPage, fullReward } from "./harness.js";

test.describe("the reward panel", () => {
  test("draws a tile for everything granted", async ({ page }) => {
    await page.setContent(rewardPage(fullReward()));
    await expect(page.locator(".rnr-reward-slot")).toHaveCount(6);
  });

  test("rarity reaches the frame, which is the glance that matters", async ({ page }) => {
    await page.setContent(rewardPage(fullReward()));
    const colours = await page.evaluate(() =>
      [...document.querySelectorAll(".rnr-reward-tile")]
        .map(t => getComputedStyle(t).borderTopColor));

    // Six tiles across four rarities: distinct frames, not one flat colour.
    expect(new Set(colours).size).toBeGreaterThan(2);
  });

  test("names are shown, not hidden behind a hover", async ({ page }) => {
    // A tooltip is unreachable by keyboard and invisible on a tablet. Six
    // unlabelled icons is a guessing game.
    await page.setContent(rewardPage(fullReward()));
    for (const name of ["Pouch of Teeth", "Breath Sac", "Remnant (Potent)"]) {
      await expect(page.locator(".rnr-reward-name", { hasText: name })).toBeVisible();
    }
  });

  test("a stack shows its count; a single does not", async ({ page }) => {
    await page.setContent(rewardPage(fullReward()));
    const badges = page.locator(".rnr-reward-qty");
    await expect(badges).toHaveCount(1);
    await expect(badges).toHaveText("4");
  });

  test("nothing overflows the panel", async ({ page }) => {
    await page.setContent(rewardPage(fullReward()));
    const over = await page.evaluate(() => {
      const frame = document.getElementById("app").getBoundingClientRect();
      return [...document.querySelectorAll(".rnr-reward *")]
        .filter(el => {
          const r = el.getBoundingClientRect();
          return (r.width || r.height) && (r.right > frame.right + 1 || r.left < frame.left - 1);
        })
        .map(el => String(el.className).slice(0, 30));
    });
    expect(over).toEqual([]);
  });

  test("a long name wraps rather than stretching the grid", async ({ page }) => {
    await page.setContent(rewardPage(fullReward({
      items: [{ name: "Phial of Congealed Blood of an Ancient Black Dragon", rarity: "rare" }]
    })));
    const over = await page.evaluate(() => {
      const frame = document.getElementById("app").getBoundingClientRect();
      return document.querySelector(".rnr-reward-name").getBoundingClientRect().right > frame.right + 1;
    });
    expect(over, "a long name pushed past the frame").toBe(false);
  });

  test("says so plainly when nothing came away", async ({ page }) => {
    // A failed harvest is a result, not an empty frame.
    await page.setContent(rewardPage(fullReward({ items: [], notes: [] })));
    await expect(page.locator(".rnr-reward-empty")).toBeVisible();
    await expect(page.locator(".rnr-reward-grid")).toHaveCount(0);
  });

  test("one reward and eight both lay out without a media query", async ({ page }) => {
    for (const n of [1, 3, 8]) {
      await page.setContent(rewardPage(fullReward({
        items: Array.from({ length: n }, (_, i) => ({ name: `Part ${i + 1}`, rarity: "common" }))
      })));
      await expect(page.locator(".rnr-reward-slot")).toHaveCount(n);
      const wide = await page.evaluate(() => {
        const frame = document.getElementById("app").getBoundingClientRect();
        const grid = document.querySelector(".rnr-reward-grid").getBoundingClientRect();
        return grid.right > frame.right + 1;
      });
      expect(wide, `${n} rewards overflowed`).toBe(false);
    }
  });

  test("the accept button is present and hittable", async ({ page }) => {
    await page.setContent(rewardPage(fullReward()));
    const accept = page.locator("[data-action='reward-accept']");
    await expect(accept).toBeVisible();
    await expect(accept).toBeEnabled();
    const box = await accept.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(24);
  });

  test("every name is legible against its own tile", async ({ page }) => {
    // The name is tinted to its rarity, so a rarity colour that works as a
    // border can still fail as text.
    await page.setContent(rewardPage(fullReward()));
    const dim = await page.evaluate(() => {
      const lum = c => {
        const [r, g, b] = c.match(/\d+/g).slice(0, 3).map(Number).map(v => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const bg = lum(getComputedStyle(document.querySelector(".rnr-reward")).backgroundColor) + 0.05;
      return [...document.querySelectorAll(".rnr-reward-name")]
        .map(el => ({ text: el.textContent.trim(),
                      ratio: +((lum(getComputedStyle(el).color) + 0.05) / bg).toFixed(2) }))
        .filter(x => x.ratio < 4.5);
    });
    expect(dim, "rarity-tinted names too dim to read").toEqual([]);
  });
});
