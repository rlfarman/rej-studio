import { describe, expect, it } from 'vite-plus/test'

import { detectQueryMode, parseBpQuery, parseSequenceQuery } from './toolbar'

/**
 * What the "Go to" field accepts. Every bp in the editor is rendered with
 * thousands separators and a "bp" suffix, so those have to read back as the
 * position they name rather than falling through to the sequence search.
 */

describe('parseBpQuery', () => {
  it('reads a bp back as this UI writes one', () => {
    expect(parseBpQuery('1083')).toBe(1083)
    expect(parseBpQuery('1,083')).toBe(1083)
    expect(parseBpQuery('1,083 bp')).toBe(1083)
    expect(parseBpQuery(' 1 083 BP ')).toBe(1083)
    expect(parseBpQuery('10,257bp')).toBe(10257)
  })

  it('is null for anything that is not a plain position', () => {
    expect(parseBpQuery('')).toBeNull()
    expect(parseBpQuery('xyz')).toBeNull()
    expect(parseBpQuery('bp')).toBeNull()
    expect(parseBpQuery('GGTGG')).toBeNull()
    expect(parseBpQuery('12.5')).toBeNull()
    expect(parseBpQuery('-4')).toBeNull()
  })
})

describe('parseSequenceQuery', () => {
  it('takes the bases as typed, U as T', () => {
    expect(parseSequenceQuery('ggtgg')).toEqual({
      bases: 'GGTGG',
      invalid: false,
    })
    expect(parseSequenceQuery('ggu gg')).toEqual({
      bases: 'GGTGG',
      invalid: false,
    })
  })

  it('refuses a query with a non-base rather than searching part of it', () => {
    // "GGTGGNNN" used to be stripped to "GGTGG" and reported matches of a
    // query the person never typed.
    expect(parseSequenceQuery('GGTGGNNN')).toEqual({ bases: '', invalid: true })
    expect(parseSequenceQuery('xyz')).toEqual({ bases: '', invalid: true })
  })

  it('is neither valid nor invalid when empty', () => {
    expect(parseSequenceQuery('   ')).toEqual({ bases: '', invalid: false })
  })
})

describe('detectQueryMode', () => {
  it('routes a written-out bp to the bp mode', () => {
    expect(detectQueryMode('')).toBe('idle')
    expect(detectQueryMode('1200')).toBe('bp')
    expect(detectQueryMode('1,200')).toBe('bp')
    expect(detectQueryMode('1200 bp')).toBe('bp')
    expect(detectQueryMode('GGTGG')).toBe('sequence')
    expect(detectQueryMode('xyz')).toBe('sequence')
  })
})
