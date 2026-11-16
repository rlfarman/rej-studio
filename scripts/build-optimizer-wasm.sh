#!/usr/bin/env bash
# Build the Rust optimizer for the browser and install it as a static asset.
#
# The .wasm is committed to public/ so `pnpm build` works on Vercel without a
# Rust toolchain. `pnpm wasm:verify` rebuilds and compares, so a stale asset
# fails CI instead of silently shipping old optimizer behaviour.
#
#   ./scripts/build-optimizer-wasm.sh          build, install, report sizes
#   ./scripts/build-optimizer-wasm.sh --check  fail if the committed copy is stale
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CRATE_DIR="$ROOT/rust"
TARGET="wasm32-unknown-unknown"
BUILT="$CRATE_DIR/target/$TARGET/release/rej_optimizer.wasm"
ASSET_DIR="$ROOT/public/optimizer"
ASSET="$ASSET_DIR/rej-optimizer.wasm"
MANIFEST="$ROOT/src/features/design-tool/workers/optimizer-asset.generated.ts"

check_only=false
[[ "${1:-}" == "--check" ]] && check_only=true

if ! command -v cargo >/dev/null 2>&1; then
  if [[ -x "$HOME/.cargo/bin/cargo" ]]; then
    export PATH="$HOME/.cargo/bin:$PATH"
  else
    echo "error: cargo not found. Install Rust from https://rustup.rs then:" >&2
    echo "       rustup target add $TARGET" >&2
    exit 1
  fi
fi

echo "Building the optimizer for $TARGET..."
(cd "$CRATE_DIR" && cargo build --release --target "$TARGET")

digest="$(sha256sum "$BUILT" | cut -d' ' -f1)"
bytes="$(stat -c %s "$BUILT")"

if $check_only; then
  if [[ ! -f "$ASSET" ]]; then
    echo "error: $ASSET is missing. Run ./scripts/build-optimizer-wasm.sh" >&2
    exit 1
  fi
  committed="$(sha256sum "$ASSET" | cut -d' ' -f1)"
  if [[ "$committed" != "$digest" ]]; then
    echo "error: the committed optimizer .wasm is stale." >&2
    echo "       committed: $committed" >&2
    echo "       rebuilt:   $digest" >&2
    echo "       Run ./scripts/build-optimizer-wasm.sh and commit the result." >&2
    exit 1
  fi
  echo "The committed optimizer .wasm matches the source ($digest)."
  exit 0
fi

mkdir -p "$ASSET_DIR" "$(dirname "$MANIFEST")"
cp "$BUILT" "$ASSET"

# The digest is the cache key: public/ is served without a content hash in the
# filename, so the worker appends ?v=<digest> to make a new build a new URL.
cat > "$MANIFEST" <<EOF
// GENERATED FILE — do not edit by hand.
// Produced by scripts/build-optimizer-wasm.sh alongside
// public/optimizer/rej-optimizer.wasm. \`pnpm wasm:verify\` checks the two
// are still in step.

/** Where the worker fetches the optimizer from. */
export const OPTIMIZER_WASM_PATH = '/optimizer/rej-optimizer.wasm'

/**
 * SHA-256 of the committed .wasm, used as a cache-busting query parameter:
 * files under public/ have no content hash in their name, so without this a
 * browser could keep an older optimizer after a deploy.
 */
export const OPTIMIZER_WASM_DIGEST = '$digest'

/** Uncompressed size in bytes, reported in the build log. */
export const OPTIMIZER_WASM_BYTES = $bytes
EOF

gzipped="$(gzip -9c "$ASSET" | wc -c)"
printf 'Installed %s\n  raw    %6.1f KB\n  gzip   %6.1f KB\n  sha256 %s\n' \
  "${ASSET#"$ROOT"/}" \
  "$(echo "$bytes / 1024" | bc -l)" \
  "$(echo "$gzipped / 1024" | bc -l)" \
  "$digest"
