---
name: run-ci
description: Run this project's CI checks locally before committing or pushing. ALWAYS use this before any git commit or git push in this repository, and whenever asked to "run CI", "verify the build", or "check the extension". It runs the same checks as GitHub Actions — JS syntax, manifest validation, web-ext lint, and the package build.
---

# Run CI locally

This repository ships a Chrome extension (Manifest V3). Before committing or pushing, run the
same checks that GitHub Actions runs, so CI does not fail after the fact.

## How to run

```bash
bash scripts/ci-local.sh
```

This runs, in order:

1. **JS syntax check** — `node --check` on every tracked `.js` / `.mjs` file (catches brace/paren mistakes).
2. **Manifest validation** — `node scripts/validate.mjs` (valid JSON, required fields, version format, and that every referenced file exists).
3. **Package build** — `bash scripts/build-zip.sh` writes `dist/easy-english-rewriter-<version>.zip` (extension files only).

## Interpreting results

- A successful run ends with: `✅ All CI checks passed locally.`
- If any step exits non-zero, **stop. Do not commit or push.** Report the failing step and the
  exact error, fix it, then re-run this skill.

## When to use

- **Before every `git commit` and `git push`** in this repository.
- When the user asks to run CI, verify the build, or check that the extension is valid.
- After any edit to `manifest.json`, the JS files, or anything under `icons/`.

## Note

This mirrors `.github/workflows/ci.yml`. If you change the CI workflow, update
`scripts/ci-local.sh` (and this skill) to match, so local and CI stay in sync.
