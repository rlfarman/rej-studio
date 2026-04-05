import { lstatSync } from 'node:fs'

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
}
