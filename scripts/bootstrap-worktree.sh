#!/usr/bin/env bash
# Bootstrap a git worktree so the app can run from it.
#
# Symlinks venv/ and .env from the main repo, then runs pnpm install.
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

# Python venv: create in the main repo if absent, then symlink here.
# Creating in the main repo means all worktrees share one install.
if [ ! -e "$WORKTREE_ROOT/venv" ]; then
  if [ ! -d "$MAIN_REPO/venv" ]; then
    echo "Creating Python venv..."
    python3 -m venv "$MAIN_REPO/venv"
    "$MAIN_REPO/venv/bin/pip" install -q -r "$MAIN_REPO/python/requirements.txt"
    echo "Python venv created at $MAIN_REPO/venv"
  fi
  ln -s "$MAIN_REPO/venv" "$WORKTREE_ROOT/venv"
  echo "Linked venv -> $MAIN_REPO/venv"
fi

# Node deps: symlink the main repo's node_modules when package.json is identical
# (the common case). Build state lives in .next/, not node_modules, so sharing is
# safe. Fall back to pnpm install only when dependencies have diverged.
# Use a login shell so pnpm is on PATH in minimal-env contexts (e.g. Claude Code).
if [ ! -e "$WORKTREE_ROOT/node_modules" ]; then
  if diff -q "$MAIN_REPO/package.json" "$WORKTREE_ROOT/package.json" >/dev/null 2>&1 \
      && [ -d "$MAIN_REPO/node_modules" ]; then
    ln -s "$MAIN_REPO/node_modules" "$WORKTREE_ROOT/node_modules"
    echo "Linked node_modules -> $MAIN_REPO/node_modules (package.json identical)"
  else
    echo "Running pnpm install (package.json differs or main node_modules missing)..."
    (cd "$WORKTREE_ROOT" && /bin/zsh -l -c "pnpm install")
  fi
else
  echo "node_modules present — skipping (run pnpm install manually if package.json changed)."
fi

echo "Bootstrap complete. You can now run: pnpm dev"
