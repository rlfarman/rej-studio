// Check the committed optimizer asset is internally consistent.
//
// public/optimizer/rej-optimizer.wasm is committed so `pnpm build` needs no
// Rust toolchain, and the worker fetches it with ?v=<digest> taken from
// optimizer-asset.generated.ts. If those two drift apart — a .wasm committed
// without its manifest, or a manifest hand-edited — the browser caches the
// wrong module under the wrong key, which is invisible until someone gets
// stale designs. This compares them.
//
// It deliberately does not rebuild and compare bytes. Two machines building
// the same source with the same toolchain and lockfile produce different
// .wasm bytes, so a digest check against a fresh build fails for reasons
// unrelated to the code. What the committed module *does* is covered by
// `pnpm wasm:smoke public/optimizer/rej-optimizer.wasm`, and CI additionally
// refuses a change to the optimizer source that leaves the asset untouched.
//
//   node scripts/check-wasm-asset.mjs

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const assetPath = path.join(root, 'public/optimizer/rej-optimizer.wasm')
const manifestPath = path.join(
  root,
  'src/features/design-tool/workers/optimizer-asset.generated.ts',
)

/** Fail with a message that says how to fix it. */
function fail(message) {
  console.error(`error: ${message}`)
  console.error('       run `pnpm wasm:build` and commit both files.')
  process.exit(1)
}

for (const file of [assetPath, manifestPath]) {
  if (!fs.existsSync(file)) fail(`${path.relative(root, file)} is missing.`)
}

const bytes = fs.readFileSync(assetPath)
const digest = createHash('sha256').update(bytes).digest('hex')

const manifest = fs.readFileSync(manifestPath, 'utf8')
const declared = manifest.match(
  /OPTIMIZER_WASM_DIGEST\s*=\s*\n?\s*'([0-9a-f]{64})'/,
)
if (!declared) fail('no OPTIMIZER_WASM_DIGEST found in the generated manifest.')

if (declared[1] !== digest) {
  fail(
    'the committed .wasm and its manifest disagree.\n' +
      `       .wasm    ${digest}\n` +
      `       manifest ${declared[1]}`,
  )
}

// A truncated or non-wasm file would still hash consistently if the manifest
// were regenerated from it, so check the magic number too.
if (bytes.subarray(0, 4).toString('binary') !== '\0asm') {
  fail('the committed .wasm does not start with the WebAssembly magic number.')
}

const kb = (bytes.length / 1024).toFixed(1)
console.log(
  `ok: public/optimizer/rej-optimizer.wasm (${kb} KB, ${digest.slice(0, 16)}…)`,
)
console.log('    matches optimizer-asset.generated.ts')
