import { queryOptions } from '@tanstack/react-query'
// The table is ~376 KB of JSON (built offline by `pnpm data:associations`).
// `?url` makes it a hashed static asset, fetched by the pages that need it
// and cached for good, rather than code in every bundle that imports this.
import associationsUrl from '../data/associations.json?url'
import type {
  AssociationData,
  AssociationRow,
  InheritanceBucket,
} from '../types'
import { INHERITANCE_BUCKETS } from '../types'

/** Every disease-associated gene, for the explorer and the gene pages. */
export const associationsQuery = queryOptions({
  queryKey: ['disease-associations'],
  queryFn: async (): Promise<AssociationRow[]> => {
    const response = await fetch(associationsUrl)
    if (!response.ok) {
      throw new Error(`Disease associations: HTTP ${response.status}`)
    }
    return ((await response.json()) as AssociationData).rows
  },
  // A file built with the app: it can't change while the page is open.
  staleTime: Infinity,
})

export function findBySymbol(
  rows: AssociationRow[],
  symbol: string,
): AssociationRow | undefined {
  const q = symbol.toUpperCase()
  return rows.find((r) => r.symbol.toUpperCase() === q)
}

/**
 * Map a free-form OMIM inheritance string (e.g. "X-linked dominant") to one of
 * the coarse buckets the explorer filters on. Returns null if unrecognized.
 */
function bucketInheritance(term: string): InheritanceBucket | null {
  const t = term.toLowerCase()
  if (t.includes('x-linked')) return 'X-linked'
  if (t.includes('y-linked')) return 'Y-linked'
  if (t.includes('mitochondrial')) return 'Mitochondrial'
  if (t.includes('digenic')) return 'Digenic'
  if (t.includes('somatic')) return 'Somatic mutation'
  if (t.includes('multifactorial')) return 'Multifactorial'
  if (t.includes('isolated')) return 'Isolated cases'
  if (t.includes('autosomal dominant')) return 'Autosomal dominant'
  if (t.includes('autosomal recessive')) return 'Autosomal recessive'
  return null
}

export function rowBuckets(row: AssociationRow): Set<InheritanceBucket> {
  const buckets = new Set<InheritanceBucket>()
  for (const term of row.inheritance) {
    const b = bucketInheritance(term)
    if (b) buckets.add(b)
  }
  return buckets
}

type AssociationFilters = {
  query?: string
  inheritance?: InheritanceBucket[]
}

export function filterAssociations(
  rows: AssociationRow[],
  filters: AssociationFilters,
): AssociationRow[] {
  const q = filters.query?.trim().toLowerCase() ?? ''
  const buckets = filters.inheritance ?? []

  return rows.filter((row) => {
    if (q) {
      const hay =
        row.symbol.toLowerCase() +
        '\n' +
        row.name.toLowerCase() +
        '\n' +
        row.phenotypes.map((p) => p.name.toLowerCase()).join('\n')
      if (!hay.includes(q)) return false
    }
    if (buckets.length > 0) {
      const rowBucketSet = rowBuckets(row)
      if (!buckets.some((b) => rowBucketSet.has(b))) return false
    }
    return true
  })
}

export const SORT_KEYS = ['symbol', 'phenotypes', 'cds'] as const
export type SortKey = (typeof SORT_KEYS)[number]
export type SortDir = 'asc' | 'desc'

export function sortAssociations(
  rows: AssociationRow[],
  key: SortKey,
  dir: SortDir,
): AssociationRow[] {
  // Rows with unknown largestCds always sort to the bottom regardless of dir,
  // so an empty value never jumps to the top of a "largest first" sort.
  const sign = dir === 'asc' ? 1 : -1
  const copy = [...rows]
  copy.sort((a, b) => {
    if (key === 'symbol') return sign * a.symbol.localeCompare(b.symbol)
    if (key === 'phenotypes')
      return sign * (a.phenotypes.length - b.phenotypes.length)
    const av = a.largestCds
    const bv = b.largestCds
    if (av == null && bv == null) return a.symbol.localeCompare(b.symbol)
    if (av == null) return 1
    if (bv == null) return -1
    return sign * (av - bv)
  })
  return copy
}

export function bucketCounts(
  rows: AssociationRow[],
): Record<InheritanceBucket, number> {
  const counts = Object.fromEntries(
    INHERITANCE_BUCKETS.map((b) => [b, 0]),
  ) as Record<InheritanceBucket, number>
  for (const row of rows) {
    for (const b of rowBuckets(row)) counts[b]++
  }
  return counts
}
