/**
 * The slice of Postgres full-text search that gene search ranks with,
 * reimplemented so the browser can rank results the way the database did.
 *
 * The Postgres path (gene-queries.ts) builds each gene's vector as
 *
 *   setweight(to_tsvector('simple', symbol), 'A') ||
 *   setweight(to_tsvector('simple', name), 'B') ||
 *   setweight(to_tsvector('simple', aliases), 'C')
 *
 * matches it against `plainto_tsquery('simple', q)` and orders by
 * `ts_rank(vector, query)`. This file mirrors those three pieces:
 *
 * - `lexemes()` follows Postgres's default text parser closely enough to
 *   reproduce every gene vector in the corpus (checked against the database
 *   when the corpus was built): words, hyphenated compounds plus their
 *   parts, dotted host/version tokens, slash paths, signed numbers, and
 *   skipped XML-like tags such as `P56<LCK>`. The 'simple' dictionary only
 *   lowercases, so there is no stemming and no stopword list.
 * - `geneVector()` concatenates the three weighted vectors with the same
 *   position offsets as tsvector `||`.
 * - `tsRank()` is `ts_rank` with default weights and normalization 0,
 *   including its float4 arithmetic, so equal ranks tie exactly as they did
 *   in SQL and the name/id tie-breakers decide.
 */

/** ts_rank's default weights, indexed by weight class: D, C, B, A. */
const WEIGHTS = [0.1, 0.2, 0.4, 1.0] as const
const WEIGHT_A = 3
const WEIGHT_B = 2
const WEIGHT_C = 1

const f32 = Math.fround

/** What ts_rank returns when calc_rank_and finds no pair of lexemes. */
export const RANK_FLOOR = f32(1e-20)

const isDigit = (c: string | undefined) =>
  c !== undefined && c >= '0' && c <= '9'
const isLetter = (c: string | undefined) =>
  c !== undefined && (/[a-z]/.test(c) || (c > '\x7f' && /\p{L}/u.test(c)))
const isAlnum = (c: string | undefined) => isDigit(c) || isLetter(c)

function hasLetter(word: string): boolean {
  for (const c of word) if (isLetter(c)) return true
  return false
}

/** End index of the run of letters and digits starting at `i`. */
function runEnd(s: string, i: number): number {
  while (isAlnum(s[i])) i++
  return i
}

/** End of a slash path's segment: letters, digits, `.`, `-` and `_`. */
function pathEnd(s: string, i: number): number {
  while (isAlnum(s[i]) || s[i] === '.' || s[i] === '-' || s[i] === '_') i++
  return i
}

/** Consume `/segment` repeats from `i` (pointing at a slash). */
function pathTail(s: string, i: number): number {
  while (s[i] === '/' && isAlnum(s[i + 1])) i = pathEnd(s, i + 1)
  return i
}

/**
 * Read the token that starts with a letter or digit at `start`, push its
 * lexemes, and return where scanning resumes.
 */
function readWord(s: string, start: number, out: string[]): number {
  const end = runEnd(s, start)
  const word = s.slice(start, end)

  // Digits, `e`, digits reads as a number in scientific notation and ends
  // there, so the Riken clone `1110036e10rik` is `1110036e10` and `rik`
  // (while `4432404p07rik` stays one word), and `363e6.2` is `363e6` and
  // `2`.
  const scientific = /^[0-9]+e[0-9]+/.exec(word)
  if (scientific) {
    out.push(scientific[0])
    return start + scientific[0].length
  }
  const next = s[end]
  const after = s[end + 1]

  // Dotted: a host-like token when the word has a letter (`c5.1`,
  // `dj20n2.5`, `214k23.2`, `a.b-c`), a version/decimal when all digits
  // (`1.2.3`). `1.a` is two words.
  if (next === '.' && isAlnum(after)) {
    if (hasLetter(word)) {
      let i = end
      while ((s[i] === '.' || s[i] === '-') && isAlnum(s[i + 1])) {
        i = runEnd(s, i + 1)
      }
      i = pathTail(s, i)
      out.push(s.slice(start, i))
      return i
    }
    if (!hasLetter(word) && isDigit(after)) {
      let i = end
      while (s[i] === '.' && isDigit(s[i + 1])) {
        i++
        while (isDigit(s[i])) i++
      }
      out.push(s.slice(start, i))
      return i
    }
  }

  // Hyphenated compound (`hla-a`, `rab-1a`, `hel-s`): every part needs a
  // letter, so `foo-1` is a word and a signed number instead. Emits the
  // whole compound, then each part.
  if (next === '-' && isAlnum(after) && hasLetter(word)) {
    const parts = [word]
    let i = end
    while (s[i] === '-' && isAlnum(s[i + 1])) {
      const partEnd = runEnd(s, i + 1)
      const part = s.slice(i + 1, partEnd)
      if (!hasLetter(part)) break
      parts.push(part)
      i = partEnd
    }
    if (parts.length > 1) {
      out.push(parts.join('-'), ...parts)
      // The parser has already consumed the hyphen of a trailing `-12`, so
      // the number that follows is unsigned (`hel-s-18` gives `18`).
      return s[i] === '-' && isDigit(s[i + 1]) ? i + 1 : i
    }
  }

  // Slash path (`cftr/mrp`, `mdr2/3`, `a/b-c`): one lexeme.
  if (next === '/' && isAlnum(after)) {
    const i = pathTail(s, end)
    out.push(s.slice(start, i))
    return i
  }

  out.push(word)
  return end
}

