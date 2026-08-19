# Workflows Details

GitHub Actions for CI and release automation.

## Files

| File | Trigger | Purpose |
|---|---|---|
| [`tests.yml`](tests.yml) | push, PR | `npm test` (Vitest) |
| [`assets-check.yml`](assets-check.yml) | push, PR | `npm run check:assets` |
| [`lint.yml`](lint.yml) | push, PR | ESLint, skipped if not installed |
| [`block-non-beta-merge.yml`](block-non-beta-merge.yml) | PR → `main` | Rejects PRs whose head branch isn't `beta` |
| [`release-beta.yml`](release-beta.yml) | push to `beta` touching `module.json` | Beta tag + prerelease zip |
| [`release-merge.yml`](release-merge.yml) | push to `main` touching `module.json` | Stable tag + release zip |

All use `ubuntu-latest`, Node 20, and `npm ci || npm i`.

---

## Branch model

```
feature ──► beta ──► main
             │         │
             │         └─► release-merge.yml  → v{version}
             └─► release-beta.yml             → v{version}-beta
```

`block-non-beta-merge.yml` enforces that `main` only ever receives PRs from
`beta`, so every stable release has been through a beta first.

## Release automation

Both release workflows are **version-triggered**: they fire only when a push
modifies `module.json`, and skip if the tag already exists. Bumping `version`
in `module.json` is the single action that publishes a release.

Both guard with `if: github.actor != 'github-actions[bot]'` so the bot's own
commits don't retrigger them.

### `release-beta.yml`

1. Read `.version` from `module.json` via `jq`
2. **Rewrite `.download`** to the beta asset URL and commit it back — this is
   what makes the manifest self-updating for beta testers
3. Skip if `v{version}-beta` already exists, else create and push the tag
4. Zip the module, excluding `.git`, `.github`, `node_modules`, `tests`,
   `scripts`, art sources (`*.psd`, `*.ai`, `*.blend`), `.DS_Store`, `README*.md`
5. Publish a prerelease with the zip and `module.json` attached

### `release-merge.yml`

Same shape, minus the download-URL rewrite, tagged `v{version}` with no suffix.

### What ships

The zip excludes tests and READMEs but **not** `docs/` or `packs/`. The
compendium shipping is intentional — it is the module's content. The `docs/`
folder ships as a side effect of the exclusion list; add it to both `-x` lists
if that isn't wanted.

---

## Maintenance notes

**Two `zip -x` lists must stay in sync.** They are duplicated across the two
release workflows; a new exclusion added to one and not the other produces
divergent beta and stable packages.

**The README build badge points at a workflow that doesn't exist.** It
references `release-on-version-bump.yml`; the actual files are
`release-beta.yml` and `release-merge.yml`, so the badge renders as unknown.
Worth repointing.

**Lint is advisory.** `lint.yml` checks for `node_modules/.bin/eslint` and
prints "No ESLint found, skipping" when absent. ESLint is not currently in
`devDependencies`, so this job always passes without linting anything. It
becomes a real gate the moment ESLint is added.

## Related

- [Tests](../../tests/TestDetails.md) — what `tests.yml` and `assets-check.yml` run
- [Packs](../../packs/PacksDetails.md) — content bundled into each release
