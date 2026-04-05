'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ProcessResult } from '@/features/design-tool/types/process-result'
import type { FormValues } from '@/features/design-tool/types/form-schema'

const STORAGE_KEY = 'rej-studio:job-history'
const MAX_ENTRIES = 50

// Prefix for all seed-demo entries. Used by JobWatcher to skip polling the
// backend for seeded running jobs (they have no backend counterpart), by
// data-transfer to exclude seeded rows from user exports, and by the
// "Clear seed data" action to identify which entries to drop.
export const SEED_ID_PREFIX = 'seed-'

export function isSeedId(id: string): boolean {
  return id.startsWith(SEED_ID_PREFIX)
}
// How long to keep an entry stuck in the running state before we assume the
// poll was abandoned (tab closed, Modal call_id expired) and drop it.
const STALE_RUNNING_TTL_MS = 24 * 60 * 60 * 1000

export type JobStatus = 'running' | 'completed' | 'failed' | 'cancelled'

// Structured failure shape. `code` lets the UI branch (retry vs user-action)
// without string sniffing; `retriable` is the backend's hint about whether
// the same inputs would likely succeed on another attempt.
export type JobErrorCode =
  | 'timeout'
  | 'not_found'
  | 'cancelled'
  | 'backend'
  | 'network'
  | 'unknown'

export interface JobError {
  code: JobErrorCode
  message: string
  retriable: boolean
}

export interface JobHistoryEntry {
  id: string
  name: string
  sequenceLength: number
  createdAt: string
  status: JobStatus
  // Populated when status === 'completed'.
  result: ProcessResult | null
  // Populated when status === 'failed' or 'cancelled'.
  error: JobError | null
  // Form values that produced this job. Optional for backwards-compat.
  formValues?: FormValues
  // Backend progress signal, 0..1. Optional — backends may not emit it.
  progress?: number
  // Human-readable stage label (e.g. "optimizing", "packaging").
  stage?: string
  // True when this entry was added by the seed-data demo action. Scopes the
  // "Clear seed data" action and excludes the entry from exports. Not set
  // on real jobs.
  isSeed?: boolean
}

// Partial input for upserting an entry — status is required, everything else
// is optional (and either derived from `result`/`formValues` or preserved
// from an existing entry with the same id).
interface UpsertInput {
  id: string
  status: JobStatus
  result?: ProcessResult | null
  error?: JobError | null
  formValues?: FormValues
  progress?: number
  stage?: string
}

interface JobHistoryState {
  entries: JobHistoryEntry[]
  upsertEntry: (input: UpsertInput) => string
  removeEntry: (id: string) => void
  clearHistory: () => void
  getEntry: (id: string) => JobHistoryEntry | null
}

export const useJobHistory = create<JobHistoryState>()(
  persist(
    (set, get) => ({
      entries: [],

      // Upsert: if an entry with this id already exists, preserve its
      // createdAt (so a running entry doesn't jump in the list when it
      // completes) and overlay any fields we've learned. Otherwise insert
      // at the top.
      upsertEntry: ({
        id,
        status,
        result,
        error,
        formValues,
        progress,
        stage,
      }) => {
        set((state) => {
          const existing = state.entries.find((e) => e.id === id)
          const nextResult = result ?? existing?.result ?? null
          const nextFormValues = formValues ?? existing?.formValues
          const name =
            nextResult?.name ??
            nextFormValues?.name ??
            existing?.name ??
            'Untitled'
          const sequenceLength =
            nextResult?.original_sequence.length ??
            nextFormValues?.codingSequence.length ??
            existing?.sequenceLength ??
            0
          // Terminal states clear progress; running states preserve it.
          const isTerminal = status !== 'running'
          const entry: JobHistoryEntry = {
            id,
            name,
            sequenceLength,
            createdAt: existing?.createdAt ?? new Date().toISOString(),
            status,
            result: nextResult,
            error: error ?? existing?.error ?? null,
            formValues: nextFormValues,
            progress: isTerminal ? undefined : (progress ?? existing?.progress),
            stage: isTerminal ? undefined : (stage ?? existing?.stage),
          }
          return {
            entries: [entry, ...state.entries.filter((e) => e.id !== id)].slice(
              0,
              MAX_ENTRIES,
            ),
          }
        })
        return id
      },

      removeEntry: (id) =>
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        })),

      clearHistory: () => set({ entries: [] }),

      getEntry: (id) => get().entries.find((e) => e.id === id) ?? null,
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ entries: state.entries }),
      // Sweep stale running entries on rehydrate. Orphans come from tabs
      // closed mid-poll; after the TTL we assume they'll never resolve.
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const cutoff = Date.now() - STALE_RUNNING_TTL_MS
        const fresh = state.entries.filter((e) => {
          if (e.status !== 'running') return true
          return new Date(e.createdAt).getTime() >= cutoff
        })
        if (fresh.length !== state.entries.length) {
          state.entries = fresh
        }
      },
    },
  ),
)

// Cross-tab sync: when another tab writes to our localStorage key, rehydrate
// so every open tab converges on the same history. Without this, a job
// submitted in Tab A is invisible to Tab B, and two tabs can race to poll
// and clobber each other's writes.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY || event.newValue === null) return
    void useJobHistory.persist.rehydrate()
  })
}
