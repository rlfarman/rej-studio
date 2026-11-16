// GENERATED FILE — do not edit by hand.
// Produced by scripts/build-optimizer-wasm.sh alongside
// public/optimizer/rej-optimizer.wasm. `pnpm wasm:verify` checks the two
// are still in step.

/** Where the worker fetches the optimizer from. */
export const OPTIMIZER_WASM_PATH = '/optimizer/rej-optimizer.wasm'

/**
 * SHA-256 of the committed .wasm, used as a cache-busting query parameter:
 * files under public/ have no content hash in their name, so without this a
 * browser could keep an older optimizer after a deploy.
 */
export const OPTIMIZER_WASM_DIGEST =
  '614e5a34ddf806d453378f0d2176c41bc9473e3db5998eb9544646ffe7b0edd5'
