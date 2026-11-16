# Contributing

## Commits

This repo follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). Every commit message must match:

```
<type>(<optional-scope>): <subject>
```

**Allowed types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

**Examples:**

```
feat(design-tool): add stimulatory intron preset
fix(search): debounce gene search input
docs: update contributing guide
refactor(api)!: rename process endpoint     # "!" marks a breaking change
```

Enforcement:

- **Local** — a `commit-msg` hook (husky + commitlint) runs on every commit.
- **CI** — `commitlint` validates every commit in a PR, and the PR title is also checked (since we squash-merge, the PR title becomes the commit message).

To use the provided commit template when committing without `-m`:

```bash
git config commit.template .gitmessage
```

## Branches

Branch names follow [Conventional Branch](https://conventional-branch.github.io/):

```
<type>/<description>
```

**Allowed types:** `feat`, `feature`, `fix`, `bugfix`, `hotfix`, `release`, `chore`, `claude`

Long-lived branches `main`, `master`, `develop`, `staging` are also allowed.

**Examples:** `feature/add-login-page`, `bugfix/sequence-overflow`, `claude/xenodochial-tesla`

Enforcement:

- **Local** — a `pre-push` hook validates the branch name before pushing.
- **CI** — branch names on PRs are validated (advisory).
- **GitHub** — the "Conventional branch naming" ruleset blocks other names. Bot branches (`dependabot/**`, `release-please--*`) are exempt.

The three lists of types must stay in sync.

## Pre-commit formatting

A `pre-commit` hook runs `oxlint --fix`, `eslint --fix` and `prettier --write` on staged JS/TS files (and `ruff` through `uv run` on staged Python files) via `lint-staged`. This keeps formatting consistent without running the whole repo through the linter on every commit.

## Emergency bypass

If a hook is blocking a genuine fire:

```bash
git commit --no-verify
git push --no-verify
```

Use sparingly — CI will still enforce the rules on the PR.

## Setup

Hooks install automatically when you run `pnpm install` (via husky's `prepare` script). No extra steps required.

## Required status checks

The following jobs should be configured as **required status checks** on `main` in the "Protect main" ruleset (Settings → Rules → Rulesets → Protect main → Require status checks to pass):

| Check                       | Workflow               | Blocks merge? |
| --------------------------- | ---------------------- | ------------- |
| `Lint`                      | `ci.yml`               | ✅ required   |
| `Format`                    | `ci.yml`               | ✅ required   |
| `Type Check`                | `ci.yml`               | ✅ required   |
| `Knip`                      | `ci.yml`               | ✅ required   |
| `Build`                     | `ci.yml`               | ✅ required   |
| `E2E (Playwright)`          | `ci.yml`               | ⚠️ advisory   |
| `pnpm audit`                | `security.yml`         | ✅ required   |
| `pip-audit`                 | `security.yml`         | ✅ required   |
| `Lockfile drift`            | `lock-file-policy.yml` | ⚠️ advisory   |
| `Ruff (lint + format)`      | `python-ci.yml`        | ✅ required   |
| `Pyright`                   | `python-ci.yml`        | ⚠️ advisory   |
| `Schema drift + migrations` | `db-ci.yml`            | ✅ required   |
| `Commitlint`                | `conventions.yml`      | ⚠️ advisory   |
| `PR Title`                  | `conventions.yml`      | ⚠️ advisory   |
| `Branch Name`               | `conventions.yml`      | ⚠️ advisory   |
| `Lighthouse CI`             | `lighthouse.yml`       | ⚠️ advisory   |

The `ci.yml` jobs use `dorny/paths-filter` and are skipped for docs-only PRs; GitHub treats skipped required checks as passing. `python-ci.yml` and `db-ci.yml` are path-filtered too.

All GitHub Action uses are pinned to commit SHAs (not tags) to prevent tag-reassignment attacks. When updating actions via Dependabot, the pinned SHA will be bumped automatically.

Secrets are covered by GitHub secret scanning with push protection (repo Settings → Code security), which replaced the old Gitleaks workflow.

To enable: repo Settings → Rules → Rulesets → Protect main → "Require status checks to pass" → add each required check. A check only appears there after its workflow has run at least once.

## Locally reproducing CI

Run `pnpm verify` (lint, type check, unit tests) before pushing; the `pre-push` hook runs it automatically. CI also runs `pnpm format:check`, `pnpm knip`, `pnpm build` and `pnpm test:e2e`, so run those too when you touch formatting, exports, build config or user flows.
