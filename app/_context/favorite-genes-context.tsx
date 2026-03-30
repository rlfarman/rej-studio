'use client'

import { createLocalStorageContext } from '@/lib/create-local-storage-context'

interface FavoriteGene {
  id: string
  name: string
  symbol: string
}

const {
  Provider: FavoriteGenesStorageProvider,
  useValue: useFavoriteGenesStorage,
} = createLocalStorageContext<FavoriteGene[]>({
  key: 'favoriteGenes',
  initialValue: [],
  errorMessage: 'useFavoriteGenes must be used within a FavoriteGenesProvider',
})

export function FavoriteGenesProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <FavoriteGenesStorageProvider>{children}</FavoriteGenesStorageProvider>
  )
}

export function useFavoriteGenes() {
  const { value: favoriteGenes, setValue: setFavoriteGenes } =
    useFavoriteGenesStorage()

  const addFavoriteGene = (gene: FavoriteGene) => {
    setFavoriteGenes((prev) => [
      gene,
      ...prev.filter((fav) => fav.id !== gene.id),
    ])
  }

  const removeFavoriteGene = (geneId: string) => {
    setFavoriteGenes((prev) => prev.filter((fav) => fav.id !== geneId))
  }

  const isFavoriteGene = (geneId: string) => {
    return favoriteGenes.some((fav) => fav.id === geneId)
  }

  return { favoriteGenes, addFavoriteGene, removeFavoriteGene, isFavoriteGene }
}
