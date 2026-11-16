import { describe, expect, it } from 'vitest'
import { diseaseSearchHref, searchPageHref } from './search-href'

describe('searchPageHref', () => {
  it('omits the default species', () => {
    expect(searchPageHref('tp53', 'both')).toBe('/genes?q=tp53')
  })

  it('keeps a species filter', () => {
    expect(searchPageHref('tp53', 'mouse')).toBe('/genes?q=tp53&species=mouse')
  })

  it('returns the bare page for no query', () => {
    expect(searchPageHref('', 'both')).toBe('/genes')
  })
})

describe('diseaseSearchHref', () => {
  it('encodes the query', () => {
    expect(diseaseSearchHref('cystic fibrosis')).toBe(
      '/disease-associations?q=cystic+fibrosis',
    )
  })
})
