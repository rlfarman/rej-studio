/**
 * Reusable test data factories.
 */
import type { SavedGene } from '@/features/gene-search/types/domain-types'

let geneCounter = 0

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
}
