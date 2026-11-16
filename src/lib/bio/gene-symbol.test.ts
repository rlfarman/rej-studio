import { describe, expect, it } from 'vitest'
import { MAX_GENE_SYMBOL_LENGTH, isPlausibleGeneSymbol } from './gene-symbol'

describe('isPlausibleGeneSymbol', () => {
  it.each([
    'TP53',
    'Trp53',
    'BRCA1',
    'HLA-A',
    'MT-CO1',
    'C1orf112',
    '4933400A11Rik',
    'AC012345.1',
    'Y_RNA',
    'IGH@',
  ])('accepts %s', (symbol) => {
    expect(isPlausibleGeneSymbol(symbol)).toBe(true)
  })

  it.each([
    '',
    '-TP53',
    '.env',
    'TP53 ',
    'TP53/../x',
    'TP53<script>',
    'TP53%00',
    'ΤP53', // Greek capital tau
    'A'.repeat(MAX_GENE_SYMBOL_LENGTH + 1),
  ])('rejects %j', (symbol) => {
    expect(isPlausibleGeneSymbol(symbol)).toBe(false)
  })

  it('accepts a symbol at the length limit', () => {
    expect(isPlausibleGeneSymbol('A'.repeat(MAX_GENE_SYMBOL_LENGTH))).toBe(true)
  })
})
