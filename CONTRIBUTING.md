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

A `pre-commit` hook runs `vp lint --fix` (Oxlint) and `oxfmt` on staged JS/TS files, `oxfmt` on staged JSON/Markdown/CSS/YAML, (and `ruff` through `uv run` on staged Python files) via `lint-staged`. This keeps formatting consistent without running the whole repo through the linter on every commit.

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

Configure these as **required status checks** on `main` in the "Protect main" ruleset (Settings → Rules → Rulesets → Protect main → Require status checks to pass). The names are the job names GitHub shows on a PR:

| Check                               | Workflow               | Blocks merge? |
| ----------------------------------- | ---------------------- | ------------- |
| `Lint`                              | `ci.yml`               | ✅ required   |
| `Format`                            | `ci.yml`               | ✅ required   |
| `Type Check`                        | `ci.yml`               | ✅ required   |
| `Knip`                              | `ci.yml`               | ✅ required   |
| `Test`                              | `ci.yml`               | ✅ required   |
| `Build`                             | `ci.yml`               | ✅ required   |
| `Storybook`                         | `ci.yml`               | ✅ required   |
| `Workflow Security (zizmor)`        | `ci.yml`               | ✅ required   |
| `Dependency Review`                 | `security.yml`         | ✅ required   |
| `pnpm audit`                        | `security.yml`         | ✅ required   |
| `pip-audit`                         | `security.yml`         | ✅ required   |
| `Schema drift + migrations`         | `db-ci.yml`            | ✅ required   |
| `E2E (Playwright)`                  | `ci.yml`               | ⚠️ advisory   |
| `PR Comments`                       | `ci.yml`               | ⚠️ advisory   |
| `Lockfile drift`                    | `lock-file-policy.yml` | ⚠️ advisory   |
| `Lighthouse CI`                     | `lighthouse.yml`       | ⚠️ advisory   |
| `Commitlint`                        | `conventions.yml`      | ⚠️ advisory   |
| `PR Title (Conventional Commits)`   | `conventions.yml`      | ⚠️ advisory   |
| `Branch Name (Conventional Branch)` | `conventions.yml`      | ⚠️ advisory   |
| Python CI jobs                      | `python-ci.yml`        | ⚠️ advisory   |

Only require checks whose workflow runs on every PR. A workflow skipped by an `on.paths` filter never reports, so a required check from it stays pending and blocks the merge. A job skipped by an `if:` condition reports success instead. That's why `ci.yml` and `db-ci.yml` filter paths inside the workflow (`dorny/paths-filter`) and docs-only PRs pass their checks. `python-ci.yml` still filters at the workflow level, so its jobs stay advisory until it does the same.

All GitHub Action uses are pinned to commit SHAs (not tags) to prevent tag-reassignment attacks; Dependabot bumps the pins (after a 7-day cooldown), and the zizmor job flags unpinned or mismatched ones. Workflows reference the shared setup action with the self-repository syntax (`uses: $/.github/actions/setup`).

Secrets are covered by GitHub secret scanning with push protection (repo Settings → Code security), which replaced the old Gitleaks workflow.

To enable: repo Settings → Rules → Rulesets → Protect main → "Require status checks to pass" → add each required check. A check only appears there after its workflow has run at least once.

## Locally reproducing CI

Run `pnpm verify` (lint, type check, unit tests) before pushing; the `pre-push` hook runs it automatically. CI also runs `pnpm format:check`, `pnpm knip`, `pnpm build` (then `node scripts/bundle-size.mjs` for the bundle budgets), `pnpm build-storybook --test` and `pnpm test:e2e`, so run those too when you touch formatting, exports, build config, stories or user flows. For the workflows, `uvx zizmor .github` runs the same audit as CI.
