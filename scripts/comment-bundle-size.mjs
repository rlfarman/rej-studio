#!/usr/bin/env node
/**
 * Post a bundle-size delta comment on a GitHub PR.
 *
 * Compares the current build's bundle size against the latest entry in
 * bundle-size-history.json (from the base branch). Outputs a markdown
 * comment body suitable for `gh pr comment`.
 *
 * Environment:
 *   GITHUB_SHA       — current commit SHA
 *   BASE_BUNDLE_KB   — base branch total KB (passed from CI)
 */

import fs from 'node:fs'
import path from 'node:path'

const CHUNKS_DIR = path.resolve('.next/static/chunks')

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

const files = walkDir(CHUNKS_DIR)
const totalBytes = files.reduce((sum, f) => sum + fs.statSync(f).size, 0)
const currentKB = Math.round(totalBytes / 1024)
const baseKB = parseInt(process.env.BASE_BUNDLE_KB ?? '0', 10)
const sha = process.env.GITHUB_SHA?.slice(0, 7) ?? 'unknown'

const delta = currentKB - baseKB
const sign = delta > 0 ? '+' : ''
const emoji = delta > 50 ? '🔴' : delta > 0 ? '🟡' : delta < -10 ? '🟢' : '⚪'

const topChunks = files
  .map((f) => ({
    name: path.relative(CHUNKS_DIR, f),
    kb: (fs.statSync(f).size / 1024).toFixed(1),
  }))
  .sort((a, b) => parseFloat(b.kb) - parseFloat(a.kb))
  .slice(0, 10)

const chunkTable = topChunks.map((c) => `| ${c.name} | ${c.kb} KB |`).join('\n')

const comment = `## ${emoji} Bundle Size Report

| Metric | Value |
|--------|-------|
| Current | **${currentKB} KB** |
| Base (main) | ${baseKB > 0 ? `${baseKB} KB` : '_unknown_'} |
| Delta | **${sign}${delta} KB** |
| Commit | \`${sha}\` |

<details>
<summary>Top 10 chunks</summary>

| Chunk | Size |
|-------|------|
${chunkTable}

</details>
`

// Write to stdout for piping into gh pr comment
process.stdout.write(comment)
