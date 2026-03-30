'use client'

import { createContext, useContext, useCallback, useMemo, ReactNode } from 'react'
import { useLocalStorage } from '@/lib/use-local-storage'

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

const EMPTY: RecentGene[] = []

export function RecentGenesProvider({
  children,
}: {
  children: ReactNode
}) {
  const [recentGenes, setRecentGenes] = useLocalStorage<RecentGene[]>(
    'recentGenes',
    EMPTY,
  )

  const addRecentGene = useCallback(
    (gene: RecentGene) => {
      setRecentGenes((prev) =>
        [gene, ...prev.filter((r) => r.id !== gene.id)].slice(0, 10),
      )
    },
    [setRecentGenes],
  )

  const clearRecentGenes = useCallback(() => {
    setRecentGenes([])
  }, [setRecentGenes])

  const value = useMemo(
    () => ({ recentGenes, addRecentGene, clearRecentGenes }),
    [recentGenes, addRecentGene, clearRecentGenes],
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
