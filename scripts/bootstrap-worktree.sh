#!/usr/bin/env bash
# Bootstrap a git worktree so the app can run from it.
#
# Symlinks .env from the main repo, creates the Python environment with
# `uv sync`, then runs pnpm install in the worktree (a real install, not a
# node_modules symlink — Next 16's Turbopack rejects symlinks that point
# outside the project root).
# Safe to re-run: skips steps that are already done.
set -euo pipefail

# Resolve the worktree root (parent of this script's directory).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKTREE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Find the main repo: git worktree list's first entry is the main checkout.
MAIN_REPO="$(git -C "$WORKTREE_ROOT" worktree list --porcelain | awk '/^worktree / {print $2; exit}')"

if [ -z "$MAIN_REPO" ] || [ "$MAIN_REPO" = "$WORKTREE_ROOT" ]; then
  echo "This script must be run from a secondary worktree, not the main repo." >&2
  exit 1
fi

echo "Worktree: $WORKTREE_ROOT"
echo "Main repo: $MAIN_REPO"

# Symlink .env from the main repo (gitignored, not carried by git worktree).
if [ ! -e "$WORKTREE_ROOT/.env" ]; then
  if [ -f "$MAIN_REPO/.env" ]; then
    ln -s "$MAIN_REPO/.env" "$WORKTREE_ROOT/.env"
    echo "Linked .env -> $MAIN_REPO/.env"
  else
    echo "Warning: $MAIN_REPO/.env not found — create one before running the app." >&2
  fi
fi

# Python: uv creates the worktree's own .venv from uv.lock (runtime + dev
# tools). uv's global cache hardlinks packages, so a per-worktree environment
# is cheap and can't drift from the lock the way a shared venv symlink could.
if command -v uv >/dev/null 2>&1; then
  echo "Running uv sync..."
  (cd "$WORKTREE_ROOT" && uv sync --frozen --quiet)
  echo "Python environment ready at $WORKTREE_ROOT/.venv"
else
  echo "Warning: uv not found — install it (https://docs.astral.sh/uv/) to run the Python backend." >&2
fi

# Node deps: run a real install in the worktree. Symlinking node_modules from the
# main repo breaks Next 16's Turbopack ("Symlink [project]/node_modules is invalid,
# it points out of the filesystem root"). pnpm's global content-addressed store
# makes --prefer-offline cheap — packages are hardlinked from ~/.pnpm-store rather
# than re-downloaded.
# Use a login shell so pnpm is on PATH in minimal-env contexts (e.g. Claude Code).
if [ -L "$WORKTREE_ROOT/node_modules" ]; then
  echo "Removing stale node_modules symlink (incompatible with Next 16 Turbopack)..."
  unlink "$WORKTREE_ROOT/node_modules"
fi
if [ ! -e "$WORKTREE_ROOT/node_modules" ]; then
  echo "Running pnpm install --prefer-offline..."
  (cd "$WORKTREE_ROOT" && /bin/zsh -l -c "pnpm install --prefer-offline")
else
  echo "node_modules present — skipping (run pnpm install manually if package.json changed)."
fi

# Generate .source/ (fumadocs MDX runtime). The /.source dir is gitignored and
# created by the `postinstall` hook on a normal `pnpm install` — but symlinking
# node_modules above bypasses postinstall, so the worktree starts without it
# and `tsc` errors on `import { docs } from 'collections/server'` (the
# tsconfig path alias points at .source/server.ts).
if [ ! -e "$WORKTREE_ROOT/.source" ]; then
  echo "Generating .source/ via fumadocs-mdx..."
  (cd "$WORKTREE_ROOT" && /bin/zsh -l -c "pnpm exec fumadocs-mdx")
fi

echo "Bootstrap complete. You can now run: pnpm dev"
