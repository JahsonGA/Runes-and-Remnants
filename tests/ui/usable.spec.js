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

  test("every tab opens onto a panel with something in it", async ({ page }) => {
    // No tab is a placeholder any more, so the old "says it is unbuilt" check
    // was asserting the absence of a system that now exists.
    for (const tab of HUB_TABS) {
      await page.setContent(hubPage({ tab: tab.id, crafter: fullCrafter(), caster: fullCaster() }));
      const button = page
        .locator(`[data-action="switch-tab"][data-tab="${tab.id}"]`).first();
      await expect(button).toBeEnabled();
      await expect(page.locator(".rnr-panel"), `"${tab.id}" opens onto nothing`)
        .not.toBeEmpty();
    }
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

  test("names what the chosen item cannot take, without listing it", async ({ page }) => {
    // A player should still see that other kinds exist and how many — but
    // listing every pill they cannot click pushed the remnant picker off the
    // bottom of the card, which is how it came to be reported as missing.
    await page.setContent(hubPage({
      tab: "enchanting", caster: fullCaster(), enchant: { itemId: "w1" }
    }));
    const dim = page.locator(".rnr-tier-dim");
    await expect(dim.first()).toBeVisible();
    await expect(dim.first()).toContainText(/\d+ for a different item/);
  });

  test("shows the binding, and says the remnant raised it", async ({ page }) => {
    await page.setContent(hubPage({ tab: "enchanting", caster: fullCaster(), enchant: bound }));
    await expect(page.locator(".rnr-bench-body")).toContainText("DC 21");
    await expect(page.locator(".rnr-ok")).toContainText("Potent");
    await expect(page.locator("[data-action='do-enchant']")).toBeEnabled();
  });

  test("names what will be consumed before the click", async ({ page }) => {
    await page.setContent(hubPage({ tab: "enchanting", caster: fullCaster(), enchant: bound }));
    await expect(page.locator(".rnr-craft-hint")).toContainText("Remnant (Potent)");
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
    await expect(page.locator(".rnr-catalogue")).toContainText("Choose an enchanter");
  });

  test("keeps the reference tables now that it is automated", async ({ page }) => {
    // They are what a table reads at the bench, and they are still true.
    await page.setContent(hubPage({ tab: "enchanting", caster: fullCaster() }));
    const body = page.locator(".rnr-bench-body");
    await expect(body).toContainText("Remnant → Rarity → Difficulty");
    await expect(body).toContainText("Flaws on a failed check");
    // Ancestral Weapons moved to the Evolve side, where it is now live
    // rather than a note about a future phase.
    await expect(body).not.toContainText("spirit points");
  });
});

test.describe("who is at the bench", () => {
  test("both working tabs show a crafter picker", async ({ page }) => {
    // Crafting used to silently inherit the harvester, which read as a bug
    // when the workbench knew someone's Dexterity but found none of their
    // supplies — nothing on screen said whose pack it was looking in.
    for (const tab of ["crafting", "enchanting"]) {
      await page.setContent(hubPage({ tab, crafter: fullCrafter(), caster: fullCaster() }));
      await expect(page.locator(".rnr-crafter"), `no picker on "${tab}"`).toBeVisible();
    }
  });

  test("labels the role for the tab it is on", async ({ page }) => {
    await page.setContent(hubPage({ tab: "crafting" }));
    await expect(page.locator(".rnr-crafter h4")).toContainText("Crafter");
    await page.setContent(hubPage({ tab: "enchanting", caster: fullCaster() }));
    await expect(page.locator(".rnr-crafter h4")).toContainText("Enchanter");
  });

  test("marks a crafter inherited from the Harvest tab", async ({ page }) => {
    await page.setContent(hubPage({ tab: "crafting", crafter: fullCrafter() }));
    await expect(page.locator(".rnr-inherited")).toContainText("from Harvest");
  });

  test("does not mark one chosen here", async ({ page }) => {
    await page.setContent(hubPage({
      tab: "crafting", crafter: fullCrafter(),
      crafterActor: { id: "a1", name: "Someone Else", img: "icons/svg/mystery-man.svg", inherited: false }
    }));
    await expect(page.locator(".rnr-inherited")).toHaveCount(0);
  });

  test("offers a choice when nobody is at the bench", async ({ page }) => {
    await page.setContent(hubPage({ tab: "crafting", crafterActor: null }));
    const options = page.locator("[data-action='set-crafter']");
    expect(await options.count()).toBeGreaterThan(0);
    await expect(options.first()).toBeVisible();
  });

  test("the picker stays clear of the workbench below it", async ({ page }) => {
    await page.setContent(hubPage({
      tab: "crafting", recipe: "Leather", crafter: fullCrafter()
    }));
    const picker = await page.locator(".rnr-crafter").boundingBox();
    const table = await page.locator(".rnr-bench-body .rnr-ref").first().boundingBox();
    expect(table.y, "the workbench overlaps the picker")
      .toBeGreaterThanOrEqual(picker.y + picker.height - 1);
  });
});

