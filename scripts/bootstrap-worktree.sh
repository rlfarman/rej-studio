#!/usr/bin/env bash
# Bootstrap a git worktree so the app can run from it.
#
# Symlinks .env from the main repo, then runs pnpm install in the worktree (a
# real install, not a node_modules symlink: a worktree nested in the main
# checkout must resolve its own copies, or tools like vp pick up the main
# checkout's).
# Safe to re-run: skips steps that are already done.
set -euo pipefail

# Resolve the worktree root (parent of this script's directory).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKTREE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Find the main repo: git worktree list's first entry is the main checkout.
# awk reads to the end rather than exiting early: with many worktrees an early
# exit closes the pipe mid-write, and pipefail turns git's SIGPIPE into a
# silent exit 141.
MAIN_REPO="$(git -C "$WORKTREE_ROOT" worktree list --porcelain | awk '/^worktree / && !found {print $2; found = 1}')"

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

# Node deps: run a real install in the worktree rather than symlinking the main
# repo's node_modules. pnpm's global content-addressed store makes
# --prefer-offline cheap — packages are hardlinked from ~/.pnpm-store rather
# than re-downloaded.
# Use a login shell so pnpm is on PATH in minimal-env contexts (e.g. Claude Code).
if [ -L "$WORKTREE_ROOT/node_modules" ]; then
  echo "Removing stale node_modules symlink..."
  unlink "$WORKTREE_ROOT/node_modules"
fi
if [ ! -e "$WORKTREE_ROOT/node_modules" ]; then
  echo "Running pnpm install --prefer-offline..."
  (cd "$WORKTREE_ROOT" && /bin/zsh -l -c "pnpm install --prefer-offline")
else
  echo "node_modules present — skipping (run pnpm install manually if package.json changed)."
fi

echo "Bootstrap complete. You can now run: pnpm dev"
