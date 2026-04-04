'use client'

import { useCallback } from 'react'
import { useLocalStorage } from '@/hooks/use-local-storage'
import type { ProcessResult } from '@/features/design-tool/types/process-result'
import type { FormValues } from '@/features/design-tool/types/form-schema'

const STORAGE_KEY = 'rej-studio:job-history'
const MAX_ENTRIES = 50

export interface JobHistoryEntry {
  id: string
  name: string
  sequenceLength: number
  createdAt: string
  result: ProcessResult
  // Form values that produced this result. Optional for backwards-compat with
  // entries saved before this field existed.
  formValues?: FormValues
}

const EMPTY: JobHistoryEntry[] = []

export function useJobHistory() {
  const [entries, setEntries] = useLocalStorage<JobHistoryEntry[]>(
    STORAGE_KEY,
    EMPTY,
  )

  const addEntry = useCallback(
    (result: ProcessResult, id: string, formValues?: FormValues) => {
      const entry: JobHistoryEntry = {
        id,
        name: result.name,
        sequenceLength: result.original_sequence.length,
        createdAt: new Date().toISOString(),
        result,
        formValues,
      }
      setEntries((prev) =>
        [entry, ...prev.filter((e) => e.id !== id)].slice(0, MAX_ENTRIES),
      )
      return id
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
