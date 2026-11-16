#!/usr/bin/env node
/**
 * Per-route first-load JS budgets for the production build.
 *
 * Reads `.next/diagnostics/route-bundle-stats.json` (written by `next build`),
 * gzips every chunk in each route's `firstLoadChunkPaths`, and reports:
 *   - the shared shell: chunks every route loads (framework, layout, providers)
 *   - each route's total first-load JS, shell included
 *
 * Fails (exit 1) when a route exceeds its absolute budget, or, given a
 * baseline from `main`, grows by more than BUNDLE_MAX_GROWTH_KB.
 *
 * Usage:
 *   node scripts/bundle-size.mjs [--out stats.json] [--base base.json] [--markdown report.md]
 *
 *   --out       write this build's stats (CI caches main's copy as the baseline)
 *   --base      compare against a previous --out file; skipped if it's missing
 *   --markdown  write a PR-comment body
 *
 * Environment:
 *   BUNDLE_MAX_GROWTH_KB  max gzip growth per route vs. the baseline (default 10)
 *   GITHUB_SHA            recorded in --out so the comment can name the commit
 */

import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { gzipSync } from 'node:zlib'

const STATS_FILE = '.next/diagnostics/route-bundle-stats.json'
const SHELL = '(shared shell)'

// Absolute gzip budgets in KB, about 10% above the sizes measured when they
// were set (shell 309, / 435, /genes/[symbol] 473, /design-tool 526). Raise a
// budget deliberately, in the PR that needs it, rather than by habit.
const BUDGETS_KB = {
  [SHELL]: 340,
  '/login': 340,
  '/_not-found': 340,
  '/': 480,
  '/architecture': 480,
  '/genes': 480,
  '/disease-associations': 480,
  '/genes/[symbol]': 520,
  '/design-tool': 580,
}
// Routes added later get this until they're listed above.
const DEFAULT_BUDGET_KB = 480

const { values: args } = parseArgs({
  options: {
    out: { type: 'string' },
    base: { type: 'string' },
    markdown: { type: 'string' },
  },
})
const maxGrowthKb = Number(process.env.BUNDLE_MAX_GROWTH_KB ?? 10)

if (!fs.existsSync(STATS_FILE)) {
  console.error(`${STATS_FILE} not found — run \`pnpm build\` first.`)
  process.exit(1)
}

/** @type {{ route: string, firstLoadChunkPaths: string[] }[]} */
const routeStats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'))

const gzipCache = new Map()
const gzipBytes = (chunk) => {
  if (!gzipCache.has(chunk)) {
    gzipCache.set(chunk, gzipSync(fs.readFileSync(chunk)).length)
  }
  return gzipCache.get(chunk)
}
const sumGzip = (chunks) => chunks.reduce((sum, c) => sum + gzipBytes(c), 0)

const chunkSets = routeStats.map((r) => new Set(r.firstLoadChunkPaths))
const shellChunks = [...(chunkSets[0] ?? [])].filter((c) =>
  chunkSets.every((set) => set.has(c)),
)

/** @type {Record<string, { gzipBytes: number, chunks: number }>} */
const sizes = {
  [SHELL]: { gzipBytes: sumGzip(shellChunks), chunks: shellChunks.length },
}
for (const r of routeStats.toSorted((a, b) => a.route.localeCompare(b.route))) {
  sizes[r.route] = {
    gzipBytes: sumGzip(r.firstLoadChunkPaths),
    chunks: r.firstLoadChunkPaths.length,
  }
}

const current = {
  sha: process.env.GITHUB_SHA ?? null,
  generatedAt: new Date().toISOString(),
  routes: sizes,
}
const write = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
}
if (args.out) write(args.out, JSON.stringify(current, null, 2) + '\n')

let base = null
if (args.base && fs.existsSync(args.base)) {
  base = JSON.parse(fs.readFileSync(args.base, 'utf8'))
}

const kb = (bytes) => bytes / 1024
const fmt = (bytes) => `${kb(bytes).toFixed(1)} KB`
const fmtDelta = (bytes) => `${bytes > 0 ? '+' : ''}${kb(bytes).toFixed(1)} KB`

const rows = Object.entries(sizes).map(([route, { gzipBytes: bytes }]) => {
  const budgetKb = BUDGETS_KB[route] ?? DEFAULT_BUDGET_KB
  const baseBytes = base?.routes?.[route]?.gzipBytes
  const delta = baseBytes === undefined ? undefined : bytes - baseBytes
  const problems = []
  if (kb(bytes) > budgetKb) problems.push(`over the ${budgetKb} KB budget`)
  if (delta !== undefined && kb(delta) > maxGrowthKb) {
    problems.push(`grew more than ${maxGrowthKb} KB`)
  }
  return { route, bytes, budgetKb, baseBytes, delta, problems }
})
const failures = rows.filter((r) => r.problems.length > 0)

for (const r of rows) {
  const delta = r.delta === undefined ? '' : ` (${fmtDelta(r.delta)})`
  const status = r.problems.length ? `  ✗ ${r.problems.join(', ')}` : ''
  console.log(
    `${r.route.padEnd(28)} ${fmt(r.bytes).padStart(10)} / ${r.budgetKb} KB${delta}${status}`,
  )
}
if (!base)
  console.log('\nNo baseline from main; checked absolute budgets only.')

if (args.markdown) {
  const baseLabel = base?.sha ? `\`${base.sha.slice(0, 7)}\`` : 'main'
  const lines = [
    '<!-- bundle-size-report -->',
    `## ${failures.length ? '🔴' : '🟢'} First-load JS (gzip)`,
    '',
    `| Route | Size | Δ vs ${baseLabel} | Budget | |`,
    '| --- | ---: | ---: | ---: | --- |',
    ...rows.map(
      (r) =>
        `| \`${r.route}\` | ${fmt(r.bytes)} | ${r.delta === undefined ? '—' : fmtDelta(r.delta)} | ${r.budgetKb} KB | ${r.problems.length ? `❌ ${r.problems.join(', ')}` : '✅'} |`,
    ),
    '',
    base
      ? `Fails when a route grows more than ${maxGrowthKb} KB or exceeds its budget (\`scripts/bundle-size.mjs\`).`
      : `No cached baseline for the base commit, so only the absolute budgets were checked (\`scripts/bundle-size.mjs\`).`,
    '',
    '<sub>Each route includes the shared shell. Run `pnpm next analyze` locally to see what is inside a chunk.</sub>',
  ]
  write(args.markdown, lines.join('\n') + '\n')
}

if (failures.length) {
  for (const f of failures) {
    console.error(
      `::error::${f.route}: ${fmt(f.bytes)} — ${f.problems.join(', ')}`,
    )
  }
  process.exit(1)
}
