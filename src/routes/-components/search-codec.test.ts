import { describe, expect, it } from 'vite-plus/test'

import { parseSearch, stringifySearch } from './search-codec'

describe('parseSearch', () => {
  it('keeps every value as text, numbers included', () => {
    expect(parseSearch('?q=53&page=2&species=human')).toEqual({
      q: '53',
      page: '2',
      species: 'human',
    })
  })

  it('reads repeated keys as a list', () => {
    expect(parseSearch('i=X-linked&i=Y-linked')).toEqual({
      i: ['X-linked', 'Y-linked'],
    })
  })

  it('decodes spaces and escapes', () => {
    expect(parseSearch('?q=cystic+fibrosis&x=a%26b')).toEqual({
      q: 'cystic fibrosis',
      x: 'a&b',
    })
  })

  it('reads links written by the old JSON codec', () => {
    expect(parseSearch('?q=%2253%22')).toEqual({ q: '53' })
    expect(parseSearch('?i=%5B%22X-linked%22%2C%22Digenic%22%5D')).toEqual({
      i: ['X-linked', 'Digenic'],
    })
  })

  it('keeps text that only looks like JSON', () => {
    expect(parseSearch('?q=%5Babc')).toEqual({ q: '[abc' })
    expect(parseSearch('?q=%5B1%2C2%5D')).toEqual({ q: '[1,2]' })
    expect(parseSearch('?q=%22')).toEqual({ q: '"' })
  })

  it('returns nothing for an empty query', () => {
    expect(parseSearch('')).toEqual({})
    expect(parseSearch('?')).toEqual({})
  })
})

describe('stringifySearch', () => {
  it('writes plain text, unquoted', () => {
    expect(stringifySearch({ q: '53' })).toBe('?q=53')
    expect(stringifySearch({ page: 2, sort: 'cds' })).toBe('?page=2&sort=cds')
  })

  it('repeats the key for a list', () => {
    expect(stringifySearch({ i: ['X-linked', 'Digenic'] })).toBe(
      '?i=X-linked&i=Digenic',
    )
  })

  it('drops undefined and empty search', () => {
    expect(stringifySearch({ q: undefined, species: 'mouse' })).toBe(
      '?species=mouse',
    )
    expect(stringifySearch({})).toBe('')
  })

  it('round-trips through parseSearch', () => {
    const search = { q: 'brca 1', i: ['a', 'b'], dir: 'desc' }
    expect(parseSearch(stringifySearch(search))).toEqual(search)
  })
})
