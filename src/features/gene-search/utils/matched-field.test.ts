import { describe, expect, it } from 'vite-plus/test'
import { matchedField } from './matched-field'

const tp53 = { symbol: 'TP53', name: 'Tumor Protein P53' }

describe('matchedField', () => {
  it('reports a transcript match first', () => {
    expect(
      matchedField(
        { ...tp53, matchedIsoformId: 'ENST00000269305' },
        'ENST00000269305',
      ),
    ).toEqual({ kind: 'transcript', id: 'ENST00000269305' })
  })

  it('recognises Ensembl gene IDs', () => {
    expect(matchedField(tp53, 'ENSG00000141510')).toEqual({ kind: 'geneId' })
  })

  it('prefers the symbol over the name, ignoring case', () => {
    expect(matchedField(tp53, 'tp5')).toEqual({ kind: 'symbol' })
  })

  it('falls back to the name', () => {
    expect(matchedField(tp53, ' tumor ')).toEqual({ kind: 'name' })
  })

  it('treats anything else as an alias or related term', () => {
    expect(matchedField(tp53, 'LFS1')).toEqual({ kind: 'alias' })
  })

  it('uses what search reports, typo included, over guessing', () => {
    expect(
      matchedField({ ...tp53, match: { field: 'symbol', typo: true } }, 'tp35'),
    ).toEqual({ kind: 'symbol', typo: true })
  })
})
