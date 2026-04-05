#!/usr/bin/env node
/**
 * Enforce a bundle-size budget for the Next.js build output.
 *
 * Sums all JS files under `.next/static/chunks/` (the client-side runtime +
 * page chunks) and fails if the total exceeds BUDGET_KB. Also prints per-chunk
 * sizes so regressions are easy to spot.
 *
 * Environment:
 *   BUDGET_KB  — max allowed total in KB (default: 1200)
 *
 * Exit codes:
 *   0  — within budget
 *   1  — over budget
 */

import fs from 'node:fs'
import path from 'node:path'

const CHUNKS_DIR = path.resolve('.next/static/chunks')
const BUDGET_KB = parseInt(process.env.BUDGET_KB ?? '1200', 10)

function walkDir(dir) {
  const results = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkDir(full))
    } else if (entry.name.endsWith('.js')) {
      results.push(full)
    }
  }
  return results
}

if (!fs.existsSync(CHUNKS_DIR)) {
  console.error(`${CHUNKS_DIR} not found — run \`pnpm build\` first.`)
  process.exit(1)
}

const files = walkDir(CHUNKS_DIR).map((f) => ({
  name: path.relative(CHUNKS_DIR, f),
  bytes: fs.statSync(f).size,
}))

files.sort((a, b) => b.bytes - a.bytes)

const totalBytes = files.reduce((sum, f) => sum + f.bytes, 0)
const totalKB = Math.round(totalBytes / 1024)

console.log('Bundle-size report:')
for (const f of files.slice(0, 20)) {
  const kb = (f.bytes / 1024).toFixed(1)
  console.log(`  ${kb.padStart(8)} KB  ${f.name}`)
}
if (files.length > 20) {
  console.log(`  ... and ${files.length - 20} more chunks`)
}
console.log(`\n  Total: ${totalKB} KB / ${BUDGET_KB} KB budget`)

if (totalKB > BUDGET_KB) {
  console.error(
    `\n::error::Bundle size ${totalKB} KB exceeds budget of ${BUDGET_KB} KB.`,
  )
  process.exit(1)
}

console.log('\nWithin budget.')
