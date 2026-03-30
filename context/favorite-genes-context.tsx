'use client'

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  ReactNode,
} from 'react'
import { useLocalStorage } from '@/lib/use-local-storage'
import type { SavedGene } from '@/lib/domain-types'

interface FavoriteGenesContextValue {
  favoriteGenes: SavedGene[]
  addFavoriteGene: (gene: SavedGene) => void
  removeFavoriteGene: (geneId: string) => void
  isFavoriteGene: (geneId: string) => boolean
}

const FavoriteGenesContext = createContext<
  FavoriteGenesContextValue | undefined
>(undefined)

const EMPTY: SavedGene[] = []

export function FavoriteGenesProvider({ children }: { children: ReactNode }) {
  const [favoriteGenes, setFavoriteGenes] = useLocalStorage<SavedGene[]>(
    'favoriteGenes',
    EMPTY,
  )

  const addFavoriteGene = useCallback(
    (gene: SavedGene) => {
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

  const value = useMemo(
    () => ({
      favoriteGenes,
      addFavoriteGene,
      removeFavoriteGene,
      isFavoriteGene,
    }),
    [favoriteGenes, addFavoriteGene, removeFavoriteGene, isFavoriteGene],
  )

  return (
    <FavoriteGenesContext.Provider value={value}>
      {children}
    </FavoriteGenesContext.Provider>
  )
}

export function useFavoriteGenes() {
  const context = useContext(FavoriteGenesContext)
  if (!context) {
    throw new Error(
      'useFavoriteGenes must be used within a FavoriteGenesProvider',
    )
  }
  return context
}