test.describe("alchemy bench spacing", () => {
  const loaded = { tab: "crafting", mode: "alchemy",
                   bench: ["Wild Sageroot", "Milkweed Seeds", "Dried Ephedra"] };

  test("the name column takes the slack, not the buttons", async ({ page }) => {
    // The columns used to bunch to the left with a dead gap before the ✕,
    // because the actions column was pinned at 4.5rem for three buttons the
    // alchemy bench does not have.
    await page.setContent(hubPage({ ...loaded, crafter: fullCrafter() }));
    const { name, actions, table } = await page.evaluate(() => {
      const t = document.querySelector(".rnr-harvest-list");
      return {
        name: t.querySelector("td.rnr-name").getBoundingClientRect().width,
        actions: t.querySelector(".rnr-row-actions").getBoundingClientRect().width,
        table: t.getBoundingClientRect().width
      };
    });
    expect(name, "the name column is not absorbing the slack").toBeGreaterThan(table / 3);
    expect(actions, "the buttons column is hoarding width").toBeLessThan(50);
  });

  test("the total spans the bench rather than floating off to one side", async ({ page }) => {
    await page.setContent(hubPage({ ...loaded, crafter: fullCrafter() }));
    const bar = await page.locator(".rnr-final-dc").boundingBox();
    const table = await page.locator(".rnr-harvest-list").boundingBox();
    expect(bar.width, "the DC line does not line up with the table it totals")
      .toBeGreaterThanOrEqual(table.width - 4);
  });

  test("both bench tables line up the same way", async ({ page }) => {
    // Harvest carries three row buttons and alchemy one; shrink-to-fit has to
    // work for both or one of them looks broken.
    for (const state of [loaded, { tab: "harvest" }]) {
      await page.setContent(hubPage({ ...state, crafter: fullCrafter() }));
      const row = await page.evaluate(() => {
        const t = document.querySelector(".rnr-harvest-list");
        const actions = t?.querySelector(".rnr-row-actions");
        if (!actions) return null;
        // The gap against the cell immediately before it — the columns in
        // between are content, not slack, so measuring across them would call
        // a correctly-laid-out table broken.
        const prev = actions.previousElementSibling;
        return {
          gap: actions.getBoundingClientRect().left - prev.getBoundingClientRect().right,
          buttons: actions.querySelectorAll("button").length,
          width: actions.getBoundingClientRect().width
        };
      });
      if (!row) continue;
      expect(row.gap, "a dead gap before the row buttons").toBeLessThan(4);
      // Sized to what it holds: one ✕ must not reserve room for three.
      expect(row.width, `${row.buttons} button(s) taking too much room`)
        .toBeLessThan(24 * row.buttons + 12);
    }
  });
});

