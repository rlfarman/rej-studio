import { Fragment } from 'react'

/*
 * Highlighting that tracks what search actually matched.
 *
 * Search matches a symbol or alternate symbol by the whole query as a
 * prefix, and a name by every query word as a word or prefix of one (see
 * `corpus/gene-text-search.ts`). So a run is highlighted only where it
 * starts a word: marking every "a" inside "receptor" for the query "a"
 * claimed a match the search never made, and left the row looking as though
 * it had matched on something it had not.
 *
 * A typo match has no run to mark — nothing in the text is what was typed —
 * and gets no highlight; the row's reason line ("Close spelling of the
 * symbol") is what says why it is there.
 */

/** Where one word ends and the next begins, as the name tokenizer splits. */
const WORD_BREAK = /[^\p{L}\p{N}]/u

function startsWord(text: string, at: number): boolean {
  return at === 0 || WORD_BREAK.test(text[at - 1])
}

/** The query's words, longest first so the longest run wins at a position. */
function queryWords(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(WORD_BREAK)
    .filter((word) => word.length > 0)
    .sort((a, b) => b.length - a.length)
}

/**
 * `text` split into alternating plain and matched runs, starting with a
 * plain one (which may be empty), as `String.split` with a capturing group
 * would: odd indexes are the matches.
 */
function splitOnMatches(text: string, words: string[]): string[] {
  const lower = text.toLowerCase()
  const parts: string[] = []
  let plainFrom = 0
  for (let i = 0; i < text.length; i++) {
    if (!startsWord(text, i)) continue
    const word = words.find((w) => lower.startsWith(w, i))
    if (!word) continue
    parts.push(text.slice(plainFrom, i), text.slice(i, i + word.length))
    plainFrom = i + word.length
    // Skip the run just taken; the next match starts a later word.
    i = plainFrom - 1
  }
  parts.push(text.slice(plainFrom))
  return parts
}

export function HighlightMatch({
  text,
  query,
}: {
  text: string
  query: string
}) {
  const words = queryWords(query)
  if (words.length === 0) return <>{text}</>

  const parts = splitOnMatches(text, words)

  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-sm bg-primary/20 text-inherit">
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
}
