'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

const VALID_SPECIES = ['human', 'mouse', 'both']

const SpeciesContext = createContext<
  | {
      species: string
      handleSpeciesChange: (value: string) => void
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
  const [species, setSpecies] = useState<string>(() => {
    if (typeof window === 'undefined') return 'both'
    const storedSpecies = localStorage.getItem('species')
    if (storedSpecies && VALID_SPECIES.includes(storedSpecies)) {
      return storedSpecies
    }
    const speciesFromQuery = new URLSearchParams(window.location.search).get(
      'species',
    )
    if (speciesFromQuery && VALID_SPECIES.includes(speciesFromQuery)) {
      return speciesFromQuery
    }
    return 'both'
  })

  const handleSpeciesChange = (value: string) => {
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
