import { describe, expect, it } from 'vite-plus/test'
import { escapeMarkdownTableCell } from './markdown-table'

describe('escapeMarkdownTableCell', () => {
  it('leaves plain text alone', () => {
    expect(escapeMarkdownTableCell('GC content 41.2%')).toBe('GC content 41.2%')
  })

  it('escapes pipes so they stay inside the cell', () => {
    expect(escapeMarkdownTableCell('a|b')).toBe('a\\|b')
  })

  it('escapes backslashes before pipes, so an escaped pipe stays escaped', () => {
    // Input `\|`: escaping only the pipe would give `\\|`, an escaped
    // backslash followed by a bare pipe that splits the row.
    expect(escapeMarkdownTableCell('x\\|y')).toBe('x\\\\\\|y')
  })

  it('folds line breaks into spaces', () => {
    expect(escapeMarkdownTableCell('one\ntwo\r\nthree')).toBe('one two three')
  })
})
