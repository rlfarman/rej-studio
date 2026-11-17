import { describe, expect, it } from 'vite-plus/test'
import { diseaseSearchLink, geneLink, searchPageLink } from './search-href'

describe('searchPageLink', () => {
  it('omits the default species', () => {
    expect(searchPageLink('tp53', 'both')).toEqual({
      to: '/genes',
      search: { q: 'tp53' },
    })
  })

  it('keeps a species filter', () => {
    expect(searchPageLink('tp53', 'mouse')).toEqual({
      to: '/genes',
      search: { q: 'tp53', species: 'mouse' },
    })
  })

  it('returns the bare page for no query', () => {
    expect(searchPageLink('', 'both')).toEqual({ to: '/genes', search: {} })
  })
})

describe('geneLink', () => {
  it('links the symbol alone', () => {
    expect(geneLink('BRCA1')).toEqual({
      to: '/genes/$symbol',
      params: { symbol: 'BRCA1' },
      search: {},
    })
  })

  it('keeps the species and the isoform', () => {
    expect(geneLink('BRCA1', 'mouse', 'ENST00000001')).toEqual({
      to: '/genes/$symbol',
      params: { symbol: 'BRCA1' },
      search: { species: 'mouse', isoform: 'ENST00000001' },
    })
  })

  it('drops a species the page does not filter on', () => {
    expect(geneLink('BRCA1', 'zebrafish').search).toEqual({})
  })
})

describe('diseaseSearchLink', () => {
  it('prefills the query', () => {
    expect(diseaseSearchLink('cystic fibrosis')).toEqual({
      to: '/disease-associations',
      search: { q: 'cystic fibrosis' },
    })
  })
})
