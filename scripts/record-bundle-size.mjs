#!/usr/bin/env node
/**
 * Record the current bundle size to a historical JSON file.
 *
 * Appended after each build in CI. The file is committed to the repo so
 * bundle size trends can be graphed or diffed over time.
 *
 * Output format (one entry per build):
 *   { sha, timestamp, totalKB, chunkCount }
 */

import fs from 'node:fs'
import path from 'node:path'

const CHUNKS_DIR = path.resolve('.next/static/chunks')
const HISTORY_FILE = path.resolve('bundle-size-history.json')

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
const totalKB = Math.round(totalBytes / 1024)

const entry = {
  sha: process.env.GITHUB_SHA?.slice(0, 7) ?? 'local',
  timestamp: new Date().toISOString(),
  totalKB,
  chunkCount: files.length,
}

// Load existing history or start fresh.
let history = []
if (fs.existsSync(HISTORY_FILE)) {
  try {
    history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'))
  } catch {
    history = []
  }
}

history.push(entry)

// Keep last 100 entries to prevent the file from growing unbounded.
if (history.length > 100) {
  history = history.slice(-100)
}

fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2) + '\n')
console.log(
  `Recorded: ${totalKB} KB (${files.length} chunks) → ${HISTORY_FILE}`,
)
