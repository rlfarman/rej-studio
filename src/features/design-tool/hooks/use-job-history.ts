'use client'

import { create } from 'zustand'
import { persist, type PersistStorage } from 'zustand/middleware'
import type { ProcessResult } from '@/features/design-tool/types/process-result'
import type { JobErrorCode } from '@/features/design-tool/types/backend-contract'
import type { FormValues } from '@/features/design-tool/types/form-schema'
import { createLogger } from '@/lib/logger'

const log = createLogger('job-history')

const STORAGE_KEY = 'rej-studio:job-history'
const MAX_ENTRIES = 50

// Prefix for all seed-demo entries. Used by JobWatcher to skip polling the
// backend for seeded running jobs (they have no backend counterpart), by
// the user-data export to exclude seeded rows from backups, and by the
// "Clear seed data" action to identify which entries to drop.
const SEED_ID_PREFIX = 'seed-'

export function isSeedId(id: string): boolean {
  return id.startsWith(SEED_ID_PREFIX)
}

// Prefix for designs computed in this browser. They have no backend job, so
// JobWatcher must not poll them and they are never written to the URL — the
// result exists only on this device.
export const BROWSER_ID_PREFIX = 'browser-'

export function isBrowserJobId(id: string): boolean {
  return id.startsWith(BROWSER_ID_PREFIX)
}
// How long to keep an entry stuck in the running state before we assume the
// poll was abandoned (tab closed, Modal call_id expired) and drop it.
const STALE_RUNNING_TTL_MS = 24 * 60 * 60 * 1000

export type JobStatus = 'running' | 'completed' | 'failed' | 'cancelled'

// Structured failure shape, mirroring the backend contract. `code` lets the
// UI branch (retry vs user-action) without string sniffing; `retriable` is
// the backend's hint about whether the same inputs would likely succeed on
// another attempt.
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
  // True when this entry was added by the seed-data demo action. Scopes the
  // "Clear seed data" action and excludes the entry from exports. Not set
  // on real jobs.
  isSeed?: boolean
}

/**
 * Live progress for an in-flight job. Kept OUT of the persisted slice: a
 * backend progress tick every ~500ms used to rewrite all 50 entries —
 * including full results and form values — to localStorage.
 */
interface JobProgress {
  progress?: number
  stage?: string
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
}

interface JobHistoryState {
  entries: JobHistoryEntry[]
  /** Transient, per-job progress. Never persisted. */
  progressById: Record<string, JobProgress>
  upsertEntry: (input: UpsertInput) => string
  setProgress: (id: string, progress: JobProgress) => void
  removeEntry: (id: string) => void
  clearHistory: () => void
  getEntry: (id: string) => JobHistoryEntry | null
  getProgress: (id: string) => JobProgress | undefined
  getRunningIds: () => string[]
}

type PersistedState = Pick<JobHistoryState, 'entries'>

/**
 * localStorage, with the two failure modes the plain JSON storage ignores:
 *
 *  - reads/writes throw in private windows or with site data blocked, so
 *    every call is guarded;
 *  - a history of 50 full results can exceed the ~5MB quota, so a
 *    QuotaExceededError retries with a slimmed payload (oldest results
 *    dropped first, then oldest entries) instead of losing the write.
 */
function createJobHistoryStorage(): PersistStorage<PersistedState> | undefined {
  // No window on the server (and Node 26 warns if its own localStorage is
  // touched during SSR), so persistence is simply off there.
  try {
    if (typeof window === 'undefined' || !window.localStorage) return undefined
  } catch {
    return undefined
  }
  return {
    getItem: (name) => {
      try {
        const raw = window.localStorage.getItem(name)
        return raw ? JSON.parse(raw) : null
      } catch {
        return null
      }
    },
    setItem: (name, value) => {
      const entries = value.state.entries
      // Successively smaller payloads: full, results dropped from the
      // oldest half, results dropped entirely, then only the newest 10.
      const attempts: PersistedState[] = [
        { entries },
        { entries: dropResults(entries, Math.ceil(entries.length / 2)) },
        { entries: dropResults(entries, 0) },
        { entries: dropResults(entries, 0).slice(0, 10) },
      ]
      for (const attempt of attempts) {
        try {
          window.localStorage.setItem(
            name,
            JSON.stringify({ ...value, state: attempt }),
          )
          return
        } catch (err) {
          if (!isQuotaError(err)) return // blocked storage — nothing to retry
        }
      }
      log.warn('could not persist job history — storage quota exceeded')
    },
    removeItem: (name) => {
      try {
        window.localStorage.removeItem(name)
      } catch {
        // Storage unavailable — nothing to clean up.
      }
    },
  }
}

function isQuotaError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}

/** Strips `result` from every entry at or after `keepResultsBefore`. */
function dropResults(
  entries: JobHistoryEntry[],
  keepResultsBefore: number,
): JobHistoryEntry[] {
  return entries.map((entry, i) =>
    i < keepResultsBefore ? entry : { ...entry, result: null },
  )
}

export const useJobHistory = create<JobHistoryState>()(
  persist(
    (set, get) => ({
      entries: [],
      progressById: {},

      // Upsert: if an entry with this id already exists, preserve its
      // createdAt (so a running entry doesn't jump in the list when it
      // completes) and overlay any fields we've learned. Otherwise insert
      // at the top.
      upsertEntry: ({ id, status, result, error, formValues }) => {
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
          const entry: JobHistoryEntry = {
            id,
            name,
            sequenceLength,
            createdAt: existing?.createdAt ?? new Date().toISOString(),
            status,
            result: nextResult,
            error: error ?? existing?.error ?? null,
            formValues: nextFormValues,
            ...(existing?.isSeed ? { isSeed: true } : {}),
          }
          // Terminal states have no progress left to show.
          const progressById =
            status === 'running'
              ? state.progressById
              : omit(state.progressById, id)
          return {
            progressById,
            entries: [entry, ...state.entries.filter((e) => e.id !== id)].slice(
              0,
              MAX_ENTRIES,
            ),
          }
        })
        return id
      },

      setProgress: (id, progress) =>
        set((state) => ({
          progressById: { ...state.progressById, [id]: progress },
        })),

      removeEntry: (id) =>
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
          progressById: omit(state.progressById, id),
        })),

      clearHistory: () => set({ entries: [], progressById: {} }),

      getEntry: (id) => get().entries.find((e) => e.id === id) ?? null,

      getProgress: (id) => get().progressById[id],

      getRunningIds: () =>
        get()
          .entries.filter((e) => e.status === 'running')
          .map((e) => e.id),
    }),
    {
      name: STORAGE_KEY,
      storage: createJobHistoryStorage(),
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

function omit<T>(record: Record<string, T>, key: string): Record<string, T> {
  if (!(key in record)) return record
  const next = { ...record }
  delete next[key]
  return next
}

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
