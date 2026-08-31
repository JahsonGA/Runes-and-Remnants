# UI Test Details

The browser half of the suite. Playwright, run with `npm run test:ui`.

| File | Tests | Purpose |
|---|---|---|
| [`harness.js`](harness.js) | — | Builds a full page for one hub state |
| [`layout.spec.js`](layout.spec.js) | 19 | Does it fit, can it be reached, does it scroll |
| [`usable.spec.js`](usable.spec.js) | 59 | Is every control present, hittable and legible |

---

## Why a browser at all

A layout bug cannot be caught by asserting on strings. Every one of these was
found by rendering, not by reading:

| Bug | What the string tests saw |
|---|---|
| A 386-character tool cell pushed four values off-screen | all assertions passed |
| Cards clipped with no scrollbar | all assertions passed |
| Overlay scrollbars reserved no width, so a full list looked cut off | all assertions passed |
| Row buttons hoarding 4.5rem, columns bunched left | all assertions passed |
| The remnant picker sitting below the fold | all assertions passed |

The last one was reported three times as *"there is no remnant selection"*. It
was rendering the whole time.

## The harness

`hubPage()` renders the module's **real** templates with the module's **real**
stylesheet, inside a shell that copies Foundry's window chrome. No server, no
fixtures written by hand: if the panel renders differently in the module, it
renders differently here.

**The chrome is copied, not improved on.** `.window-app` is a flex column and
`.window-content` is `flex: 1` with its own `overflow-y` — that is all
`module.css` gets to build on. An earlier harness set `display: flex` on
`.window-content` as well, which meant the stylesheet was never proven
sufficient by itself: the catalogue scrolled in the test while staying stuck
in Foundry.

`fullCrafter()` and `fullCaster()` return the busiest state a table would
actually see, and `harvestData()` fills a real dragon's five component tiers.
**The empty state hides layout bugs**, so nothing here renders empty by
default.

## What the specs guard

`layout.spec.js` — nothing overflows the window frame; no text is clipped; a
sweep renders **every recipe in two states**, with a crafter and without,
because `planManufacture` resolves a single tool when one is present and the
long string never appears otherwise. Then: nothing may be taller than its box
with `overflow: hidden` and no scroller; every scrolling region must reserve a
gutter and set an explicit `scrollbar-color`; the columns stack rather than
squeeze below ~630px; and the `scrollY` list is held against what actually
scrolls, in both directions.

`usable.spec.js` — controls exist, are big enough to hit, are reachable by
keyboard, and clear WCAG AA against their own background. That contrast check
found worse than the wrapping did: the theme brown was carrying row labels and
tab labels at 2.5:1.

## Verified by breaking it

A layout test that passes on broken CSS is worthless. The overflow suite was
checked by reverting the fix and confirming it reports *"3 of 200 states
overflow"*. The fold test was checked by measuring 775px of content in a 598px
card before the fix and 598px after.

## Related

- [Test suite](../TestDetails.md) — the Vitest half
- [Templates](../../templates/TemplatesDetails.md) — what is being rendered
- [Styles](../../styles/StylesDetails.md) — what is being tested
