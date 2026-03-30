'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { type SpeciesFilter, isSpeciesFilter } from '@/lib/species'

const SpeciesContext = createContext<
  | {
      species: SpeciesFilter
      handleSpeciesChange: (value: SpeciesFilter) => void
    }
  | undefined
>(undefined)

export function useSpeciesContext() {
  const context = useContext(SpeciesContext)
  if (context === undefined) {
    throw new Error('useSpeciesContext must be used within a SpeciesProvider')
  }
  return context
}

export function SpeciesProvider({ children }: { children: ReactNode }) {
  const [species, setSpecies] = useState<SpeciesFilter>(() => {
    if (typeof window === 'undefined') return 'both'
    const storedSpecies = localStorage.getItem('species')
    if (storedSpecies && isSpeciesFilter(storedSpecies)) {
      return storedSpecies
    }
    const speciesFromQuery = new URLSearchParams(window.location.search).get(
      'species',
    )
    if (speciesFromQuery && isSpeciesFilter(speciesFromQuery)) {
      return speciesFromQuery
    }
    return 'both'
  })

  const handleSpeciesChange = (value: SpeciesFilter) => {
    setSpecies(value)
    localStorage.setItem('species', value)
    const url = new URL(window.location.href)
    url.searchParams.set('species', value)
    window.history.pushState({}, '', url.toString())
  }

  return (
    <SpeciesContext.Provider value={{ species, handleSpeciesChange }}>
      {children}
    </SpeciesContext.Provider>
  )
}
