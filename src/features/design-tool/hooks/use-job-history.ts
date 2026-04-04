'use client'

import { useCallback } from 'react'
import { useLocalStorage } from '@/hooks/use-local-storage'
import type { ProcessResult } from '@/features/design-tool/types/process-result'

const STORAGE_KEY = 'rej-studio:job-history'
const MAX_ENTRIES = 50

export interface JobHistoryEntry {
  id: string
  name: string
  sequenceLength: number
  createdAt: string
  result: ProcessResult
}

const EMPTY: JobHistoryEntry[] = []

export function useJobHistory() {
  const [entries, setEntries] = useLocalStorage<JobHistoryEntry[]>(
    STORAGE_KEY,
    EMPTY,
  )

  const addEntry = useCallback(
    (result: ProcessResult) => {
      const entry: JobHistoryEntry = {
        id: crypto.randomUUID(),
        name: result.name,
        sequenceLength: result.original_sequence.length,
        createdAt: new Date().toISOString(),
        result,
      }
      setEntries((prev) => [entry, ...prev].slice(0, MAX_ENTRIES))
      return entry.id
    },
    [setEntries],
  )

  const removeEntry = useCallback(
    (id: string) => {
      setEntries((prev) => prev.filter((e) => e.id !== id))
    },
    [setEntries],
  )

  const clearHistory = useCallback(() => {
    setEntries(EMPTY)
  }, [setEntries])

  const getEntry = useCallback(
    (id: string) => entries.find((e) => e.id === id) ?? null,
    [entries],
  )

  return { entries, addEntry, removeEntry, clearHistory, getEntry }
}
