#!/usr/bin/env bash
# Remove per-worktree node_modules directories so the next bootstrap uses the
# shared virtual store. Run this once from the main repo after updating
# bootstrap-worktree.sh.
#
# Usage: ./scripts/cleanup-worktree-modules.sh [--dry-run]
set -euo pipefail

DRY_RUN=false
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=true
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKTREE_DIR="$REPO_ROOT/.claude/worktrees"

if [ ! -d "$WORKTREE_DIR" ]; then
  echo "No worktrees directory at $WORKTREE_DIR"
  exit 0
fi

total_count=0
total_bytes=0

for wt in "$WORKTREE_DIR"/*/; do
  nm="$wt/node_modules"
  if [ -d "$nm" ]; then
    size=$(du -sk "$nm" 2>/dev/null | awk '{print $1}')
    size_mb=$(( size / 1024 ))
    total_bytes=$(( total_bytes + size ))
    total_count=$(( total_count + 1 ))

    if [ "$DRY_RUN" = true ]; then
      echo "[dry-run] Would remove: $nm (${size_mb} MB)"
    else
      rm -rf "$nm"
      echo "Removed: $nm (${size_mb} MB)"
    fi
  fi

  # Also remove per-worktree .pnpm-store if it exists (leftover from isolated installs).
  store="$wt/.pnpm-store"
  if [ -d "$store" ]; then
    store_size=$(du -sk "$store" 2>/dev/null | awk '{print $1}')
    store_mb=$(( store_size / 1024 ))
    total_bytes=$(( total_bytes + store_size ))

    if [ "$DRY_RUN" = true ]; then
      echo "[dry-run] Would remove: $store (${store_mb} MB)"
    else
      rm -rf "$store"
      echo "Removed: $store (${store_mb} MB)"
    fi
  fi
done

total_mb=$(( total_bytes / 1024 ))
if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "Would reclaim ~${total_mb} MB from ${total_count} worktrees."
  echo "Run without --dry-run to delete."
else
  echo ""
  echo "Reclaimed ~${total_mb} MB from ${total_count} worktrees."
  echo "Run bootstrap-worktree.sh in each worktree to reinstall with shared store."
fi