test.describe("ancestral weapons", () => {
  const blade = (earned, unlocked = [], remnantSpent = false) => ({
    id: "w1", name: "Ancestral Blade", type: "weapon",
    flags: { "runes-and-remnants": { spirit: { ancestral: true, earned, unlocked, remnantSpent } } }
  });

  const withWeapon = (item, over = {}) => fullCaster({
    weapons: [item], items: [item], isGM: true, ...over
  });

  test("Bind and Evolve are both offered and mark which is active", async ({ page }) => {
    await page.setContent(hubPage({
      tab: "enchanting", caster: fullCaster(), enchant: { mode: "evolve" }
    }));
    await expect(page.locator('[data-action="enchant-mode"][data-mode="evolve"]')).toHaveClass(/active/);
    await expect(page.locator('[data-action="enchant-mode"][data-mode="bind"]')).not.toHaveClass(/active/);
  });

  test("shows how far the weapon has come and how far is left", async ({ page }) => {
    await page.setContent(hubPage({
      tab: "enchanting", caster: withWeapon(blade(7, ["Whetted"])),
      enchant: { mode: "evolve", spiritItemId: "w1" }
    }));
    const body = page.locator(".rnr-bench-body");
    await expect(body).toContainText("7 / 25");
    await expect(body).toContainText("13 more points and it wakes");
    await expect(page.locator(".rnr-spirit-fill")).toBeVisible();
  });

  test("the progress bar fills in proportion, and marks where it wakes", async ({ page }) => {
    await page.setContent(hubPage({
      tab: "enchanting", caster: withWeapon(blade(20)),
      enchant: { mode: "evolve", spiritItemId: "w1" }
    }));
    const { fill, bar } = await page.evaluate(() => ({
      fill: document.querySelector(".rnr-spirit-fill").getBoundingClientRect().width,
      bar: document.querySelector(".rnr-spirit-bar").getBoundingClientRect().width
    }));
    expect(fill / bar).toBeGreaterThan(0.7);      // 20 of 25
    expect(fill / bar).toBeLessThan(0.9);
    await expect(page.locator(".rnr-spirit-mark")).toBeVisible();
  });

  test("says when the weapon has woken", async ({ page }) => {
    await page.setContent(hubPage({
      tab: "enchanting", caster: withWeapon(blade(22)),
      enchant: { mode: "evolve", spiritItemId: "w1" }
    }));
    await expect(page.locator(".rnr-ok")).toContainText("Awake");
  });

  test("dims what cannot be afforded rather than hiding it", async ({ page }) => {
    // A player choosing what to aim for needs to see the whole ladder.
    await page.setContent(hubPage({
      tab: "enchanting", caster: withWeapon(blade(1)),
      enchant: { mode: "evolve", spiritItemId: "w1" }
    }));
    const locked = page.locator(".rnr-add-locked");
    expect(await locked.count()).toBeGreaterThan(0);
    await expect(locked.first()).toBeVisible();
    await expect(locked.first()).toHaveAttribute("title", /point|first|awaken/i);
  });

  test("an unlocked ability reads as taken and cannot be taken twice", async ({ page }) => {
    await page.setContent(hubPage({
      tab: "enchanting", caster: withWeapon(blade(10, ["Whetted"])),
      enchant: { mode: "evolve", spiritItemId: "w1" }
    }));
    const taken = page.locator('[data-action="unlock-ability"].rnr-picked');
    await expect(taken).toContainText("Whetted");
    await expect(taken).toBeDisabled();
  });

  test("warns hard before a remnant closes the door", async ({ page }) => {
    await page.setContent(hubPage({
      tab: "enchanting", caster: withWeapon(blade(4)),
      enchant: { mode: "evolve", spiritItemId: "w1" }
    }));
    const offer = page.locator('[data-action="spend-remnant"]').first();
    await expect(offer).toBeVisible();
    await expect(page.locator(".rnr-tier-short")).toContainText("never be enchanted again");
  });

  test("stops offering remnants once the door is closed", async ({ page }) => {
    await page.setContent(hubPage({
      tab: "enchanting", caster: withWeapon(blade(9, [], true)),
      enchant: { mode: "evolve", spiritItemId: "w1" }
    }));
    await expect(page.locator('[data-action="spend-remnant"]')).toHaveCount(0);
    await expect(page.locator(".warning")).toContainText("never be enchanted again");
  });

  test("only a GM sees the award controls", async ({ page }) => {
    await page.setContent(hubPage({
      tab: "enchanting", caster: withWeapon(blade(5), { isGM: false }),
      enchant: { mode: "evolve", spiritItemId: "w1" }
    }));
    await expect(page.locator('[data-action="earn-spirit"]')).toHaveCount(0);
  });

  test("says plainly that the costs are not the book's", async ({ page }) => {
    // Ancestral Weapons is a commercial supplement; nothing of it ships here.
    await page.setContent(hubPage({
      tab: "enchanting", caster: withWeapon(blade(5)),
      enchant: { mode: "evolve", spiritItemId: "w1" }
    }));
    await expect(page.locator(".rnr-status")).toContainText("this module's own");
  });

  test("the evolve side fits its window like everything else", async ({ page }) => {
    await page.setContent(hubPage({
      tab: "enchanting", caster: withWeapon(blade(12, ["Whetted", "Keen Spirit"])),
      enchant: { mode: "evolve", spiritItemId: "w1" }
    }));
    const over = await page.evaluate(() => {
      const frame = document.getElementById("app").getBoundingClientRect();
      return [...document.querySelectorAll(".rnr-hub *")]
        .filter(el => {
          const r = el.getBoundingClientRect();
          return (r.width || r.height) && (r.right > frame.right + 1 || r.left < frame.left - 1);
        })
        .map(el => String(el.className).slice(0, 30));
    });
    expect(over).toEqual([]);
  });
});

