'use client'

import { useCallback, useEffect } from 'react'
import { useLocalStorage } from '@/hooks/use-local-storage'
import type { ProcessResult } from '@/features/design-tool/types/process-result'
import type { FormValues } from '@/features/design-tool/types/form-schema'

const STORAGE_KEY = 'rej-studio:job-history'
const MAX_ENTRIES = 50
// How long to keep an entry stuck in the running state before we assume the
// poll was abandoned (tab closed, Modal call_id expired) and drop it.
const STALE_RUNNING_TTL_MS = 24 * 60 * 60 * 1000

export interface JobHistoryEntry {
  id: string
  name: string
  sequenceLength: number
  createdAt: string
  // Null while the job is still running. Populated on completion.
  result: ProcessResult | null
  // Form values that produced this job. Optional for backwards-compat.
  formValues?: FormValues
}

const EMPTY: JobHistoryEntry[] = []

export function useJobHistory() {
  const [entries, setEntries] = useLocalStorage<JobHistoryEntry[]>(
    STORAGE_KEY,
    EMPTY,
  )

  // Sweep stale running entries on mount. Orphans come from tabs closed
  // mid-poll; after the TTL we assume they'll never resolve.
  useEffect(() => {
    const cutoff = Date.now() - STALE_RUNNING_TTL_MS
    setEntries((prev) => {
      const fresh = prev.filter((e) => {
        if (e.result !== null) return true
        return new Date(e.createdAt).getTime() >= cutoff
      })
      return fresh.length === prev.length ? prev : fresh
    })
  }, [setEntries])

  // Upsert: if an entry with this id already exists, preserve its createdAt
  // (so a running entry doesn't jump in the list when it completes) and
  // overlay the new fields. Otherwise insert at the top.
  const addEntry = useCallback(
    (result: ProcessResult | null, id: string, formValues?: FormValues) => {
      const name = result?.name ?? formValues?.name ?? 'Untitled'
      const sequenceLength =
        result?.original_sequence.length ??
        formValues?.codingSequence.length ??
        0
      setEntries((prev) => {
        const existing = prev.find((e) => e.id === id)
        const entry: JobHistoryEntry = {
          id,
          name,
          sequenceLength,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          result,
          formValues: formValues ?? existing?.formValues,
        }
        return [entry, ...prev.filter((e) => e.id !== id)].slice(0, MAX_ENTRIES)
      })
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
