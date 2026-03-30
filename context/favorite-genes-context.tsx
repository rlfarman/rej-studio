'use client'

import { createContext, useContext, useCallback, ReactNode } from 'react'
import { useLocalStorage } from '@/lib/use-local-storage'

interface FavoriteGene {
  id: string
  name: string
  symbol: string
}

interface FavoriteGenesContextValue {
  favoriteGenes: FavoriteGene[]
  addFavoriteGene: (gene: FavoriteGene) => void
  removeFavoriteGene: (geneId: string) => void
  isFavoriteGene: (geneId: string) => boolean
}

const FavoriteGenesContext = createContext<
  FavoriteGenesContextValue | undefined
>(undefined)

const EMPTY: FavoriteGene[] = []

export function FavoriteGenesProvider({
  children,
}: {
  children: ReactNode
}) {
  const [favoriteGenes, setFavoriteGenes] = useLocalStorage<FavoriteGene[]>(
    'favoriteGenes',
    EMPTY,
  )

  const addFavoriteGene = useCallback(
    (gene: FavoriteGene) => {
      setFavoriteGenes((prev) => [
        gene,
        ...prev.filter((fav) => fav.id !== gene.id),
      ])
    },
    [setFavoriteGenes],
  )

  const removeFavoriteGene = useCallback(
    (geneId: string) => {
      setFavoriteGenes((prev) => prev.filter((fav) => fav.id !== geneId))
    },
    [setFavoriteGenes],
  )

  const isFavoriteGene = useCallback(
    (geneId: string) => {
      return favoriteGenes.some((fav) => fav.id === geneId)
    },
    [favoriteGenes],
  )

  return (
    <FavoriteGenesContext.Provider
      value={{ favoriteGenes, addFavoriteGene, removeFavoriteGene, isFavoriteGene }}
    >
      {children}
    </FavoriteGenesContext.Provider>
  )
}

export function useFavoriteGenes() {
  const context = useContext(FavoriteGenesContext)
  if (!context) {
    throw new Error('useFavoriteGenes must be used within a FavoriteGenesProvider')
  }
  return context
}