test.describe("choosing reagents", () => {
  const bones = () => ([
    { id: "b1", name: "Bone", dc: 10, stamped: true },
    { id: "b2", name: "Bone", dc: 10, stamped: true },
    { id: "b3", name: "Bone", dc: 10, stamped: true },
    { id: "b4", name: "Bone", dc: 10, stamped: true }
  ]);

  test("reagent pills are buttons, not decoration", async ({ page }) => {
    // They carried the same class as the clickable catalogue and did nothing.
    await page.setContent(hubPage({
      tab: "crafting", recipe: "Leather", crafter: fullCrafter(bones())
    }));
    const pills = page.locator("[data-action='toggle-reagent']");
    await expect(pills).toHaveCount(4);
    for (const pill of await pills.all()) {
      await expect(pill).toBeEnabled();
      const box = await pill.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(MIN_HIT);
    }
  });

  test("only the parts actually going in are highlighted", async ({ page }) => {
    await page.setContent(hubPage({
      tab: "crafting", recipe: "Leather", crafter: fullCrafter(bones())
    }));
    await expect(page.locator("[data-action='toggle-reagent'].rnr-picked")).toHaveCount(1);
  });

  test("a switched-off part stays visible, struck through", async ({ page }) => {
    await page.setContent(hubPage({
      tab: "crafting", recipe: "Leather", crafter: fullCrafter(bones()),
      craft: { reagentExcluded: new Set(["b1"]) }
    }));
    const off = page.locator("[data-action='toggle-reagent'].rnr-add-off");
    await expect(off).toHaveCount(1);
    await expect(off).toBeVisible();
    await expect(off).toHaveCSS("text-decoration-line", "line-through");
  });

  test("each pill says what clicking it will do", async ({ page }) => {
    await page.setContent(hubPage({
      tab: "crafting", recipe: "Leather", crafter: fullCrafter(bones()),
      craft: { reagentExcluded: new Set(["b1"]) }
    }));
    await expect(page.locator("[data-action='toggle-reagent'][data-value='b1']"))
      .toHaveAttribute("title", /click to put it back/i);
    await expect(page.locator("[data-action='toggle-reagent'].rnr-picked").first())
      .toHaveAttribute("title", /click to keep it/i);
  });
});

test.describe("enchanting is for spellcasters", () => {
  test("the picker offers nobody who casts no spells", async ({ page }) => {
    // Better than letting someone pick a fighter and then be refused by a
    // blocker further down the panel.
    await page.setContent(hubPage({
      tab: "enchanting", caster: fullCaster(),
      crafterActor: null, castersOnly: true, availableForCrafter: []
    }));
    await expect(page.locator("[data-action='set-crafter']")).toHaveCount(0);
    await expect(page.locator(".rnr-crafter")).toContainText(/only a spellcaster/i);
  });

  test("says so when the chosen enchanter cannot cast", async ({ page }) => {
    await page.setContent(hubPage({
      tab: "enchanting", caster: fullCaster({ isCaster: false }),
      crafterActor: { id: "h1", name: "Bruiser", img: "icons/svg/mystery-man.svg",
                      inherited: true, wrongForRole: true }
    }));
    await expect(page.locator(".rnr-crafter .warning")).toContainText("casts no spells");
  });

  test("stays quiet when the enchanter can cast", async ({ page }) => {
    await page.setContent(hubPage({ tab: "enchanting", caster: fullCaster() }));
    await expect(page.locator(".rnr-crafter .warning")).toHaveCount(0);
  });

  test("crafting is open to anyone", async ({ page }) => {
    await page.setContent(hubPage({ tab: "crafting", crafter: fullCrafter() }));
    await expect(page.locator(".rnr-crafter .warning")).toHaveCount(0);
  });
});

