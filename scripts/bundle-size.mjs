#!/usr/bin/env node
/**
 * Per-route first-load JS budgets for the production build.
 *
 * Reads the client chunk graph that `pnpm build` writes to
 * `dist/client-chunks.json` (see clientChunkGraph in vite.config.ts), gzips
 * each chunk, and reports:
 *   - the shared shell: the client entry and everything it imports
 *     statically (framework, router, root layout, providers)
 *   - each route's first-load JS: the shell plus the chunks TanStack Router
 *     split out of that route file, and their static imports
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

const CLIENT_DIR = 'dist/client'
const STATS_FILE = 'dist/client-chunks.json'
const ROUTES_DIR = 'src/routes/'
const SHELL = '(shared shell)'

// Absolute gzip budgets in KB. Carried over from the Next build (about 10%
// above what it measured: shell 309, / 435, /genes/[symbol] 473,
// /design-tool 526). Raise a budget deliberately, in the PR that needs it,
// rather than by habit.
const BUDGETS_KB = {
  [SHELL]: 340,
  '/': 480,
  '/architecture': 480,
  '/genes': 480,
  '/disease-associations': 480,
  '/genes/$symbol': 520,
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

/** @type {{ file: string, isEntry: boolean, module: string | null, imports: string[] }[]} */
const chunks = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'))
const byFile = new Map(chunks.map((c) => [c.file, c]))

/** A chunk plus everything it imports statically, transitively. */
function closure(files) {
  const seen = new Set()
  const visit = (file) => {
    if (seen.has(file)) return
    seen.add(file)
    for (const dep of byFile.get(file)?.imports ?? []) visit(dep)
  }
  files.forEach(visit)
  return seen
}

/** `src/routes/genes/$symbol.tsx?tsr-split=…` → `/genes/$symbol`. */
function routePath(module) {
  const file = module.split('?')[0].slice(ROUTES_DIR.length)
  const route = file
    .replace(/\.tsx?$/, '')
    .replace(/(^|\/)index$/, '')
    .replace(/\/$/, '')
  return `/${route}`
}

const gzipCache = new Map()
const gzipBytes = (file) => {
  if (!gzipCache.has(file)) {
    const bytes = fs.readFileSync(path.join(CLIENT_DIR, file))
    gzipCache.set(file, gzipSync(bytes).length)
  }
  return gzipCache.get(file)
}
const sumGzip = (files) => [...files].reduce((s, f) => s + gzipBytes(f), 0)

const shellChunks = closure(chunks.filter((c) => c.isEntry).map((c) => c.file))

/** @type {Map<string, string[]>} route → the chunks split out of its file */
const routeChunks = new Map()
for (const c of chunks) {
  if (!c.module?.startsWith(ROUTES_DIR)) continue
  const route = routePath(c.module)
  routeChunks.set(route, [...(routeChunks.get(route) ?? []), c.file])
}

/** @type {Record<string, { gzipBytes: number, chunks: number }>} */
const sizes = {
  [SHELL]: { gzipBytes: sumGzip(shellChunks), chunks: shellChunks.size },
}
for (const route of [...routeChunks.keys()].toSorted()) {
  const files = closure([...shellChunks, ...routeChunks.get(route)])
  sizes[route] = { gzipBytes: sumGzip(files), chunks: files.size }
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
    '<sub>Each route includes the shared shell. Run `pnpm build` and see `dist/client-chunks.json` for the chunk graph.</sub>',
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
