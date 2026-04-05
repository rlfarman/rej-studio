'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { type SpeciesFilter, isSpeciesFilter } from '@/lib/bio/species'

interface SpeciesState {
  species: SpeciesFilter
  handleSpeciesChange: (value: SpeciesFilter) => void
}

// Read initial value from URL query string if present (overrides persisted value).
function readSpeciesFromQuery(): SpeciesFilter | null {
  if (typeof window === 'undefined') return null
  const fromQuery = new URLSearchParams(window.location.search).get('species')
  return fromQuery && isSpeciesFilter(fromQuery) ? fromQuery : null
}

export const useSpeciesStore = create<SpeciesState>()(
  persist(
    (set) => ({
      species: 'both',
      handleSpeciesChange: (value) => {
        set({ species: value })
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href)
          url.searchParams.set('species', value)
          window.history.pushState({}, '', url.toString())
        }
      },
    }),
    {
      name: 'species',
      storage: createJSONStorage(() => localStorage),
      // After rehydration, let URL query param override persisted state.
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const fromQuery = readSpeciesFromQuery()
        if (fromQuery) state.species = fromQuery
      },
    },
  ),
)

// Back-compat hook name for existing consumers.
export function useSpeciesContext() {
  const species = useSpeciesStore((s) => s.species)
  const handleSpeciesChange = useSpeciesStore((s) => s.handleSpeciesChange)
  return { species, handleSpeciesChange }
}
