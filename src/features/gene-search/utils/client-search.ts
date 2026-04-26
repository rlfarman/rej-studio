import MiniSearch from 'minisearch'
import { ENSG_REGEX, ENST_REGEX } from './ensembl-regex'
import type { SpeciesFilter } from '@/lib/bio/species'

export interface GeneSearchResult {
  id: string
  name: string
  symbol: string
  species: string
  matchedIsoformId?: string
}

interface SearchDoc {
  id: string
  geneId: string
  symbol: string
  name: string
  species: string
  alternateSymbols: string[]
}

type IsoformIndex = Record<string, { symbol: string; species: string }>
type Manifest = {
  genes: Array<{ id: string; symbol: string; species: string }>
}

const indexCache = new Map<string, Promise<MiniSearch<SearchDoc>>>()
let isoformIndexPromise: Promise<IsoformIndex> | null = null
let manifestPromise: Promise<Manifest> | null = null
const geneFilesCache = new Map<string, Promise<GeneSearchResult[]>>()

async function loadShard(species: string): Promise<MiniSearch<SearchDoc>> {
  let cached = indexCache.get(species)
  if (cached) return cached
  cached = (async () => {
    const res = await fetch(`/data/search-index-${species}.json`)
    if (!res.ok) throw new Error(`Failed to load search index: ${res.status}`)
    const json = await res.json()
    return MiniSearch.loadJS<SearchDoc>(json, {
      fields: ['symbol', 'name', 'alternateSymbols'],
      storeFields: ['geneId', 'symbol', 'name', 'species'],
      tokenize: (text) =>
        text
          .toLowerCase()
          .split(/[^a-z0-9]+/i)
          .filter(Boolean),
      searchOptions: {
        boost: { symbol: 5, alternateSymbols: 3, name: 1 },
        prefix: true,
        fuzzy: 0.2,
      },
    })
  })()
  indexCache.set(species, cached)
  return cached
}

async function loadIsoformIndex(): Promise<IsoformIndex> {
  if (!isoformIndexPromise) {
    isoformIndexPromise = (async () => {
      const res = await fetch('/data/isoform-index.json')
      if (!res.ok)
        throw new Error(`Failed to load isoform index: ${res.status}`)
      return (await res.json()) as IsoformIndex
    })()
  }
  return isoformIndexPromise
}

async function loadManifest(): Promise<Manifest> {
  if (!manifestPromise) {
    manifestPromise = (async () => {
      const res = await fetch('/data/manifest.json')
      if (!res.ok) throw new Error(`Failed to load manifest: ${res.status}`)
      return (await res.json()) as Manifest
    })()
  }
  return manifestPromise
}

async function loadGeneByExactId(id: string): Promise<GeneSearchResult | null> {
  const manifest = await loadManifest()
  const entry = manifest.genes.find((g) => g.id === id)
  if (!entry) return null
  const file = await loadGeneFile(entry.symbol)
  return file.find((g) => g.id === id) ?? null
}

async function loadGeneFile(symbol: string): Promise<GeneSearchResult[]> {
  let cached = geneFilesCache.get(symbol)
  if (cached) return cached
  cached = (async () => {
    const res = await fetch(`/data/genes/${encodeURIComponent(symbol)}.json`)
    if (!res.ok) return []
    const arr = (await res.json()) as Array<{
      id: string
      name: string
      symbol: string
      species: string
    }>
    return arr.map((g) => ({
      id: g.id,
      name: g.name,
      symbol: g.symbol,
      species: g.species,
    }))
  })()
  geneFilesCache.set(symbol, cached)
  return cached
}

function speciesShards(filter: SpeciesFilter): string[] {
  if (filter === 'human' || filter === 'mouse') return [filter]
  return ['human', 'mouse']
}

export async function searchGenesClient(
  query: string,
  species: SpeciesFilter,
): Promise<GeneSearchResult[]> {
  const trimmed = query.trim()
  if (trimmed.length === 0) return []

  // Direct ENST / ENSMUST lookup → return the gene with matchedIsoformId.
  if (ENST_REGEX.test(trimmed)) {
    const idx = await loadIsoformIndex()
    const ref = idx[trimmed]
    if (!ref) return []
    if (species !== 'both' && ref.species !== species) return []
    const file = await loadGeneFile(ref.symbol)
    const gene = file.find((g) => g.species === ref.species)
    if (!gene) return []
    return [{ ...gene, matchedIsoformId: trimmed }]
  }

  // Direct ENSG / ENSMUSG lookup. Don't scan — fall through to MiniSearch
  // (the index includes geneId-as-symbol won't match, but the user typing a
  // full ENSG id is rare and MiniSearch's prefix won't help). For correctness
  // we do an explicit scan via loadGeneByExactId, but bounded: it walks
  // the isoform index then loads at most a handful of gene files.
  if (ENSG_REGEX.test(trimmed)) {
    const match = await loadGeneByExactId(trimmed)
    if (!match) return []
    if (species !== 'both' && match.species !== species) return []
    return [match]
  }

  const shards = await Promise.all(speciesShards(species).map(loadShard))
  const lower = trimmed.toLowerCase()
  const aggregated = shards.flatMap((mini) =>
    mini.search(trimmed, {
      boost: { symbol: 5, alternateSymbols: 3, name: 1 },
      prefix: true,
      fuzzy: 0.2,
      combineWith: 'AND',
    }),
  )

  // MiniSearch scores are reasonable but biology queries benefit from extra
  // boost on exact symbol / prefix matches. Re-rank in the wrapper.
  type Stored = SearchDoc & { score: number }
  const reranked: Stored[] = aggregated.map((hit) => {
    const symbolLower = (hit.symbol as string).toLowerCase()
    let bonus = 0
    if (symbolLower === lower) bonus = 1000
    else if (symbolLower.startsWith(lower)) bonus = 200
    else if (symbolLower.includes(lower)) bonus = 50
    return {
      id: hit.id as string,
      geneId: hit.geneId as string,
      symbol: hit.symbol as string,
      name: hit.name as string,
      species: hit.species as string,
      alternateSymbols: [],
      score: (hit.score as number) + bonus,
    }
  })
  reranked.sort((a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol))

  // Dedup by geneId.
  const seen = new Set<string>()
  const out: GeneSearchResult[] = []
  for (const r of reranked) {
    if (seen.has(r.geneId)) continue
    seen.add(r.geneId)
    out.push({
      id: r.geneId,
      name: r.name,
      symbol: r.symbol,
      species: r.species,
    })
    if (out.length >= 6) break
  }
  return out
}
