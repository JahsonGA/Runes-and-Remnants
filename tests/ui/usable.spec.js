// =========================================================
// Usable — is every control present, reachable and operable?
//
// Layout is only half of "works". These check that the things a player must
// click exist, are big enough to hit, are legible, and respond — including
// via the keyboard, which matters for anyone not using a mouse.
// =========================================================

import { test, expect } from "@playwright/test";
import { hubPage, fullCrafter, fullCaster } from "./harness.js";
import { HUB_TABS } from "../../src/data/hub-tabs.js";

/** Smallest comfortable pointer target. Below this, people miss. */
const MIN_HIT = 16;

test.describe("the controls are there and work", () => {
  test("every tab is rendered, labelled and clickable", async ({ page }) => {
    await page.setContent(hubPage({ tab: "crafting" }));

    for (const tab of HUB_TABS) {
      const button = page.locator(`[data-action="switch-tab"][data-tab="${tab.id}"]`).first();
      await expect(button, `"${tab.id}" tab is missing`).toBeVisible();
      await expect(button).toContainText(tab.label);
      await expect(button).toBeEnabled();

      const box = await button.boundingBox();
      expect(box.height, `"${tab.id}" tab is too small to hit`).toBeGreaterThanOrEqual(24);
    }
  });

  test("a locked tab is still reachable — dormant, not disabled", async ({ page }) => {
    // Enchanting is unbuilt, but a player must be able to open it and read
    // what it will be. A disabled control that says nothing is worse than a
    // dim one that explains itself.
    await page.setContent(hubPage({ tab: "enchanting" }));
    const button = page.locator('[data-action="switch-tab"][data-tab="enchanting"]').first();
    await expect(button).toBeEnabled();
    await expect(page.locator(".rnr-status").first()).toBeVisible();
  });

  test("a live system carries no status badge", async ({ page }) => {
    // The badge exists to announce an unfinished system. All three are
    // finished now, so none should be shouting about itself.
    await page.setContent(hubPage({ tab: "harvest" }));
    for (const tab of HUB_TABS) {
      await expect(page.locator(`[data-tab="${tab.id}"] .rnr-tab-badge`),
        `"${tab.id}" is live but still badged`).toHaveCount(0);
    }
  });

  test("every tab icon actually resolves to a path", async ({ page }) => {
    // The images are Foundry core assets and will 404 here, which is fine —
    // what matters is that each carries a src and reserves its space, so a
    // typo does not silently collapse the tab.
    await page.setContent(hubPage({ tab: "crafting" }));
    const icons = page.locator(".rnr-tab-icon");
    await expect(icons).toHaveCount(HUB_TABS.length);
    for (let i = 0; i < HUB_TABS.length; i++) {
      await expect(icons.nth(i)).toHaveAttribute("src", /^icons\/.+\.webp$/);
    }
  });

  test("recipe buttons are hittable, even the longest names", async ({ page }) => {
    await page.setContent(hubPage({ tab: "crafting" }));
    const buttons = page.locator('[data-action="pick-recipe"]');
    const count = await buttons.count();
    expect(count, "the catalogue is empty").toBeGreaterThan(50);

    const tooSmall = [];
    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox();
      const name = (await buttons.nth(i).textContent()).trim();
      if (!box || box.height < MIN_HIT || box.width < MIN_HIT) {
        tooSmall.push({ name, box });
      }
    }
    expect(tooSmall, "some recipe buttons are too small to click").toEqual([]);
  });

  test("mode switches are present and mark which is active", async ({ page }) => {
    await page.setContent(hubPage({ tab: "crafting", mode: "alchemy" }));
    const alchemy = page.locator('[data-action="craft-mode"][data-mode="alchemy"]');
    const gear = page.locator('[data-action="craft-mode"][data-mode="manufacturing"]');

    await expect(alchemy).toBeVisible();
    await expect(gear).toBeVisible();
    await expect(alchemy, "the active mode is not marked").toHaveClass(/active/);
    await expect(gear).not.toHaveClass(/active/);
  });

  test("a selected recipe is visibly selected", async ({ page }) => {
    await page.setContent(hubPage({ tab: "crafting", recipe: "Longsword", crafter: fullCrafter() }));
    const picked = page.locator('[data-action="pick-recipe"].rnr-picked');
    await expect(picked).toHaveCount(1);
    await expect(picked).toContainText("Longsword");
  });

  test("controls respond to a real click", async ({ page }) => {
    // The handlers live in Foundry, so this checks the DOM contract they
    // depend on: the element receives the event, and carries the data
    // attribute the handler reads.
    await page.setContent(hubPage({ tab: "crafting" }));
    await page.evaluate(() => {
      window.__clicks = [];
      document.addEventListener("click", e => {
        const el = e.target.closest("[data-action]");
        if (el) window.__clicks.push({ action: el.dataset.action, name: el.dataset.name ?? null });
      });
    });

    await page.locator('[data-action="pick-recipe"]', { hasText: "Longsword" }).first().click();
    await page.locator('[data-action="switch-tab"][data-tab="harvest"]').first().click();

    expect(await page.evaluate(() => window.__clicks)).toEqual([
      { action: "pick-recipe", name: "Longsword" },
      { action: "switch-tab", name: null }
    ]);
  });

  test("every control is reachable by keyboard", async ({ page }) => {
    await page.setContent(hubPage({ tab: "crafting" }));
    // Native <button> elements are focusable by default; anything wired with
    // a data-action that is not a button would strand keyboard users.
    const unfocusable = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll("[data-action]")) {
        const focusable = ["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"].includes(el.tagName)
                          || el.hasAttribute("tabindex");
        if (!focusable) out.push({ tag: el.tagName, action: el.dataset.action });
      }
      return out;
    });
    expect(unfocusable, "these controls cannot be reached by keyboard").toEqual([]);
  });

  test("nothing important is invisible against its own background", async ({ page }) => {
    // A grim-dark palette is easy to take too far. This is a coarse check —
    // it catches text painted near-identically to what sits behind it.
    await page.setContent(hubPage({ tab: "crafting", recipe: "Plate", crafter: fullCrafter() }));
    const lowContrast = await page.evaluate(() => {
      const lum = c => {
        const [r, g, b] = c.match(/\d+/g).slice(0, 3).map(Number).map(v => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const bgOf = el => {
        for (let n = el; n; n = n.parentElement) {
          const bg = getComputedStyle(n).backgroundColor;
          if (bg && !bg.includes("rgba(0, 0, 0, 0)")) return bg;
        }
        return "rgb(0,0,0)";
      };

      const out = [];
      for (const el of document.querySelectorAll(".rnr-hub *")) {
        if (el.children.length || !el.textContent.trim()) continue;
        const style = getComputedStyle(el);
        const a = lum(style.color) + 0.05;
        const b = lum(bgOf(el)) + 0.05;
        const ratio = a > b ? a / b : b / a;
        if (ratio < 4.5) out.push({ text: el.textContent.trim().slice(0, 40), ratio: +ratio.toFixed(2) });
      }
      return out;
    });
    expect(lowContrast, "text too close in colour to its background").toEqual([]);
  });
});

