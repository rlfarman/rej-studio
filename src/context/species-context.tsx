'use client'

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useSyncExternalStore,
  ReactNode,
} from 'react'
import { type SpeciesFilter, isSpeciesFilter } from '@/lib/species'

const SPECIES_STORAGE_KEY = 'species'
const SPECIES_CHANGE_EVENT = 'specieschange'

function getSpeciesFromBrowser(): SpeciesFilter {
  if (typeof window === 'undefined') {
    return 'both'
  }

  const storedSpecies = window.localStorage.getItem(SPECIES_STORAGE_KEY)
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
}

function subscribeToSpeciesStore(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange)
  window.addEventListener('popstate', onStoreChange)
  window.addEventListener(SPECIES_CHANGE_EVENT, onStoreChange)

  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener('popstate', onStoreChange)
    window.removeEventListener(SPECIES_CHANGE_EVENT, onStoreChange)
  }
}

function getSpeciesServerSnapshot(): SpeciesFilter {
  return 'both'
}

function notifySpeciesStore() {
  window.dispatchEvent(new Event(SPECIES_CHANGE_EVENT))
}

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
  const species = useSyncExternalStore(
    subscribeToSpeciesStore,
    getSpeciesFromBrowser,
    getSpeciesServerSnapshot,
  )

  const handleSpeciesChange = useCallback((value: SpeciesFilter) => {
    window.localStorage.setItem(SPECIES_STORAGE_KEY, value)
    const url = new URL(window.location.href)
    url.searchParams.set('species', value)
    window.history.pushState({}, '', url.toString())
    notifySpeciesStore()
  }, [])

  const value = useMemo(
    () => ({ species, handleSpeciesChange }),
    [species, handleSpeciesChange],
  )

  return (
    <SpeciesContext.Provider value={value}>{children}</SpeciesContext.Provider>
  )
}
