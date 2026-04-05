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

# Symlink venv/ from the main repo (Python deps are heavy; sharing is fine).
if [ ! -e "$WORKTREE_ROOT/venv" ]; then
  if [ -d "$MAIN_REPO/venv" ]; then
    ln -s "$MAIN_REPO/venv" "$WORKTREE_ROOT/venv"
    echo "Linked venv -> $MAIN_REPO/venv"
  else
    echo "Warning: $MAIN_REPO/venv not found — create one with: python3 -m venv venv" >&2
  fi
fi

# Install Node deps in the worktree. Can't share node_modules across worktrees
# safely (Next.js build state leaks) — each worktree needs its own.
# Use a login shell so pnpm is found regardless of whether nvm/Homebrew/etc. are
# already on PATH — lets this script run from minimal-env contexts (e.g. Claude
# Code's Bash tool) as well as interactive shells.
if [ ! -d "$WORKTREE_ROOT/node_modules" ]; then
  echo "Running pnpm install..."
  (cd "$WORKTREE_ROOT" && /bin/zsh -l -c "pnpm install")
else
  echo "node_modules present — skipping pnpm install (run manually if package.json changed)."
fi

echo "Bootstrap complete. You can now run: pnpm dev"
