#!/usr/bin/env bash
# List worktrees with their merge status and size. With --prune-merged,
# interactively remove worktrees whose branches are fully merged into
# origin/main and delete their branches.
#
# Usage:
#   ./scripts/prune-worktrees.sh                 # list only (safe)
#   ./scripts/prune-worktrees.sh --prune-merged  # remove merged worktrees
set -euo pipefail

MODE="${1:-list}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MAIN_REPO="$(git -C "$REPO_ROOT" worktree list --porcelain | awk '/^worktree / {print $2; exit}')"

if [ "$MAIN_REPO" != "$REPO_ROOT" ]; then
  echo "This script must be run from the main repo, not a worktree." >&2
  exit 1
fi

git -C "$REPO_ROOT" fetch origin main --quiet

# Collect worktrees into arrays keyed by index. Parallel arrays keep this
# portable (bash 3.2, no associative arrays).
paths=()
branches=()
statuses=()
merged_indices=()

while IFS= read -r line; do
  case "$line" in
    "worktree "*) path="${line#worktree }" ;;
    "branch "*) branch="${line#branch }" ;;
    "")
      if [ -n "${path:-}" ] && [ "$path" != "$MAIN_REPO" ] && [ -n "${branch:-}" ]; then
        branch_short="${branch#refs/heads/}"
        if git -C "$REPO_ROOT" merge-base --is-ancestor "$branch" origin/main 2>/dev/null; then
          statuses+=("merged")
          merged_indices+=("${#paths[@]}")
        else
          ahead="$(git -C "$REPO_ROOT" rev-list --count "origin/main..$branch" 2>/dev/null || echo '?')"
          statuses+=("$ahead ahead")
        fi
        paths+=("$path")
        branches+=("$branch_short")
      fi
      path=""
      branch=""
      ;;
  esac
done < <(git -C "$REPO_ROOT" worktree list --porcelain; echo)

if [ "${#paths[@]}" -eq 0 ]; then
  echo "No secondary worktrees."
  exit 0
fi

# Print the table.
printf "%-30s %-40s %-12s %8s %-10s\n" "NAME" "BRANCH" "LAST" "SIZE" "STATUS"
for i in "${!paths[@]}"; do
  name="$(basename "${paths[$i]}")"
  last="$(git -C "$REPO_ROOT" log -1 --format='%cr' "${branches[$i]}" 2>/dev/null || echo '-')"
  size="$(du -sh "${paths[$i]}" 2>/dev/null | awk '{print $1}')"
  printf "%-30s %-40s %-12s %8s %-10s\n" "$name" "${branches[$i]}" "$last" "$size" "${statuses[$i]}"
done

echo ""
echo "Total worktrees: ${#paths[@]} (${#merged_indices[@]} merged)"

if [ "$MODE" != "--prune-merged" ]; then
  echo ""
  echo "Run with --prune-merged to remove merged worktrees + branches."
  exit 0
fi

if [ "${#merged_indices[@]}" -eq 0 ]; then
  echo "Nothing to prune."
  exit 0
fi

echo ""
read -r -p "Remove ${#merged_indices[@]} merged worktree(s) and delete their branches? [y/N] " reply
case "$reply" in
  y|Y|yes|YES) ;;
  *) echo "Aborted."; exit 0 ;;
esac

for i in "${merged_indices[@]}"; do
  echo "Removing ${paths[$i]} (branch ${branches[$i]})..."
  git -C "$REPO_ROOT" worktree remove "${paths[$i]}" --force
  git -C "$REPO_ROOT" branch -D "${branches[$i]}" || true
done

git -C "$REPO_ROOT" worktree prune
echo "Done."
