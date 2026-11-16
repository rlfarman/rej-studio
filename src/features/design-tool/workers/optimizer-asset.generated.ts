// GENERATED FILE — do not edit by hand.
// Produced by scripts/build-optimizer-wasm.sh alongside
// public/optimizer/rej-optimizer.wasm. `pnpm wasm:verify` checks the digest
// below still matches that file.

/** Where the worker fetches the optimizer from. */
export const OPTIMIZER_WASM_PATH = '/optimizer/rej-optimizer.wasm'

/**
 * SHA-256 of the committed .wasm, used as a cache-busting query parameter:
 * files under public/ have no content hash in their name, so without this a
 * browser could keep an older optimizer after a deploy.
 */
export const OPTIMIZER_WASM_DIGEST =
  '32bc6b3b41c95c4e540eca379eb965f9ace36a2394ce248ddbcf13e513a2a646'
