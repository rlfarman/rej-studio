import { describe, expect, it } from 'vite-plus/test'
import {
  ariaSortFor,
  DEFAULT_ISOFORM_SORT,
  nextIsoformSort,
  parseIsoformSort,
  sortIsoforms,
  withIsoformSort,
  type SortableIsoform,
} from './isoform-sort'

function row(
  id: string,
  overrides: Partial<SortableIsoform> = {},
): SortableIsoform {
  return {
    id,
    codingSequenceLength: 900,
    proteinSequenceLength: 300,
    gcPercent: 50,
    cpgCount: 10,
    wggwCount: 3,
    suitability: 'single-aav',
    ...overrides,
  }
}

describe('parseIsoformSort', () => {
  it('defaults to CDS length ascending', () => {
    expect(parseIsoformSort(new URLSearchParams())).toEqual(
      DEFAULT_ISOFORM_SORT,
    )
  })

  it('reads a valid key and direction', () => {
    expect(
      parseIsoformSort(new URLSearchParams('sort=gcPercent&dir=desc')),
    ).toEqual({ key: 'gcPercent', dir: 'desc' })
  })

  it('treats a missing or unknown dir as ascending', () => {
    expect(parseIsoformSort(new URLSearchParams('sort=cpg&dir=up'))).toEqual({
      key: 'cpg',
      dir: 'asc',
    })
  })

  it('ignores an unknown key', () => {
    expect(
      parseIsoformSort(new URLSearchParams('sort=__proto__&dir=desc')),
    ).toEqual(DEFAULT_ISOFORM_SORT)
  })
})

describe('nextIsoformSort', () => {
  it('flips the direction of the active column', () => {
    expect(
      nextIsoformSort({ key: 'cdsLength', dir: 'asc' }, 'cdsLength'),
    ).toEqual({ key: 'cdsLength', dir: 'desc' })
  })

  it('starts a new column ascending', () => {
    expect(nextIsoformSort({ key: 'cdsLength', dir: 'desc' }, 'wggw')).toEqual({
      key: 'wggw',
      dir: 'asc',
    })
  })
})

describe('withIsoformSort', () => {
  it('writes sort and dir and keeps other params', () => {
    const params = withIsoformSort(
      new URLSearchParams('species=human&isoform=ENST1'),
      { key: 'cpg', dir: 'desc' },
    )
    expect(params.toString()).toBe(
      'species=human&isoform=ENST1&sort=cpg&dir=desc',
    )
  })

  it('drops the params for the default sort', () => {
    const params = withIsoformSort(
      new URLSearchParams('species=human&sort=cpg&dir=desc'),
      DEFAULT_ISOFORM_SORT,
    )
    expect(params.toString()).toBe('species=human')
  })
})

describe('ariaSortFor', () => {
  it('marks only the active column', () => {
    const sort = { key: 'gcPercent', dir: 'desc' } as const
    expect(ariaSortFor(sort, 'gcPercent')).toBe('descending')
    expect(ariaSortFor(sort, 'cpg')).toBeUndefined()
    expect(ariaSortFor({ key: 'cpg', dir: 'asc' }, 'cpg')).toBe('ascending')
  })
})

describe('sortIsoforms', () => {
  const rows = [
    row('ENST3', { codingSequenceLength: 300, suitability: 'triple-aav' }),
    row('ENST1', { codingSequenceLength: 100, suitability: 'single-aav' }),
    row('ENST2', { codingSequenceLength: 200, suitability: 'dual-aav' }),
  ]
  const ids = (sorted: SortableIsoform[]) => sorted.map((r) => r.id)

  it('sorts numerically', () => {
    expect(ids(sortIsoforms(rows, { key: 'cdsLength', dir: 'asc' }))).toEqual([
      'ENST1',
      'ENST2',
      'ENST3',
    ])
    expect(ids(sortIsoforms(rows, { key: 'cdsLength', dir: 'desc' }))).toEqual([
      'ENST3',
      'ENST2',
      'ENST1',
    ])
  })

  it('sorts IDs as strings', () => {
    expect(ids(sortIsoforms(rows, { key: 'enst', dir: 'asc' }))).toEqual([
      'ENST1',
      'ENST2',
      'ENST3',
    ])
  })

  it('sorts suitability by AAV tier, not alphabetically', () => {
    expect(ids(sortIsoforms(rows, { key: 'suitability', dir: 'asc' }))).toEqual(
      ['ENST1', 'ENST2', 'ENST3'],
    )
  })

  it("doesn't mutate the input", () => {
    sortIsoforms(rows, { key: 'enst', dir: 'asc' })
    expect(ids(rows)).toEqual(['ENST3', 'ENST1', 'ENST2'])
  })
})
