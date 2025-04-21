'use client'
import React, { useEffect, useState, createContext, useContext } from 'react'

// Create a context for species
const SpeciesContext = createContext<
  | {
      species: string | undefined
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

export function SpeciesProvider({ children }: { children: React.ReactNode }) {
  const [species, setSpecies] = useState<string | undefined>(undefined)

  useEffect(() => {
    const storedSpecies = localStorage.getItem('species')
    if (storedSpecies) {
      setSpecies(storedSpecies)
    } else {
      const speciesFromQuery = new URLSearchParams(window.location.search).get(
        'species'
      )
      setSpecies(speciesFromQuery ?? 'both')
    }
  }, [])

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
