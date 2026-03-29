import { useEffect, useState } from 'react'

interface RecentGene {
  id: string
  name: string
  symbol: string
}

export function useRecentSearchedGenes() {
  const [recentGenes, setRecentGenes] = useState<RecentGene[]>([])

  // Load recent searches from localStorage on mount
  useEffect(() => {
    const storedRecentGenes = localStorage.getItem('recentGenes')
    if (storedRecentGenes) {
      try {
        setRecentGenes(JSON.parse(storedRecentGenes))
      } catch (error) {
        console.error('Failed to parse recent genes from localStorage:', error)
        setRecentGenes([])
      }
    }
  }, [])

  // Add a gene to recent searches and store it in localStorage
  function addRecentGene(gene: RecentGene) {
    const updatedRecentGenes = [
      gene,
      ...recentGenes.filter((recent) => recent.id !== gene.id),
    ].slice(0, 10) // Limit to 10 recent searches
    setRecentGenes(updatedRecentGenes)
    try {
      localStorage.setItem('recentGenes', JSON.stringify(updatedRecentGenes))
    } catch (error) {
      console.error('Failed to save recent genes to localStorage:', error)
    }
  }

  // Clear all recent searches
  function clearRecentGenes() {
    setRecentGenes([])
    try {
      localStorage.removeItem('recentGenes')
    } catch (error) {
      console.error('Failed to clear recent genes from localStorage:', error)
    }
  }

  return {
    recentGenes,
    addRecentGene,
    clearRecentGenes,
  }
}
