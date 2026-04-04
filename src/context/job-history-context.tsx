'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import type { JobHistoryEntry } from '@/hooks/use-job-history'

interface JobHistoryContextValue {
  selectedEntry: JobHistoryEntry | null
  selectEntry: (entry: JobHistoryEntry) => void
  clearSelection: () => void
}

const JobHistoryContext = createContext<JobHistoryContextValue | undefined>(
  undefined,
)

export function JobHistoryProvider({ children }: { children: ReactNode }) {
  const [selectedEntry, setSelectedEntry] = useState<JobHistoryEntry | null>(
    null,
  )

  const selectEntry = useCallback((entry: JobHistoryEntry) => {
    setSelectedEntry(entry)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedEntry(null)
  }, [])

  const value = useMemo(
    () => ({ selectedEntry, selectEntry, clearSelection }),
    [selectedEntry, selectEntry, clearSelection],
  )

  return (
    <JobHistoryContext.Provider value={value}>
      {children}
    </JobHistoryContext.Provider>
  )
}

export function useJobHistoryContext() {
  const context = useContext(JobHistoryContext)
  if (!context) {
    throw new Error(
      'useJobHistoryContext must be used within a JobHistoryProvider',
    )
  }
  return context
}
