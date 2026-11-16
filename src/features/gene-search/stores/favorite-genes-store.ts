'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { SavedGene } from '@/features/gene-search/types/domain-types'

interface FavoriteGenesState {
  favoriteGenes: SavedGene[]
  addFavoriteGene: (gene: SavedGene) => void
  removeFavoriteGene: (geneId: string) => void
}

// No `isFavoriteGene(id)` getter: called during render, the React Compiler
// memoizes it on the function's identity and never sees a change. Components
// select `favoriteGenes.some(...)` instead.
export const useFavoriteGenes = create<FavoriteGenesState>()(
  persist(
    (set) => ({
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
