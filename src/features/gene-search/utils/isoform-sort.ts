import type { Suitability } from '@/lib/bio/design-suitability'

/**
 * Isoform table sorting, kept in the URL (`?sort=gcPercent&dir=desc`) so a
 * sorted view can be shared. The default order (CDS length, ascending) has
 * no params.
 */

export const ISOFORM_SORT_KEYS = [
  'enst',
  'cdsLength',
  'proteinLength',
  'gcPercent',
  'cpg',
  'wggw',
  'suitability',
] as const

export type IsoformSortKey = (typeof ISOFORM_SORT_KEYS)[number]
export type SortDirection = 'asc' | 'desc'

export interface IsoformSort {
  key: IsoformSortKey
  dir: SortDirection
}

export const DEFAULT_ISOFORM_SORT: IsoformSort = {
  key: 'cdsLength',
  dir: 'asc',
}

function isSortKey(value: string | null): value is IsoformSortKey {
  return (ISOFORM_SORT_KEYS as readonly (string | null)[]).includes(value)
}

/** Read the sort from URL params, falling back to the default for junk. */
export function parseIsoformSort(params: URLSearchParams): IsoformSort {
  const key = params.get('sort')
  if (!isSortKey(key)) return DEFAULT_ISOFORM_SORT
  return { key, dir: params.get('dir') === 'desc' ? 'desc' : 'asc' }
}

/**
 * The sort after clicking a column: the active column flips direction, any
 * other column starts ascending.
 */
export function nextIsoformSort(
  current: IsoformSort,
  key: IsoformSortKey,
): IsoformSort {
  if (current.key !== key) return { key, dir: 'asc' }
  return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
}

/** Params with `sort`/`dir` set for `sort`, other params untouched. */
export function withIsoformSort(
  params: URLSearchParams,
  sort: IsoformSort,
): URLSearchParams {
  const next = new URLSearchParams(params)
  const isDefault =
    sort.key === DEFAULT_ISOFORM_SORT.key &&
    sort.dir === DEFAULT_ISOFORM_SORT.dir
  if (isDefault) {
    next.delete('sort')
    next.delete('dir')
  } else {
    next.set('sort', sort.key)
    next.set('dir', sort.dir)
  }
  return next
}

/** The value for a column header's `aria-sort`, or undefined if unsorted. */
export function ariaSortFor(
  sort: IsoformSort,
  key: IsoformSortKey,
): 'ascending' | 'descending' | undefined {
  if (sort.key !== key) return undefined
  return sort.dir === 'asc' ? 'ascending' : 'descending'
}

const SUITABILITY_RANK: Record<Suitability, number> = {
  'single-aav': 0,
  'dual-aav': 1,
  'triple-aav': 2,
}

export interface SortableIsoform {
  id: string
  codingSequenceLength: number
  proteinSequenceLength: number
  gcPercent: number
  cpgCount: number
  wggwCount: number
  suitability: Suitability
}

/** A sorted copy; ties keep their input order. */
export function sortIsoforms<T extends SortableIsoform>(
  rows: readonly T[],
  sort: IsoformSort,
): T[] {
  const value = (row: T): number | string => {
    switch (sort.key) {
      case 'enst':
        return row.id
      case 'cdsLength':
        return row.codingSequenceLength
      case 'proteinLength':
        return row.proteinSequenceLength
      case 'gcPercent':
        return row.gcPercent
      case 'cpg':
        return row.cpgCount
      case 'wggw':
        return row.wggwCount
      case 'suitability':
        return SUITABILITY_RANK[row.suitability]
    }
  }
  const sign = sort.dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const av = value(a)
    const bv = value(b)
    const cmp =
      typeof av === 'string' && typeof bv === 'string'
        ? av.localeCompare(bv)
        : (av as number) - (bv as number)
    return sign * cmp
  })
}
