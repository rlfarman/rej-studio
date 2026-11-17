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
import { loadModule } from './wasm-harness.mjs'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const assetPath = path.join(root, 'public/optimizer/rej-optimizer.wasm')
const manifestPath = path.join(
  root,
  'src/features/design-tool/workers/optimizer-asset.generated.ts',
)
// The notices served beside the module must be the crate's own, verbatim:
// the licenses they carry require them to accompany the binary.
const noticesSource = path.join(root, 'rust/optimizer/THIRD-PARTY-NOTICES.md')
const noticesServed = path.join(root, 'public/optimizer/THIRD-PARTY-NOTICES.md')

/** Fail with a message that says how to fix it. */
function fail(message) {
  console.error(`error: ${message}`)
  console.error('       run `pnpm wasm:build` and commit both files.')
  process.exit(1)
}

for (const file of [assetPath, manifestPath, noticesSource, noticesServed]) {
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

if (!fs.readFileSync(noticesSource).equals(fs.readFileSync(noticesServed))) {
  fail(
    'public/optimizer/THIRD-PARTY-NOTICES.md differs from ' +
      'rust/optimizer/THIRD-PARTY-NOTICES.md.',
  )
}

// The codon preferences the charts draw are generated from the crate's
// tables. Comparing them against the committed module — not against a fresh
// `cargo run`, which needs Rust — keeps the chart honest on any machine: if
// the tables moved and the module was rebuilt, this file has to come with it.
const codonTablePath = path.join(
  root,
  'src/features/design-tool/utils/codon-preference.generated.ts',
)
if (!fs.existsSync(codonTablePath)) {
  fail(`${path.relative(root, codonTablePath)} is missing.`)
}

/** The object literal out of the generated module, as data. */
function readGeneratedTable(file) {
  const source = fs.readFileSync(file, 'utf8')
  const literal = source
    .slice(source.indexOf('{'), source.lastIndexOf('}') + 1)
    .replace(/(\w+):/g, '"$1":')
    .replace(/,(\s*[}\]])/g, '$1')
  try {
    return JSON.parse(literal)
  } catch (error) {
    fail(
      `${path.relative(root, file)} is not a plain table of numbers: ${error.message}`,
    )
  }
}

const generated = readGeneratedTable(codonTablePath)
const { codonTables } = await loadModule(assetPath)
const fromModule = codonTables()

for (const species of Object.keys(fromModule)) {
  const theirs = fromModule[species]
  const ours = generated[species]
  if (!ours) fail(`the generated codon table has no "${species}" entry.`)
  for (const [codon, preference] of Object.entries(theirs)) {
    if (ours[codon] !== preference) {
      fail(
        `the generated codon table disagrees with the .wasm.\n` +
          `       ${species} ${codon}: file ${ours[codon]}, module ${preference}`,
      )
    }
  }
  const extra = Object.keys(ours).filter((codon) => !(codon in theirs))
  if (extra.length > 0) {
    fail(
      `the generated codon table has codons the module does not: ${extra.join(', ')}`,
    )
  }
}

const kb = (bytes.length / 1024).toFixed(1)
console.log(
  `ok: public/optimizer/rej-optimizer.wasm (${kb} KB, ${digest.slice(0, 16)}…)`,
)
console.log('    matches optimizer-asset.generated.ts')
console.log('    matches codon-preference.generated.ts')
