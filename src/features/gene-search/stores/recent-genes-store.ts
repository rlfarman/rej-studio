'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { SavedGene } from '@/features/gene-search/types/domain-types'

const MAX_RECENT = 10

interface RecentGenesState {
  recentGenes: SavedGene[]
  addRecentGene: (gene: SavedGene) => void
  removeRecentGene: (id: string) => void
  clearRecentGenes: () => void
}

export const useRecentGenes = create<RecentGenesState>()(
  persist(
    (set) => ({
      recentGenes: [],
      addRecentGene: (gene) =>
        set((state) => ({
          recentGenes: [
            gene,
            ...state.recentGenes.filter((r) => r.id !== gene.id),
          ].slice(0, MAX_RECENT),
        })),
      removeRecentGene: (id) =>
        set((state) => ({
          recentGenes: state.recentGenes.filter((r) => r.id !== id),
        })),
      clearRecentGenes: () => set({ recentGenes: [] }),
    }),
    {
      name: 'recentGenes',
      // window.localStorage, not the bare global: Node 26 defines its own
      // localStorage and warns when it's touched during SSR. On the server
      // `window` is undefined, createJSONStorage catches that, and the store
      // simply doesn't persist there.
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({ recentGenes: state.recentGenes }),
    },
  ),
)
