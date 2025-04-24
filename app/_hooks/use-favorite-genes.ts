import { useEffect, useState } from 'react'

interface FavoriteGene {
  id: string
  name: string
  symbol: string
}

export function useFavoriteGenes() {
  const [favoriteGenes, setFavoriteGenes] = useState<FavoriteGene[]>([])

  // Load favorites from localStorage on mount
  useEffect(() => {
    const storedFavoriteGenes = localStorage.getItem('favoriteGenes')
    setFavoriteGenes(JSON.parse(storedFavoriteGenes || '[]'))
  }, [])

  // Add a gene to favorites and store it in localStorage
  function addFavoriteGene(gene: FavoriteGene) {
    console.log('Adding gene to favorites:', gene)
    const updatedFavoriteGenes = [
      gene,
      ...favoriteGenes.filter((fav) => fav.id !== gene.id),
    ]
    console.log('Updated favorite genes:', updatedFavoriteGenes)
    setFavoriteGenes(updatedFavoriteGenes)
    localStorage.setItem('favoriteGenes', JSON.stringify(updatedFavoriteGenes))
  }

  // Remove a gene from favorites
  function removeFavoriteGene(geneId: string) {
    const updatedFavorites = favoriteGenes.filter((fav) => fav.id !== geneId)
    setFavoriteGenes(updatedFavorites)
    localStorage.setItem('favoriteGenes', JSON.stringify(updatedFavorites))
  }

  // Get all favorites
  function getFavoriteGenes() {
    return favoriteGenes
  }

  function isFavoriteGene(geneId: string) {
    return favoriteGenes.some((fav) => fav.id === geneId)
  }

  console.log('Favorite genes:', favoriteGenes)

  return {
    addFavoriteGene,
    removeFavoriteGene,
    getFavoriteGenes,
    favoriteGenes,
    isFavoriteGene,
  }
}
