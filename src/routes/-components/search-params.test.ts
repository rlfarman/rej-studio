import { describe, expect, it } from 'vite-plus/test'
import { z } from 'zod'

import {
  searchList,
  searchOneOf,
  searchPositiveInt,
  searchText,
} from './search-params'

const schema = z.object({
  q: searchText,
  page: searchPositiveInt,
  dir: searchOneOf(['asc', 'desc']),
  i: searchList(['a', 'b']),
})

describe('search param schemas', () => {
  it('keeps valid values', () => {
    expect(schema.parse({ q: 'tp53', page: 2, dir: 'desc', i: ['a'] })).toEqual(
      { q: 'tp53', page: 2, dir: 'desc', i: ['a'] },
    )
  })

  it('reads a query the router parsed as a number as text', () => {
    expect(schema.parse({ q: 53 }).q).toBe('53')
  })

  it('drops what a hand-edited URL got wrong, keeping the rest', () => {
    expect(
      schema.parse({ q: '', page: -1, dir: 'sideways', i: ['c'] }),
    ).toEqual({
      q: undefined,
      page: undefined,
      dir: undefined,
      i: undefined,
    })
    expect(schema.parse({ q: 'x', page: 'two' })).toEqual({ q: 'x' })
  })

  it('accepts a single list value, as older links wrote it', () => {
    expect(schema.parse({ i: 'b' }).i).toEqual(['b'])
    expect(schema.parse({ i: ['a', 'c', 'b'] }).i).toEqual(['a', 'b'])
  })
})
