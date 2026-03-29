import { describe, it, expect } from 'vitest'
import {
  getAllGenes,
  findGeneBySymbol,
  searchGenes,
  loadCodingSequence,
  hasPrecomputedZip,
} from '@/lib/genes'

describe('getAllGenes', () => {
  it('returns an array of genes', () => {
    const genes = getAllGenes()
    expect(Array.isArray(genes)).toBe(true)
    expect(genes.length).toBeGreaterThan(0)
  })

  it('each gene has required fields', () => {
    const genes = getAllGenes()
    const gene = genes[0]
    expect(gene).toHaveProperty('symbol')
    expect(gene).toHaveProperty('name')
    expect(gene).toHaveProperty('ENSG')
    expect(gene).toHaveProperty('chromosome')
    expect(gene).toHaveProperty('isoforms')
    expect(Array.isArray(gene.isoforms)).toBe(true)
  })

  it('isoforms have required fields', () => {
    const genes = getAllGenes()
    const gene = genes.find((g) => g.isoforms.length > 0)
    expect(gene).toBeDefined()
    const isoform = gene!.isoforms[0]
    expect(isoform).toHaveProperty('ENST')
    expect(isoform).toHaveProperty('length')
    expect(isoform).toHaveProperty('packagability')
    expect(isoform).toHaveProperty('species')
    expect(['Human', 'Mouse']).toContain(isoform.species)
  })
})

describe('findGeneBySymbol', () => {
  it('returns a gene when found', () => {
    const allGenes = getAllGenes()
    const symbol = allGenes[0].symbol
    const gene = findGeneBySymbol(symbol)
    expect(gene).toBeDefined()
    expect(gene!.symbol).toBe(symbol)
  })

  it('returns undefined for non-existent symbol', () => {
    const gene = findGeneBySymbol('NONEXISTENT_GENE_XYZ')
    expect(gene).toBeUndefined()
  })

  it('is case-sensitive', () => {
    const allGenes = getAllGenes()
    const symbol = allGenes[0].symbol
    const gene = findGeneBySymbol(symbol.toLowerCase())
    // Gene symbols are uppercase; lowercase should not match
    if (symbol !== symbol.toLowerCase()) {
      expect(gene).toBeUndefined()
    }
  })
})

describe('searchGenes', () => {
  it('returns genes and hasMore flag for empty query', () => {
    const result = searchGenes('')
    expect(result).toHaveProperty('genes')
    expect(result).toHaveProperty('hasMore')
    expect(Array.isArray(result.genes)).toBe(true)
  })

  it('respects the limit parameter', () => {
    const result = searchGenes('', 5)
    expect(result.genes.length).toBeLessThanOrEqual(5)
  })

  it('finds genes by symbol', () => {
    const allGenes = getAllGenes()
    const target = allGenes[0]
    const result = searchGenes(target.symbol)
    expect(result.genes.some((g) => g.symbol === target.symbol)).toBe(true)
  })

  it('finds genes by partial name match', () => {
    const allGenes = getAllGenes()
    const target = allGenes.find((g) => g.name.length > 5)
    if (target) {
      const partial = target.name.slice(0, 4)
      const result = searchGenes(partial)
      expect(result.genes.length).toBeGreaterThan(0)
    }
  })

  it('returns empty results for nonsense query', () => {
    const result = searchGenes('zzzznonexistent99999')
    expect(result.genes).toHaveLength(0)
    expect(result.hasMore).toBe(false)
  })

  it('sets hasMore=true when results exceed limit', () => {
    const result = searchGenes('', 1)
    // There are many genes, so limiting to 1 should flag hasMore
    expect(result.hasMore).toBe(true)
    expect(result.genes).toHaveLength(1)
  })
})

describe('loadCodingSequence', () => {
  it('returns empty string for non-existent ENST', () => {
    const seq = loadCodingSequence('ENST_FAKE_000')
    expect(seq).toBe('')
  })

  it('returns a string for a real ENST', () => {
    const allGenes = getAllGenes()
    const gene = allGenes.find((g) => g.isoforms.length > 0)
    if (gene) {
      const enst = gene.isoforms[0].ENST
      const seq = loadCodingSequence(enst)
      expect(typeof seq).toBe('string')
    }
  })
})

describe('hasPrecomputedZip', () => {
  it('returns false for non-existent files', async () => {
    const result = await hasPrecomputedZip('FAKE', 'ENST_FAKE_000')
    expect(result).toBe(false)
  })
})
