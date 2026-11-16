'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { SavedGene } from '@/features/gene-search/types/domain-types'

interface FavoriteGenesState {
  favoriteGenes: SavedGene[]
  addFavoriteGene: (gene: SavedGene) => void
  removeFavoriteGene: (geneId: string) => void
  isFavoriteGene: (geneId: string) => boolean
}

export const useFavoriteGenes = create<FavoriteGenesState>()(
  persist(
    (set, get) => ({
      favoriteGenes: [],
      addFavoriteGene: (gene) =>
        set((state) => ({
          favoriteGenes: [
            gene,
            ...state.favoriteGenes.filter((fav) => fav.id !== gene.id),
          ],
        })),
      removeFavoriteGene: (geneId) =>
        set((state) => ({
          favoriteGenes: state.favoriteGenes.filter((fav) => fav.id !== geneId),
        })),
      isFavoriteGene: (geneId) =>
        get().favoriteGenes.some((fav) => fav.id === geneId),
    }),
    {
      name: 'favoriteGenes',
      // window.localStorage, not the bare global: Node 26 defines its own
      // localStorage and warns when it's touched during SSR. On the server
      // `window` is undefined, createJSONStorage catches that, and the store
      // simply doesn't persist there.
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({ favoriteGenes: state.favoriteGenes }),
    },
  ),
)
