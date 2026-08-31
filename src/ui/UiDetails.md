# UI Details

Shared UI glue that no single system owns.

| File | Purpose |
|---|---|
| [`confirm.js`](confirm.js) | The "are you sure" dialog, and the setting that turns it off |

---

## Why this folder exists

Crafting and Enchanting both spend things that cannot be got back without
another hunt. Both need to ask first, and both need the same answer to the
same awkward question: **which dialog API is available?**

v13 introduced `foundry.applications.api.DialogV2` and deprecated the old
`Dialog`; v11 and v12 have only `Dialog`. Feature-detecting once, here, keeps
a single build working across all four versions and keeps that choice out of
every caller.

```js
const agreed = await confirmSpend({
  title: "Craft Half Plate?",
  content: summaryToHtml(summary),
  confirmLabel: "Craft it"
});
if (!agreed) return;
```

## Rules it holds to

**Closing the window is a refusal.** Never a silent yes. The v11/v12 path
resolves `false` from its `close` handler, and the v13 path passes
`rejectClose: false` and catches, so an unanswered dialog can never be
mistaken for consent.

**A world can turn it off.** `confirmSpend` returns `true` without asking when
the GM has disabled confirmations — a table that crafts constantly should not
click twice forever. The setting is registered from `index.js` at init.

**Asking is the safe default.** `wantsConfirmation` returns `true` when the
setting cannot be read at all — before registration, or outside a game. The
failure mode of asking too often is mild; the failure mode of silently
spending a Deific remnant is not.

## What it does not do

It builds no content. What a dialog *says* — the materials, the cost, the time
— comes from [`src/craft/summary.js`](../craft/summary.js), which is pure and
tested. This file only decides how to put a string on screen and how to read
the answer back.

## Related

- [Craft](../craft/CraftDetails.md) — builds the summaries this shows
- [Enchant](../enchant/EnchantDetails.md) — the one-way remnant door uses it too
- [Source root](../SrcDetails.md)
