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

**Allowed types:** `feature`, `bugfix`, `hotfix`, `release`, `chore`, `claude`

Long-lived branches `main`, `master`, `develop`, `staging` are also allowed.

**Examples:** `feature/add-login-page`, `bugfix/sequence-overflow`, `claude/xenodochial-tesla`

Enforcement:

- **Local** — a `pre-push` hook validates the branch name before pushing.
- **CI** — branch names on PRs are validated.

## Pre-commit formatting

A `pre-commit` hook runs `eslint --fix` and `prettier --write` on staged files via `lint-staged`. This keeps formatting consistent without running the whole repo through the linter on every commit.

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

The following jobs should be configured as **required status checks** on `main` in GitHub repo settings (Settings → Branches → Branch protection rules → `main`):

| Check           | Workflow          | Blocks merge? |
| --------------- | ----------------- | ------------- |
| `Lint`          | `ci.yml`          | ✅ required   |
| `Format`        | `ci.yml`          | ✅ required   |
| `Type Check`    | `ci.yml`          | ✅ required   |
| `Knip`          | `ci.yml`          | ✅ required   |
| `Build`         | `ci.yml`          | ✅ required   |
| `OSV Scanner`   | `security.yml`    | ✅ required   |
| `Commitlint`    | `conventions.yml` | ⚠️ advisory   |
| `PR Title`      | `conventions.yml` | ⚠️ advisory   |
| `Branch Name`   | `conventions.yml` | ⚠️ advisory   |
| `Lighthouse CI` | `lighthouse.yml`  | ⚠️ advisory   |

The five `ci.yml` jobs use `dorny/paths-filter` and are skipped for docs-only PRs; GitHub treats skipped required checks as passing.

To enable: repo Settings → Branches → Add branch protection rule → pattern `main` → "Require status checks to pass before merging" → search for and add each required check.

## Locally reproducing CI

Run `pnpm verify` to reproduce the CI gates (lint, format check, type check, knip, build) in one command before pushing.
