import { existsSync, lstatSync } from 'node:fs'
import { execSync } from 'node:child_process'

const onPath = (bin) => {
  try {
    execSync(`command -v ${bin}`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

// How to run ruff, decided once per invocation. Prefer the project's locked
// ruff through uv (uv sync installs it from pyproject.toml/uv.lock); fall
// back to a ruff on PATH. Contributors with neither still commit cleanly,
// they just miss the local Python formatter (CI's Python job catches it).
let ruffCommand
const getRuff = () => {
  if (ruffCommand === undefined) {
    if (existsSync('pyproject.toml') && onPath('uv'))
      ruffCommand = 'uv run ruff'
    else if (onPath('ruff')) ruffCommand = 'ruff'
    else ruffCommand = null
  }
  return ruffCommand
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
    return [
      `oxlint --fix ${real}`,
      `eslint --fix ${real}`,
      `prettier --write ${real}`,
    ]
  },
  '*.{json,md,css,yml,yaml}': (files) => {
    const real = realFiles(files).map(quote).join(' ')
    if (!real) return []
    return [`prettier --write ${real}`]
  },
  '*.py': (files) => {
    const real = realFiles(files).map(quote).join(' ')
    if (!real) return []
    const ruff = getRuff()
    if (!ruff) return []
    return [`${ruff} format ${real}`, `${ruff} check --fix ${real}`]
  },
}
