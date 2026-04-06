#!/usr/bin/env bash
# Bootstrap a git worktree so the app can run from it.
#
# Symlinks venv/ and .env from the main repo, configures pnpm to share the
# virtual store with the main repo (avoiding ~1.3 GB duplication per worktree),
# then runs pnpm install to create the thin symlink tree.
#
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

# Discover the main repo's pnpm store so we can share it. This avoids each
# worktree duplicating the full .pnpm virtual store (~1.3 GB). The paths are
# passed as CLI flags to `pnpm install` — no .npmrc file needed, so the project
# is free to add a real .npmrc for shared pnpm settings later.
MAIN_VSTORE="$MAIN_REPO/node_modules/.pnpm"
MAIN_STORE="$(/bin/zsh -l -c "cd '$MAIN_REPO' && pnpm store path" 2>/dev/null)"

PNPM_EXTRA_FLAGS=""
if [ -n "$MAIN_STORE" ] && [ -d "$MAIN_VSTORE" ]; then
  # Strip the /v3 suffix — pnpm's --store-dir expects the parent.
  MAIN_STORE_DIR="${MAIN_STORE%/v3}"
  PNPM_EXTRA_FLAGS="--store-dir '$MAIN_STORE_DIR' --virtual-store-dir '$MAIN_VSTORE'"
  echo "Sharing pnpm store with main repo"
else
  echo "Warning: could not resolve main repo pnpm store — installing with defaults." >&2
fi

# Install Node deps. Uses a login shell so pnpm is found regardless of whether
# nvm/Homebrew/etc. are already on PATH — lets this script run from minimal-env
# contexts (e.g. Claude Code's Bash tool) as well as interactive shells.
if [ ! -d "$WORKTREE_ROOT/node_modules" ]; then
  echo "Running pnpm install..."
  (cd "$WORKTREE_ROOT" && /bin/zsh -l -c "pnpm install $PNPM_EXTRA_FLAGS")
else
  echo "node_modules present — skipping pnpm install (run manually if package.json changed)."
fi

echo "Bootstrap complete. You can now run: pnpm dev"