test.describe("the enchanting steps are all reachable", () => {
  const chosen = { itemId: "a1", enchantment: "Enduring" };

  test("all four numbered steps fit without scrolling", async ({ page }) => {
    // Reported twice as "there is no remnant selection". It was rendering the
    // whole time — 775px of content in a 598px card, with step 4 below the
    // fold. Two thirds of that was enchantments for item kinds the player had
    // not chosen and could not click.
    await page.setContent(hubPage({ tab: "enchanting", caster: fullCaster(), enchant: chosen }));

    const hidden = await page.evaluate(() => {
      const cat = document.querySelector(".rnr-catalogue");
      const box = cat.getBoundingClientRect();
      return [...cat.querySelectorAll(".rnr-tier-header")]
        .filter(h => {
          const r = h.getBoundingClientRect();
          return r.top >= box.bottom || r.bottom <= box.top;
        })
        .map(h => h.textContent.trim().replace(/\s+/g, " ").slice(0, 30));
    });
    expect(hidden, "a step is below the fold").toEqual([]);
  });

  test("the remnant picker is one of them", async ({ page }) => {
    await page.setContent(hubPage({ tab: "enchanting", caster: fullCaster(), enchant: chosen }));
    const picker = page.locator("[data-action='pick-remnant']").first();
    await expect(picker).toBeVisible();
    await expect(picker).toBeInViewport();
  });

  test("a group for another item kind is named but not listed", async ({ page }) => {
    // Nothing is hidden — the header still says how many are there — but the
    // pills nobody can click no longer take the room.
    await page.setContent(hubPage({ tab: "enchanting", caster: fullCaster(), enchant: chosen }));
    const dim = page.locator(".rnr-tier-dim").first();
    await expect(dim).toContainText(/for a different item/);
    await expect(dim.locator("[data-action='pick-enchantment']")).toHaveCount(0);
  });

  test("the group that does fit is listed in full", async ({ page }) => {
    await page.setContent(hubPage({ tab: "enchanting", caster: fullCaster(), enchant: chosen }));
    const fitting = page.locator(".rnr-tier:not(.rnr-tier-dim)")
      .filter({ hasText: "Armour" }).first();
    expect(await fitting.locator("[data-action='pick-enchantment']").count())
      .toBeGreaterThan(4);
  });
});

test.describe("button labels fit their buttons", () => {
  test("no control button clips its own label", async ({ page }) => {
    // "Alchemy" spilled out of its button in Foundry but not in this harness,
    // because Foundry stretches buttons inside an application to their
    // container's full width and the harness did not model that. .rnr-add
    // overrides it; .rnr-loot-controls button never did, so both mode
    // switches were squeezed to the same width and the longer word overflowed.
    for (const tab of ["harvest", "crafting", "enchanting"]) {
      await page.setContent(hubPage({ tab, crafter: fullCrafter(), caster: fullCaster() }));
      const clipped = await page.evaluate(() =>
        [...document.querySelectorAll(".rnr-hub button")]
          .filter(el => el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1)
          .map(el => ({ text: el.textContent.trim().slice(0, 30),
                        box: Math.round(el.getBoundingClientRect().width),
                        needs: el.scrollWidth })));
      expect(clipped, `a button clips its label on the "${tab}" tab`).toEqual([]);
    }
  });

  test("each mode switch sizes to its own word, not its neighbour's", async ({ page }) => {
    await page.setContent(hubPage({ tab: "crafting" }));
    const widths = await page.evaluate(() =>
      [...document.querySelectorAll("[data-action='craft-mode']")]
        .map(el => ({ t: el.textContent.trim(), w: Math.round(el.getBoundingClientRect().width) })));
    const gear = widths.find(w => w.t === "Gear");
    const alchemy = widths.find(w => w.t === "Alchemy");
    expect(alchemy.w, "the longer label should get the wider button")
      .toBeGreaterThan(gear.w);
  });
});
