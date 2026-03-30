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

interface RecentGenesContextValue {
  recentGenes: SavedGene[]
  addRecentGene: (gene: SavedGene) => void
  removeRecentGene: (geneId: string) => void
  clearRecentGenes: () => void
}

const RecentGenesContext = createContext<RecentGenesContextValue | undefined>(
  undefined,
)

const EMPTY: SavedGene[] = []

export function RecentGenesProvider({ children }: { children: ReactNode }) {
  const [recentGenes, setRecentGenes] = useLocalStorage<SavedGene[]>(
    'recentGenes',
    EMPTY,
  )

  const addRecentGene = useCallback(
    (gene: SavedGene) => {
      setRecentGenes((prev) =>
        [gene, ...prev.filter((r) => r.id !== gene.id)].slice(0, 10),
      )
    },
    [setRecentGenes],
  )

  const removeRecentGene = useCallback(
    (geneId: string) => {
      setRecentGenes((prev) => prev.filter((gene) => gene.id !== geneId))
    },
    [setRecentGenes],
  )

  const clearRecentGenes = useCallback(() => {
    setRecentGenes([])
  }, [setRecentGenes])

  const value = useMemo(
    () => ({ recentGenes, addRecentGene, removeRecentGene, clearRecentGenes }),
    [recentGenes, addRecentGene, removeRecentGene, clearRecentGenes],
  )

  return (
    <RecentGenesContext.Provider value={value}>
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
