'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react'

interface RecentGene {
  id: string
  name: string
  symbol: string
}

interface RecentGenesContextValue {
  recentGenes: RecentGene[]
  addRecentGene: (gene: RecentGene) => void
  clearRecentGenes: () => void
}

const RecentGenesContext = createContext<RecentGenesContextValue | undefined>(
  undefined,
)

export function RecentGenesProvider({ children }: { children: ReactNode }) {
  const [recentGenes, setRecentGenes] = useState<RecentGene[]>([])

  // Load recent searches from localStorage on mount
  useEffect(() => {
    const storedRecentGenes = localStorage.getItem('recentGenes')
    if (storedRecentGenes) {
      try {
        setRecentGenes(JSON.parse(storedRecentGenes))
      } catch (error) {
        console.error('Failed to parse recent genes from localStorage:', error)
      }
    }
  }, [])

  // Add a gene to recent searches and store it in localStorage
  const addRecentGene = (gene: RecentGene) => {
    setRecentGenes((prevRecentGenes) => {
      const updatedRecentGenes = [
        gene,
        ...prevRecentGenes.filter((recent) => recent.id !== gene.id),
      ].slice(0, 10) // Limit to 10 recent searches
      localStorage.setItem('recentGenes', JSON.stringify(updatedRecentGenes))
      return updatedRecentGenes
    })
  }

  // Clear all recent searches
  const clearRecentGenes = () => {
    setRecentGenes([])
    localStorage.removeItem('recentGenes')
  }

  return (
    <RecentGenesContext.Provider
      value={{ recentGenes, addRecentGene, clearRecentGenes }}
    >
      {children}
    </RecentGenesContext.Provider>
  )
}

export function useRecentGenes() {
  const context = useContext(RecentGenesContext)
  if (!context) {
    throw new Error('useRecentGenes must be used within a RecentGenesProvider')
  }
  return context
}
