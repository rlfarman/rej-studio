#!/usr/bin/env bash
# Diagnose the local dev environment.
#
# Verifies that what the app needs to build and run is present: node, pnpm
# and (optionally) Rust, installed dependencies, and the gene-data setting.
# Prints one line per check with ✓/✗ and exits non-zero if any fail.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT" || exit 1

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
  if version_ge "$node_version" "26.0.0"; then
    ok "node $node_version (>= 26.0.0)"
  else
    bad "node $node_version — need >= 26.0.0 (see .nvmrc and package.json engines)"
  fi
else
  bad "node not found on PATH"
fi

if command -v pnpm >/dev/null 2>&1; then
  pnpm_version="$(pnpm --version)"
  if version_ge "$pnpm_version" "12.0.0"; then
    ok "pnpm $pnpm_version (>= 12.0.0)"
  else
    warn "pnpm $pnpm_version — package.json pins pnpm 12 (packageManager); run: npm install -g pnpm@12"
  fi
else
  # Node 25+ no longer bundles corepack, so install pnpm directly.
  bad "pnpm not found on PATH — install with: npm install -g pnpm@12"
fi

# Rust only rebuilds the optimizer (pnpm wasm:build). The .wasm is committed,
# so everything else works without it — hence a warning, not a failure.
# rust/rust-toolchain.toml pins the version; rustup installs it on request.
rust_channel="$(sed -n 's/^channel = "\(.*\)"/\1/p' rust/rust-toolchain.toml 2>/dev/null)"
rustup_bin="$(command -v rustup || echo "$HOME/.cargo/bin/rustup")"
if [ -x "$rustup_bin" ]; then
  if "$rustup_bin" toolchain list 2>/dev/null | grep -q "^${rust_channel}-"; then
    ok "rust $rust_channel (from rust/rust-toolchain.toml)"
  else
    warn "rust $rust_channel not installed — needed only for pnpm wasm:build; run: (cd rust && rustup toolchain install)"
  fi
else
  warn "rustup not found — needed only for pnpm wasm:build; install from https://rustup.rs"
fi

# --- Project bootstrap -----------------------------------------------------
section "Project bootstrap"

if [ -d "$ROOT/node_modules" ]; then
  ok "node_modules/ present"
else
  bad "node_modules/ missing — run: pnpm install"
fi

if [ -e "$ROOT/.env" ]; then
  ok ".env present"
else
  ok ".env absent — fine for local dev (sample gene data, designs in the browser); copy .env.example to configure"
fi

# --- Environment variables -------------------------------------------------
section "Environment variables"

if [ -f "$ROOT/.env" ]; then
  # shellcheck disable=SC1091
  set -a; . "$ROOT/.env"; set +a
fi

# Build-time: Vite inlines it. Unset is right for dev; a deploy refuses to
# build without it (scripts/check-deploy-env.mjs).
if [ -n "${VITE_GENE_DATA_URL:-}" ]; then
  ok "VITE_GENE_DATA_URL=${VITE_GENE_DATA_URL}"
else
  ok "VITE_GENE_DATA_URL unset — builds read the committed 24-gene sample"
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