test.describe("the catalogue is navigable", () => {
  test("the card is headed by the mode it is showing", async ({ page }) => {
    // It read "Manufacturing" in both modes, which looked like a bug even
    // when the list below it was right.
    await page.setContent(hubPage({ tab: "crafting", mode: "manufacturing" }));
    await expect(page.locator(".rnr-card h3").first()).toHaveText("Manufacturing");

    await page.setContent(hubPage({ tab: "crafting", mode: "alchemy" }));
    await expect(page.locator(".rnr-card h3").first()).toHaveText("Alchemy");
  });

  test("the catalogue scrolls inside the card instead of growing the window", async ({ page }) => {
    await page.setContent(hubPage({ tab: "crafting" }));
    const overflows = await page.evaluate(() => {
      const el = document.querySelector(".rnr-catalogue");
      return { scrollable: getComputedStyle(el).overflowY, taller: el.scrollHeight > el.clientHeight };
    });
    expect(overflows.scrollable).toBe("auto");
    expect(overflows.taller, "a hundred recipes should not fit without scrolling").toBe(true);
  });

  test("the filter box is present, labelled and typeable", async ({ page }) => {
    await page.setContent(hubPage({ tab: "crafting" }));
    const filter = page.locator("[data-action='filter']");
    await expect(filter).toBeVisible();
    await expect(filter).toHaveAttribute("aria-label", /filter/i);
    await filter.fill("giant");
    await expect(filter).toHaveValue("giant");
  });

  test("the filter stays put while the list scrolls under it", async ({ page }) => {
    // A search box that scrolls away is a search box you cannot correct.
    await page.setContent(hubPage({ tab: "crafting" }));
    const before = await page.locator("[data-action='filter']").boundingBox();
    await page.locator(".rnr-catalogue").evaluate(el => el.scrollTop = 400);
    const after = await page.locator("[data-action='filter']").boundingBox();
    expect(after.y).toBe(before.y);
  });

  test("the mode switches are not clipped by the card edge", async ({ page }) => {
    await page.setContent(hubPage({ tab: "crafting", mode: "alchemy" }));
    const button = page.locator('[data-action="craft-mode"][data-mode="alchemy"]');
    const card = page.locator(".rnr-card").first();
    const b = await button.boundingBox();
    const c = await card.boundingBox();
    expect(b.x + b.width, "the Alchemy switch runs past the card").toBeLessThanOrEqual(c.x + c.width);
  });

  test("the craft button says what it will spend", async ({ page }) => {
    await page.setContent(hubPage({
      tab: "crafting", recipe: "Dagger",
      crafter: fullCrafter([{ name: "Talon", dc: 10, id: "t1", stamped: true }])
    }));
    const go = page.locator("[data-action='do-craft']");
    await expect(go).toBeVisible();
    await expect(go).toBeEnabled();
    await expect(page.locator(".rnr-craft-hint")).toContainText("Talon");
  });

  test("the craft button is disabled, not hidden, when materials are short", async ({ page }) => {
    // A control that vanishes leaves the player guessing what they did wrong.
    await page.setContent(hubPage({ tab: "crafting", recipe: "Plate", crafter: fullCrafter([]) }));
    const go = page.locator("[data-action='do-craft']");
    await expect(go).toBeVisible();
    await expect(go).toBeDisabled();
    await expect(page.locator(".rnr-craft-hint")).toContainText("Short");
  });
});

