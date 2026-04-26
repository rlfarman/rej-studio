/**
 * Reusable test data factories.
 */
import type { SelectGene, SelectIsoform } from '@/drizzle/schema'
import type { SavedGene } from '@/features/gene-search/types/domain-types'

let geneCounter = 0
let isoformCounter = 0

export function makeGene(overrides: Partial<SelectGene> = {}): SelectGene {
  geneCounter++
  return {
    id: `ENSG${String(geneCounter).padStart(11, '0')}`,
    symbol: `GENE${geneCounter}`,
    name: `Test Gene ${geneCounter}`,
    species: 'human',
    alternateSymbols: '',
    ...overrides,
  }
}

export function makeIsoform(
  overrides: Partial<SelectIsoform> = {},
): SelectIsoform {
  isoformCounter++
  return {
    id: `ENST${String(isoformCounter).padStart(11, '0')}`,
    geneId: `ENSG${String(isoformCounter).padStart(11, '0')}`,
    codingSequenceLength: 900,
    proteinSequenceLength: 300,
    codingSequence: 'ATGAAATGA',
    proteinSequence: 'MK*',
    species: 'human',
    ...overrides,
  }
}

export function makeSavedGene(overrides: Partial<SavedGene> = {}): SavedGene {
  geneCounter++
  return {
    id: `ENSG${String(geneCounter).padStart(11, '0')}`,
    symbol: `GENE${geneCounter}`,
    name: `Test Gene ${geneCounter}`,
    ...overrides,
  }
}

/** Reset counters between test suites if needed. */
export function resetFixtureCounters() {
  geneCounter = 0
  isoformCounter = 0
}
