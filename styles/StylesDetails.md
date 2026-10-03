# Styles Details

Module stylesheet. Loaded by Foundry via the `styles` array in
[`module.json`](../module.json).

## Files

| File | Purpose |
|---|---|
| [`module.css`](module.css) | All module styling — grim-dark theme for the Harvest Menu |

---

## `module.css`

### Theme tokens

```css
:root {
  --rnr-brown: #734A12;   /* headers, borders */
  --rnr-red:   #B22222;   /* accents, hover, warnings */
  --rnr-wood:  #60402B;   /* panel borders */
  --rnr-ink:   #0c0c0f;   /* window background */
  --rnr-text:  #e6e0d6;   /* body text */
}
```

Use these rather than literal hex values when extending — the grim-dark palette
is meant to stay consistent as crafting and rune UIs are added.

### Sections

| Section | Selectors | Purpose |
|---|---|---|
| HUD button | `.control-icon.harvest-menu` | Cleaver icon on the Token HUD; radial gradient, red glow on hover |
| Window chrome | `.rnr-harvest.grimdark .window-content` | Dark background + brown border, scoped to the dialog's `classes` |
| Layout | `.rnr-columns`, `.rnr-card` | Two-column grid; rounded bordered panels |
| Loot header | `.rnr-loot-header`, `.rnr-loot-controls` | Title row with Select All / Clear |
| Material tiers | `.rnr-tier`, `.rnr-tier-header`, `.rnr-hint` | Tier groups with DC captions |
| Dropdowns | `.rnr-dropdown`, `.rnr-dropdown-entry` | Scrollable actor pickers, red left-border on hover |
| Role headers | `.rnr-role`, `.role-icon` | Glowing per-role icons |
| Portraits | `.rnr-role-entry`, `.rnr-helper-list` | Assigned-actor rows |
| Remove buttons | `.rnr-role-entry button` | Circular red ✕ |
| Helper bonus | `.helper-bonus` | Colour-coded by magnitude |

### Role icon animations

Each role gets a distinct static glow plus a gentle pulse, keyed off the
template's `data-role` attribute:

| Role | Keyframes |
|---|---|
| `assessor` | `softPulseGold` |
| `harvester` | `softPulseBlue` |
| `helper` | `softPulseGreen` |

All three run `3s ease-in-out infinite`. They animate brightness only — cheap,
and they won't reflow the dialog.

### Material tier styling

`.rnr-tier-header` renders the DC as an uppercase letterspaced caption on a
darker strip. `.rnr-tier-essence .rnr-tier-header` switches to `--rnr-red` so
the CR-gated essence group reads as distinct from the flat material tiers.

`.rnr-tier .rnr-list label.rnr-missing` renders struck-through and muted — this
is the visible signal that a name in `HARVEST_TABLE` has no matching compendium
entry.

---

## Conventions

- **Every class is `rnr-`-prefixed** to avoid collisions with core Foundry and
  other modules. The two exceptions are `.helper-bonus` and `.role-icon`, both
  scoped under an `.rnr-` ancestor.
- **Dialog-wide rules are scoped** to `.rnr-harvest.grimdark`, matching the
  `classes` array in `HarvestMenu.defaultOptions`. Never style bare
  `.window-content` — it would leak into every Foundry application.
- Colours come from the `:root` tokens.

## Related

- [Template](../templates/TemplatesDetails.md) — the markup these rules target
- [Menu implementation](../src/harvest/HarvestDetails.md)