test.describe("enchanting", () => {
  const bound = {
    itemId: "w1", enchantment: "Keen", remnantId: "r1", componentId: "c1"
  };

  test("walks the player through the four choices in order", async ({ page }) => {
    await page.setContent(hubPage({ tab: "enchanting", caster: fullCaster() }));
    for (const step of ["1 · The item", "2 ·", "4 · The remnant"]) {
      await expect(page.getByText(step, { exact: false }).first()).toBeVisible();
    }
  });

  test("offers only components matching the chosen enchantment", async ({ page }) => {
    // Venomous wants a virulent part; teeth and a heart are not.
    await page.setContent(hubPage({
      tab: "enchanting", caster: fullCaster(),
      enchant: { itemId: "w1", enchantment: "Venomous" }
    }));
    const components = page.locator("[data-action='pick-enchant-component']");
    await expect(components).toHaveCount(1);
    await expect(components).toContainText("Poison Gland");
  });

  test("never offers a remnant as a component", async ({ page }) => {
    await page.setContent(hubPage({
      tab: "enchanting", caster: fullCaster(),
      enchant: { itemId: "w1", enchantment: "Keen" }
    }));
    const components = page.locator("[data-action='pick-enchant-component']");
    await expect(components).not.toContainText("Essence");
  });

  test("dims what the chosen item cannot take, rather than hiding it", async ({ page }) => {
    // A player should be able to see what a different item would allow.
    await page.setContent(hubPage({
      tab: "enchanting", caster: fullCaster(), enchant: { itemId: "w1" }
    }));
    const dim = page.locator(".rnr-tier-dim");
    await expect(dim.first()).toBeVisible();
    await expect(dim.first()).toContainText("needs a different item");
  });

  test("shows the binding, and says the remnant raised it", async ({ page }) => {
    await page.setContent(hubPage({ tab: "enchanting", caster: fullCaster(), enchant: bound }));
    await expect(page.locator(".rnr-bench-body")).toContainText("DC 21");
    await expect(page.locator(".rnr-ok")).toContainText("Potent");
    await expect(page.locator("[data-action='do-enchant']")).toBeEnabled();
  });

  test("names what will be consumed before the click", async ({ page }) => {
    await page.setContent(hubPage({ tab: "enchanting", caster: fullCaster(), enchant: bound }));
    await expect(page.locator(".rnr-craft-hint")).toContainText("Essence (Potent)");
    await expect(page.locator(".rnr-craft-hint")).toContainText("whatever the roll");
  });

  test("lists every blocker at once, with the button disabled", async ({ page }) => {
    await page.setContent(hubPage({
      tab: "enchanting", caster: fullCaster(),
      // Lifedrinker is a weapon enchantment needing a rare remnant and a
      // vital component. Armour, a frail remnant and teeth fail all three.
      enchant: { itemId: "a1", enchantment: "Lifedrinker", remnantId: "r2", componentId: "c1" }
    }));
    const errors = page.locator(".rnr-errors li");
    expect(await errors.count()).toBeGreaterThanOrEqual(2);
    await expect(page.locator("[data-action='do-enchant']")).toBeDisabled();
  });

  test("tells a non-caster why they cannot", async ({ page }) => {
    await page.setContent(hubPage({
      tab: "enchanting", caster: fullCaster({ isCaster: false, ability: null }),
      enchant: bound
    }));
    await expect(page.locator(".rnr-errors")).toContainText(/spellcaster/i);
  });

  test("asks for a harvester before anything else", async ({ page }) => {
    await page.setContent(hubPage({ tab: "enchanting", caster: null }));
    await expect(page.locator(".rnr-catalogue")).toContainText("Assign a harvester");
  });

  test("keeps the reference tables now that it is automated", async ({ page }) => {
    // They are what a table reads at the bench, and they are still true.
    await page.setContent(hubPage({ tab: "enchanting", caster: fullCaster() }));
    const body = page.locator(".rnr-bench-body");
    await expect(body).toContainText("Remnant → Rarity → Difficulty");
    await expect(body).toContainText("Flaws on a failed check");
    await expect(body).toContainText("Ancestral Weapons");
  });
});
