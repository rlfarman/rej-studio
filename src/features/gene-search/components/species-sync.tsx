'use client'

import { useEffect } from 'react'
import { useSpeciesStore } from '@/stores/species-store'
import { isSpecies } from '@/lib/bio/species'

export function SpeciesSync({ species }: { species: string }) {
  const setSpecies = useSpeciesStore((s) => s.setSpecies)
  const current = useSpeciesStore((s) => s.species)

  useEffect(() => {
    if (isSpecies(species) && current !== species) {
      setSpecies(species)
    }
  }, [species, current, setSpecies])

  return null
}