/**
 * The lexemes `to_tsvector('simple', text)` produces, in position order
 * (the lexeme at index i has position i + 1).
 */
export function lexemes(text: string): string[] {
  const s = text.toLowerCase()
  const out: string[] = []
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (isAlnum(c)) {
      i = readWord(s, i, out)
    } else if ((c === '-' || c === '+') && isDigit(s[i + 1])) {
      // Signed integer or decimal: `-1`, `+89`, `-1.5`.
      let j = i + 1
      while (isDigit(s[j])) j++
      while (s[j] === '.' && isDigit(s[j + 1])) {
        j++
        while (isDigit(s[j])) j++
      }
      out.push(s.slice(i, j))
      i = j
    } else if (c === '/' && isAlnum(s[i + 1])) {
      // A path with nothing before it: `na+/k+` gives `/k`.
      const j = pathTail(s, i)
      out.push(s.slice(i, j))
      i = j
    } else if (c === '<' && isLetter(s[i + 1]) && s.indexOf('>', i) > i) {
      // XML-like tags are a token type 'simple' doesn't index: `p56<lck>`
      // is just `p56`.
      i = s.indexOf('>', i) + 1
    } else {
      i++
    }
  }
  return out
}

/**
 * A lexeme's positions, each packed as `position * 4 + weightClass`, in
 * ascending position order (tsvector's storage order).
 */
type Positions = number[]

/** Lexeme → packed positions, i.e. a tsvector. */
export type TsVector = ReadonlyMap<string, Positions>

/**
 * Build the vector the Postgres path stores in `genes.search_vector`:
 * symbol (A) || name (B) || aliases (C). tsvector `||` shifts the right
 * operand's positions by the left operand's highest position.
 */
export function geneVector(
  symbol: string,
  name: string,
  alternateSymbols: string,
): TsVector {
  const vector = new Map<string, Positions>()
  let offset = 0
  const parts: [string, number][] = [
    [symbol, WEIGHT_A],
    [name, WEIGHT_B],
    [alternateSymbols.replaceAll('|', ' '), WEIGHT_C],
  ]
  for (const [text, weight] of parts) {
    const words = lexemes(text)
    let maxPosition = 0
    // to_tsvector keeps one entry per lexeme; its positions ascend.
    for (let i = 0; i < words.length; i++) {
      const position = offset + i + 1
      const list = vector.get(words[i])
      if (list) list.push(position * 4 + weight)
      else vector.set(words[i], [position * 4 + weight])
      maxPosition = position
    }
    if (words.length > 0) offset = maxPosition
  }
  return vector
}

const weightOf = (packed: number) => WEIGHTS[packed & 3]
const positionOf = (packed: number) => packed >> 2

/** calc_rank_or in tsrank.c: used when the query has one distinct lexeme. */
function rankOr(terms: readonly string[], vector: TsVector): number {
  let res = 0
  for (const term of terms) {
    const positions = vector.get(term)
    if (!positions) continue
    let resj = 0
    let wjm = -1
    let jm = 0
    for (let j = 0; j < positions.length; j++) {
      const w = weightOf(positions[j])
      resj = f32(resj + f32(w / ((j + 1) * (j + 1))))
      if (w > wjm) {
        wjm = w
        jm = j
      }
    }
    // Inner sum in float4, then divided by a double constant (pi^2/6).
    const inner = f32(f32(wjm + resj) - f32(wjm / ((jm + 1) * (jm + 1))))
    res = f32(res + inner / 1.64493406685)
  }
  return terms.length > 0 ? f32(res / terms.length) : res
}

function wordDistance(distance: number): number {
  if (distance > 100) return f32(1e-30)
  return f32(1.0 / (1.005 + 0.05 * Math.exp(f32(distance) / 1.5 - 2)))
}

/** calc_rank_and in tsrank.c: proximity of each pair of query lexemes. */
function rankAnd(terms: readonly string[], vector: TsVector): number {
  let res = -1
  const found: (Positions | undefined)[] = []
  for (let i = 0; i < terms.length; i++) {
    const current = vector.get(terms[i])
    found.push(current)
    if (!current) continue
    for (let k = 0; k < i; k++) {
      const earlier = found[k]
      if (!earlier) continue
      for (const l of current) {
        for (const p of earlier) {
          // Two lexemes never share a position, so the distance is never
          // zero (tsrank.c's zero case only arises for position-less
          // vectors, which to_tsvector never builds).
          const distance = Math.abs(positionOf(l) - positionOf(p))
          const curw = f32(
            Math.sqrt(
              f32(f32(weightOf(l) * weightOf(p)) * wordDistance(distance)),
            ),
          )
          res = res < 0 ? curw : f32(1 - f32(f32(1 - res) * f32(1 - curw)))
        }
      }
    }
  }
  return res
}

/**
 * `ts_rank(vector, plainto_tsquery('simple', q))` with default weights and
 * no normalization. `terms` are the query's lexemes in query order.
 */
export function tsRank(terms: readonly string[], vector: TsVector): number {
  if (terms.length === 0 || vector.size === 0) return 0
  // Postgres sorts and de-duplicates the query's operands before ranking.
  const unique = [...new Set(terms)].sort(compareLexemes)
  const res =
    terms.length > 1 && unique.length > 1
      ? rankAnd(unique, vector)
      : rankOr(unique, vector)
  return res < 0 ? RANK_FLOOR : res
}

/** Byte order, as Postgres compares lexemes. */
function compareLexemes(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
