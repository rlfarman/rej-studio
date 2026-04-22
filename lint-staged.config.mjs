import { lstatSync } from 'node:fs'
import { execSync } from 'node:child_process'

// Check once per invocation whether ruff is available. Contributors who
// haven't activated their venv or installed ruff yet still commit cleanly —
// they just miss the Python formatter locally (CI would catch it).
let ruffAvailable
const hasRuff = () => {
  if (ruffAvailable !== undefined) return ruffAvailable
  try {
    execSync('command -v ruff', { stdio: 'ignore' })
    ruffAvailable = true
  } catch {
    ruffAvailable = false
  }
  return ruffAvailable
}

// `.claude/launch.json` and `.claude/skills` are symlinks into `.agents/`.
// lint-staged matches them under `*.json`, but prettier errors out on any
// explicitly-specified symlink. Filter symlinks out before invoking tools.
const realFiles = (files) =>
  files.filter((f) => {
    try {
      return !lstatSync(f).isSymbolicLink()
    } catch {
      return false
    }
  })

const quote = (f) => `"${f}"`

export default {
  '*.{js,jsx,ts,tsx,mjs,cjs}': (files) => {
    const real = realFiles(files).map(quote).join(' ')
    if (!real) return []
    return [`eslint --fix ${real}`, `prettier --write ${real}`]
  },
  '*.{json,md,css,yml,yaml}': (files) => {
    const real = realFiles(files).map(quote).join(' ')
    if (!real) return []
    return [`prettier --write ${real}`]
  },
  '*.py': (files) => {
    const real = realFiles(files).map(quote).join(' ')
    if (!real) return []
    if (!hasRuff()) return []
    return [`ruff format ${real}`, `ruff check --fix ${real}`]
  },
}
