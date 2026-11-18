import { lstatSync } from 'node:fs'

// `.claude/launch.json` and `.claude/skills` are symlinks into `.agents/`.
// lint-staged matches them under `*.json`, but the formatter errors out on any
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

// Without the flag, oxfmt exits non-zero when every file it is given is in its
// ignorePatterns (test fixtures, generated files), blocking those commits.
const oxfmt = 'oxfmt --no-error-on-unmatched-pattern'

export default {
  '*.{js,jsx,ts,tsx,mjs,cjs}': (files) => {
    const real = realFiles(files).map(quote).join(' ')
    if (!real) return []
    return [`vp lint --fix ${real}`, `${oxfmt} ${real}`]
  },
  '*.{json,md,css,yml,yaml}': (files) => {
    const real = realFiles(files).map(quote).join(' ')
    if (!real) return []
    return [`${oxfmt} ${real}`]
  },
}
