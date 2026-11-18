/**
 * The few Python built-ins the data scripts relied on, reproduced exactly so
 * their TypeScript ports write byte-identical output.
 */
import { readFileSync } from 'node:fs'

/**
 * A text file as Python's `open(path).read()` sees it: strict UTF-8 (a bad
 * byte is an error, not U+FFFD), and a byte-order mark kept as U+FEFF.
 */
export function pyReadText(path: string): string {
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
    readFileSync(path),
  )
}

/**
 * The characters Python's `str.split()` and `str.strip()` treat as
 * whitespace. Not JavaScript's `\s`: Python also counts the ASCII
 * separators \x1c–\x1f, and does not count U+FEFF.
 */
const WS =
  '\\t\\n\\x0b\\x0c\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000'
const EDGE_WS = new RegExp(`^[${WS}]+|[${WS}]+$`, 'g')
const RUN_WS = new RegExp(`[${WS}]+`)

/** `s.strip()` */
export function pyStrip(s: string): string {
  return s.replace(EDGE_WS, '')
}

/** `s.split()`: split on runs of whitespace, dropping empty ends. */
export function pySplit(s: string): string[] {
  const stripped = pyStrip(s)
  return stripped ? stripped.split(RUN_WS) : []
}

/**
 * `int(s)` for a base-10 string: surrounding whitespace, a sign and single
 * underscores between digits are allowed. (Python also accepts other
 * scripts' decimal digits; the source data has none, so they are rejected.)
 */
export function pyInt(s: string | undefined): number {
  const text = s === undefined ? '' : pyStrip(s)
  if (!/^[+-]?\d+(?:_\d+)*$/.test(text)) {
    throw new Error(`invalid literal for int() with base 10: '${s}'`)
  }
  return Number(text.replaceAll('_', ''))
}

/** Python's `<` on strings: code point order, not UTF-16 unit order. */
export function compareCodePoints(a: string, b: string): number {
  let i = 0
  while (i < a.length && i < b.length) {
    const x = a.codePointAt(i)!
    const y = b.codePointAt(i)!
    if (x !== y) return x - y
    // Equal code points take the same number of units in both strings.
    i += x > 0xffff ? 2 : 1
  }
  return a.length - i - (b.length - i)
}

const SHORT_ESCAPES: Record<string, string> = {
  '"': '\\"',
  '\\': '\\\\',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
  '\b': '\\b',
  '\f': '\\f',
}

/**
 * A string as `json.dumps` writes it by default (`ensure_ascii=True`):
 * everything outside printable ASCII becomes `\uXXXX`, astral characters
 * as their surrogate pair.
 */
function asciiJsonString(s: string): string {
  return `"${s.replace(
    /[^ -~]|["\\]/g,
    (c) =>
      SHORT_ESCAPES[c] ?? `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  )}"`
}

/**
 * `json.dumps(value)` with its defaults: `", "` and `": "` separators and
 * ASCII-only strings. Integers only: a float's spelling (`1.0`) does not
 * survive `JSON.parse`, so a non-integer number is refused rather than
 * written differently.
 */
export function pyJsonDumps(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'string') return asciiJsonString(value)
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`pyJsonDumps writes integers only, got ${value}`)
    }
    return String(value)
  }
  if (Array.isArray(value)) return `[${value.map(pyJsonDumps).join(', ')}]`
  if (typeof value === 'object') {
    const items = Object.entries(value).map(
      ([key, item]) => `${asciiJsonString(key)}: ${pyJsonDumps(item)}`,
    )
    return `{${items.join(', ')}}`
  }
  throw new Error(`pyJsonDumps cannot write ${typeof value}`)
}
