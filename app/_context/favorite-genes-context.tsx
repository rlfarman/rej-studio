'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react'

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

export function FavoriteGenesProvider({ children }: { children: ReactNode }) {
  const [favoriteGenes, setFavoriteGenes] = useState<FavoriteGene[]>([])

  // Load favorites from localStorage on mount
  useEffect(() => {
    const storedFavoriteGenes = localStorage.getItem('favoriteGenes')
    if (storedFavoriteGenes) {
      try {
        setFavoriteGenes(JSON.parse(storedFavoriteGenes))
      } catch (error) {
        console.error(
          'Failed to parse favorite genes from localStorage:',
          error
        )
      }
    }
  }, [])

  // Add a gene to favorites and store it in localStorage
  const addFavoriteGene = (gene: FavoriteGene) => {
    setFavoriteGenes((prevFavorites) => {
      const updatedFavorites = [
        gene,
        ...prevFavorites.filter((fav) => fav.id !== gene.id),
      ]
      localStorage.setItem('favoriteGenes', JSON.stringify(updatedFavorites))
      return updatedFavorites
    })
  }

  // Remove a gene from favorites
  const removeFavoriteGene = (geneId: string) => {
    setFavoriteGenes((prevFavorites) => {
      const updatedFavorites = prevFavorites.filter((fav) => fav.id !== geneId)
      localStorage.setItem('favoriteGenes', JSON.stringify(updatedFavorites))
      return updatedFavorites
    })
  }

  // Check if a gene is a favorite
  const isFavoriteGene = (geneId: string) => {
    return favoriteGenes.some((fav) => fav.id === geneId)
  }

  return (
    <FavoriteGenesContext.Provider
      value={{
        favoriteGenes,
        addFavoriteGene,
        removeFavoriteGene,
        isFavoriteGene,
      }}
    >
      {children}
    </FavoriteGenesContext.Provider>
  )
}

export function useFavoriteGenes() {
  const context = useContext(FavoriteGenesContext)
  if (!context) {
    throw new Error(
      'useFavoriteGenes must be used within a FavoriteGenesProvider'
    )
  }
  return context
}
