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
  '2af61e4826fe92d326513a30728f6b39481cb3f41ebd6cbdc532a5a6caf83b1d'
