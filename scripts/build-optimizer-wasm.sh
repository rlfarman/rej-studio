#!/usr/bin/env bash
# Build the Rust optimizer for the browser and install it as a static asset.
#
# The .wasm is committed to public/ so `pnpm build` works on Vercel without a
# Rust toolchain.
#
#   ./scripts/build-optimizer-wasm.sh   build, install, report sizes
#
# There is deliberately no digest-comparison mode. Two machines building the
# same source with the same toolchain and lockfile do not produce identical
# bytes, so "rebuild and compare hashes" fails for reasons that have nothing
# to do with the code. CI checks the committed artifact by behaviour instead
# (`pnpm wasm:smoke`), and separately refuses a change to rust/ that does not
# update the artifact.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CRATE_DIR="$ROOT/rust"
TARGET="wasm32-unknown-unknown"
BUILT="$CRATE_DIR/target/$TARGET/release/rej_optimizer.wasm"
ASSET_DIR="$ROOT/public/optimizer"
ASSET="$ASSET_DIR/rej-optimizer.wasm"
MANIFEST="$ROOT/src/features/design-tool/workers/optimizer-asset.generated.ts"
NOTICES="$CRATE_DIR/optimizer/THIRD-PARTY-NOTICES.md"

if ! command -v cargo >/dev/null 2>&1; then
  if [[ -x "$HOME/.cargo/bin/cargo" ]]; then
    export PATH="$HOME/.cargo/bin:$PATH"
  else
    echo "error: cargo not found. Install rustup from https://rustup.rs, then run" >&2
    echo "       (cd rust && rustup toolchain install)" >&2
    echo "       for the version and wasm target rust/rust-toolchain.toml names." >&2
    exit 1
  fi
fi

echo "Building the optimizer for $TARGET..."
(cd "$CRATE_DIR" && cargo build --release --target "$TARGET")

digest="$(sha256sum "$BUILT" | cut -d' ' -f1)"
bytes="$(stat -c %s "$BUILT")"

mkdir -p "$ASSET_DIR" "$(dirname "$MANIFEST")"
cp "$BUILT" "$ASSET"
# The module contains code under BSD-style licenses that require their notices
# to travel with binary copies, and every browser that loads it gets one.
cp "$NOTICES" "$ASSET_DIR/THIRD-PARTY-NOTICES.md"

# The digest is the cache key: public/ is served without a content hash in the
# filename, so the worker appends ?v=<digest> to make a new build a new URL.
cat > "$MANIFEST" <<EOF
// GENERATED FILE — do not edit by hand.
// Produced by scripts/build-optimizer-wasm.sh alongside
// public/optimizer/rej-optimizer.wasm. \`pnpm wasm:verify\` checks the digest
// below still matches that file.

/** Where the worker fetches the optimizer from. */
export const OPTIMIZER_WASM_PATH = '/optimizer/rej-optimizer.wasm'

/**
 * SHA-256 of the committed .wasm, used as a cache-busting query parameter:
 * files under public/ have no content hash in their name, so without this a
 * browser could keep an older optimizer after a deploy.
 */
export const OPTIMIZER_WASM_DIGEST =
  '$digest'
EOF

gzipped="$(gzip -9c "$ASSET" | wc -c)"
printf 'Installed %s\n  raw    %6.1f KB\n  gzip   %6.1f KB\n  sha256 %s\n' \
  "${ASSET#"$ROOT"/}" \
  "$(echo "$bytes / 1024" | bc -l)" \
  "$(echo "$gzipped / 1024" | bc -l)" \
  "$digest"
