'use client'

import { createLocalStorageContext } from '@/lib/create-local-storage-context'

interface RecentGene {
  id: string
  name: string
  symbol: string
}

const {
  Provider: RecentGenesStorageProvider,
  useValue: useRecentGenesStorage,
} = createLocalStorageContext<RecentGene[]>({
  key: 'recentGenes',
  initialValue: [],
  errorMessage: 'useRecentGenes must be used within a RecentGenesProvider',
})

export function RecentGenesProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return <RecentGenesStorageProvider>{children}</RecentGenesStorageProvider>
}

export function useRecentGenes() {
  const { value: recentGenes, setValue: setRecentGenes } =
    useRecentGenesStorage()

  const addRecentGene = (gene: RecentGene) => {
    setRecentGenes((prev) =>
      [gene, ...prev.filter((r) => r.id !== gene.id)].slice(0, 10),
    )
  }

  const clearRecentGenes = () => {
    setRecentGenes([])
  }

  return { recentGenes, addRecentGene, clearRecentGenes }
}
