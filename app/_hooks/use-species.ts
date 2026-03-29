'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export function useSpecies() {
  const searchParams = useSearchParams()
  const [species, setSpecies] = useState<string | undefined>(undefined)

  useEffect(() => {
    // Check local storage for the species value
    const storedSpecies = localStorage.getItem('species')

    if (storedSpecies) {
      setSpecies(storedSpecies)
    } else {
      // Fallback to query parameter or default to 'both'
      const speciesFromParams = searchParams.get('species')
      setSpecies(speciesFromParams ?? 'both')
    }
  }, [searchParams])

  return species
}
