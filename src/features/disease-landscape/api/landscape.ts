import { cache } from 'react'
import landscape from '../data/landscape.json'
import type { LandscapeData, LandscapeRow, InheritanceBucket } from '../types'
import { INHERITANCE_BUCKETS } from '../types'

const data = landscape as LandscapeData

export const getLandscape = cache((): LandscapeRow[] => data.rows)

export const findByEnsemblId = cache(
  (ensemblGeneId: string): LandscapeRow | undefined =>
    data.rows.find((r) => r.ensemblGeneId === ensemblGeneId),
)

export const findBySymbol = cache(
  (symbol: string): LandscapeRow | undefined => {
    const q = symbol.toUpperCase()
    return data.rows.find((r) => r.symbol.toUpperCase() === q)
  },
)

/**
 * Map a free-form OMIM inheritance string (e.g. "X-linked dominant") to one of
 * the coarse buckets the explorer filters on. Returns null if unrecognized.
 */
export function bucketInheritance(term: string): InheritanceBucket | null {
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

export function rowBuckets(row: LandscapeRow): Set<InheritanceBucket> {
  const buckets = new Set<InheritanceBucket>()
  for (const term of row.inheritance) {
    const b = bucketInheritance(term)
    if (b) buckets.add(b)
  }
  return buckets
}

export type LandscapeFilters = {
  query?: string
  inheritance?: InheritanceBucket[]
}

export function filterLandscape(
  rows: LandscapeRow[],
  filters: LandscapeFilters,
): LandscapeRow[] {
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

export function sortLandscape(
  rows: LandscapeRow[],
  key: SortKey,
  dir: SortDir,
): LandscapeRow[] {
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
  rows: LandscapeRow[],
): Record<InheritanceBucket, number> {
  const counts = Object.fromEntries(
    INHERITANCE_BUCKETS.map((b) => [b, 0]),
  ) as Record<InheritanceBucket, number>
  for (const row of rows) {
    for (const b of rowBuckets(row)) counts[b]++
  }
  return counts
}
