#!/usr/bin/env bash
# Diagnose the local dev environment.
#
# Verifies that all the moving parts the app depends on are present and
# reachable: node/pnpm/python versions, venv, .env vars, Neon connectivity.
# Prints one line per check with ✓/✗ and exits non-zero if any fail.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

fail_count=0
warn_count=0

ok()   { printf "  ${GREEN}✓${NC} %s\n" "$1"; }
warn() { printf "  ${YELLOW}!${NC} %s\n" "$1"; warn_count=$((warn_count + 1)); }
bad()  { printf "  ${RED}✗${NC} %s\n" "$1"; fail_count=$((fail_count + 1)); }
section() { printf "\n%s\n" "$1"; }

version_ge() {
  # $1 = actual, $2 = required. Both "X.Y.Z".
  [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -n1)" = "$2" ]
}

# --- Runtime versions ------------------------------------------------------
section "Runtime versions"

if command -v node >/dev/null 2>&1; then
  node_version="$(node --version | sed 's/^v//')"
  if version_ge "$node_version" "24.0.0"; then
    ok "node $node_version (>= 24.0.0)"
  else
    bad "node $node_version — need >= 24.0.0 (see package.json engines)"
  fi
else
  bad "node not found on PATH"
fi

if command -v pnpm >/dev/null 2>&1; then
  pnpm_version="$(pnpm --version)"
  if version_ge "$pnpm_version" "9.12.0"; then
    ok "pnpm $pnpm_version (>= 9.12.0)"
  else
    warn "pnpm $pnpm_version — package.json pins 9.12.3, may drift"
  fi
else
  bad "pnpm not found on PATH — install with: corepack enable && corepack prepare pnpm@9.12.3 --activate"
fi

if command -v python3 >/dev/null 2>&1; then
  py_version="$(python3 --version 2>&1 | awk '{print $2}')"
  if version_ge "$py_version" "3.11.0"; then
    ok "python3 $py_version (>= 3.11.0)"
  else
    warn "python3 $py_version — Modal image uses 3.11, local may diverge"
  fi
else
  warn "python3 not found — needed for fastapi-dev"
fi

# --- Project bootstrap -----------------------------------------------------
section "Project bootstrap"

if [ -d "$ROOT/node_modules" ]; then
  ok "node_modules/ present"
else
  bad "node_modules/ missing — run: pnpm install"
fi

if [ -e "$ROOT/venv" ]; then
  if [ -L "$ROOT/venv" ]; then
    target="$(readlink "$ROOT/venv")"
    if [ -d "$target" ]; then
      ok "venv/ (symlink to $target)"
    else
      bad "venv/ is a broken symlink -> $target"
    fi
  else
    ok "venv/ present"
  fi
else
  warn "venv/ missing — run: python3 -m venv venv && source venv/bin/activate && pip install -r python/requirements.txt"
fi

if [ -e "$ROOT/.env" ]; then
  ok ".env present"
else
  bad ".env missing — copy .env.example to .env and fill in values"
fi

# --- Modal CLI -------------------------------------------------------------
section "Modal CLI"

if command -v modal >/dev/null 2>&1; then
  modal_version="$(modal --version 2>&1 | head -1)"
  ok "modal CLI installed ($modal_version)"

  # Check authentication by hitting `modal profile current`.
  # On an unauthed machine this exits non-zero or prints nothing.
  if modal_profile="$(modal profile current 2>/dev/null)" && [ -n "$modal_profile" ]; then
    ok "modal authenticated (profile: $modal_profile)"
  else
    warn "modal CLI installed but not authenticated — run: modal token set"
  fi
else
  warn "modal CLI not found — install with: pip install modal"
fi

# --- Environment variables -------------------------------------------------
section "Environment variables"

if [ -f "$ROOT/.env" ]; then
  # shellcheck disable=SC1091
  set -a; . "$ROOT/.env"; set +a
fi

if [ -n "${DATABASE_URL:-}" ]; then
  ok "DATABASE_URL set"
else
  bad "DATABASE_URL not set — Neon connection will fail at boot"
fi

case "${COMPUTE_BACKEND:-}" in
  modal)
    ok "COMPUTE_BACKEND=modal"
    if [ -n "${MODAL_API_URL:-}" ]; then
      ok "MODAL_API_URL set"
    else
      bad "MODAL_API_URL not set — required when COMPUTE_BACKEND=modal"
    fi
    ;;
  local|"")
    ok "COMPUTE_BACKEND=${COMPUTE_BACKEND:-<unset>} (dev fallback to local uvicorn)"
    ;;
  *)
    bad "COMPUTE_BACKEND=${COMPUTE_BACKEND} — expected 'modal', 'local', or unset"
    ;;
esac

# --- Neon reachability -----------------------------------------------------
section "Neon reachability"

if [ -n "${DATABASE_URL:-}" ]; then
  if command -v psql >/dev/null 2>&1; then
    if PGCONNECT_TIMEOUT=5 psql "$DATABASE_URL" -tAc 'SELECT 1' >/dev/null 2>&1; then
      ok "Neon reachable (psql SELECT 1)"
    else
      bad "Neon unreachable — check DATABASE_URL and network"
    fi
  else
    # Fall back to a curl HEAD against the Neon host.
    host="$(printf '%s' "$DATABASE_URL" | sed -E 's|.*@([^:/]+).*|\1|')"
    if [ -n "$host" ] && curl -sSf --max-time 5 "https://$host/" -o /dev/null 2>&1; then
      ok "Neon host $host reachable (HTTP)"
    else
      warn "psql not found and HTTP probe inconclusive — can't verify Neon"
    fi
  fi
else
  warn "skipped (DATABASE_URL not set)"
fi

# --- Summary ---------------------------------------------------------------
section "Summary"
if [ "$fail_count" -eq 0 ] && [ "$warn_count" -eq 0 ]; then
  printf "  ${GREEN}All checks passed.${NC}\n"
  exit 0
elif [ "$fail_count" -eq 0 ]; then
  printf "  ${YELLOW}${warn_count} warning(s).${NC}\n"
  exit 0
else
  printf "  ${RED}${fail_count} failure(s), ${warn_count} warning(s).${NC}\n"
  exit 1
fi
