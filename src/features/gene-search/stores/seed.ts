'use client'

import { useFavoriteGenes } from '@/features/gene-search/stores/favorite-genes-store'
import { useRecentGenes } from '@/features/gene-search/stores/recent-genes-store'
import type { SavedGene } from '@/features/gene-search/types/domain-types'

// Gene metadata below mirrors what Neon returns for these exact gene_ids
// (pulled from drizzle/transcript_metadata.csv — sym1 primary symbol and
// title-cased gene_name). Matching the DB verbatim matters: favorites and
// recents link to /genes/{symbol} and the page query uses `eq(symbol)`, so
// a casing drift (e.g. 'Trp53' vs 'TRP53') produces a silent empty page.
const FAVORITE_SEED: SavedGene[] = [
  {
    id: 'ENSG00000141510',
    symbol: 'TP53',
    name: 'Tumor Protein P53',
    species: 'human',
    isSeed: true,
  },
  {
    id: 'ENSG00000012048',
    symbol: 'BRCA1',
    name: 'Brca1 Dna Repair Associated',
    species: 'human',
    isSeed: true,
  },
  {
    id: 'ENSMUSG00000059552',
    symbol: 'TRP53',
    name: 'Transformation Related Protein 53',
    species: 'mouse',
    isSeed: true,
  },
]

const RECENT_SEED: SavedGene[] = [
  {
    id: 'ENSG00000146648',
    symbol: 'EGFR',
    name: 'Epidermal Growth Factor Receptor',
    species: 'human',
    isSeed: true,
  },
  {
    id: 'ENSG00000136997',
    symbol: 'MYC',
    name: 'Myc Proto-oncogene, Bhlh Transcription Factor',
    species: 'human',
    isSeed: true,
  },
  {
    id: 'ENSG00000075624',
    symbol: 'ACTB',
    name: 'Actin Beta',
    species: 'human',
    isSeed: true,
  },
  {
    id: 'ENSMUSG00000029580',
    symbol: 'ACTB',
    name: 'Actin, Beta',
    species: 'mouse',
    isSeed: true,
  },
  {
    id: 'ENSMUSG00000022346',
    symbol: 'MYC',
    name: 'Myelocytomatosis Oncogene',
    species: 'mouse',
    isSeed: true,
  },
]

export function seedGeneSearchData(): { favorites: number; recents: number } {
  const favStore = useFavoriteGenes.getState()
  // Add in reverse so the first entry in FAVORITE_SEED ends up at the top.
  for (let i = FAVORITE_SEED.length - 1; i >= 0; i--) {
    favStore.addFavoriteGene(FAVORITE_SEED[i])
  }

  const recentStore = useRecentGenes.getState()
  for (let i = RECENT_SEED.length - 1; i >= 0; i--) {
    recentStore.addRecentGene(RECENT_SEED[i])
  }

  return { favorites: FAVORITE_SEED.length, recents: RECENT_SEED.length }
}

// Removes any favorite/recent entry that was added by seedGeneSearchData()
// (identified by the isSeed flag). Leaves user-added entries untouched even
// if they happen to share an id with a seeded row.
export function clearSeedGeneSearchData(): {
  favorites: number
  recents: number
} {
  let favoritesRemoved = 0
  let recentsRemoved = 0

  useFavoriteGenes.setState((state) => {
    const kept = state.favoriteGenes.filter((g) => !g.isSeed)
    favoritesRemoved = state.favoriteGenes.length - kept.length
    return { favoriteGenes: kept }
  })

  useRecentGenes.setState((state) => {
    const kept = state.recentGenes.filter((g) => !g.isSeed)
    recentsRemoved = state.recentGenes.length - kept.length
    return { recentGenes: kept }
  })

  return { favorites: favoritesRemoved, recents: recentsRemoved }
}
