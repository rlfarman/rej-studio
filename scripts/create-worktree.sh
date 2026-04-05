#!/usr/bin/env bash
# Create a git worktree at .claude/worktrees/<name>, branch it off origin/main,
# and bootstrap it so the app is immediately runnable.
#
# Usage: ./scripts/create-worktree.sh <name>
set -euo pipefail

NAME="${1:-}"
if [ -z "$NAME" ]; then
  echo "Usage: $0 <worktree-name>" >&2
  echo "Example: $0 fix-search-debounce" >&2
  exit 1
fi

# Must be run from the main repo, not a secondary worktree.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MAIN_REPO="$(git -C "$REPO_ROOT" worktree list --porcelain | awk '/^worktree / {print $2; exit}')"

if [ "$MAIN_REPO" != "$REPO_ROOT" ]; then
  echo "This script must be run from the main repo, not a worktree." >&2
  echo "Main repo: $MAIN_REPO" >&2
  echo "Current:   $REPO_ROOT" >&2
  exit 1
fi

WORKTREE_PATH="$REPO_ROOT/.claude/worktrees/$NAME"
BRANCH="claude/$NAME"

if [ -e "$WORKTREE_PATH" ]; then
  echo "Worktree already exists at $WORKTREE_PATH" >&2
  exit 1
fi

if git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "Branch $BRANCH already exists. Use a different name or delete it first." >&2
  exit 1
fi

echo "Fetching latest origin/main..."
git -C "$REPO_ROOT" fetch origin main --quiet

echo "Creating worktree at $WORKTREE_PATH on branch $BRANCH..."
git -C "$REPO_ROOT" worktree add -b "$BRANCH" "$WORKTREE_PATH" origin/main

echo "Bootstrapping..."
"$WORKTREE_PATH/scripts/bootstrap-worktree.sh"

echo ""
echo "Ready."
echo "  Path:   $WORKTREE_PATH"
echo "  Branch: $BRANCH"
echo ""
echo "  cd $WORKTREE_PATH"
