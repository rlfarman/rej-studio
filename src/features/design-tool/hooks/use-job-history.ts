'use client'

import { useSyncExternalStore } from 'react'
import { create } from 'zustand'
import { persist, type PersistStorage } from 'zustand/middleware'
import type { ProcessResult } from '@/features/design-tool/types/process-result'
import type { JobError } from '@/features/design-tool/types/job-result'
import type { FormValues } from '@/features/design-tool/types/form-schema'
import {
  createJobHistoryStorage,
  type PersistedJobHistory,
} from '@/features/design-tool/utils/job-history-storage'
import { createLogger } from '@/lib/logger'

const log = createLogger('job-history')

// The persist key: the IndexedDB key, the old localStorage key the history
// migrates from, the cross-tab channel name, and a section of user-data
// backups.
const STORAGE_KEY = 'rej-studio:job-history'
const PERSIST_VERSION = 0
const MAX_ENTRIES = 50

// Prefix for all seed-demo entries. Used by the user-data export to exclude
// seeded rows from backups, and by the "Clear seed data" action to identify
// which entries to drop.
const SEED_ID_PREFIX = 'seed-'

export function isSeedId(id: string): boolean {
  return id.startsWith(SEED_ID_PREFIX)
}

// Prefix for designs computed in this browser. They are never written to the
// URL: the result exists only on this device.
export const BROWSER_ID_PREFIX = 'browser-'

export function isBrowserJobId(id: string): boolean {
  return id.startsWith(BROWSER_ID_PREFIX)
}
// How long to keep an entry stuck in the running state before we assume its
// run was abandoned and drop it. BrowserRuns settles interrupted browser runs
// as soon as it sees them; this catches anything it never did. Cloud designs
// are exempt: they finish without this tab, and the poller (CloudRuns) reads
// their outcome however long the person was away.
const STALE_RUNNING_TTL_MS = 24 * 60 * 60 * 1000

export type JobStatus = 'running' | 'completed' | 'failed' | 'cancelled'

// Structured failure shape (see job-result.ts). `code` lets the UI branch
// (retry vs user-action) without string sniffing; `retriable` says whether
// the same inputs would likely succeed on another attempt.
export type { JobError }

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
  // Set when the design ran in the cloud: its id there (the same as `id`),
  // which is what the poller reads and "Delete from cloud" deletes.
  cloudId?: string
  // The cloud copy was deleted; this entry is the only one left.
  cloudDeleted?: boolean
}

/**
 * Live progress for an in-flight job. Kept OUT of the persisted slice: a
 * backend progress tick every ~500ms used to rewrite all 50 entries —
 * including full results and form values — to storage.
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
  cloudId?: string
  cloudDeleted?: boolean
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
}

// ── Hydration ────────────────────────────────────────────────────────────
// The history is read from IndexedDB (see job-history-storage.ts), which is
// async: the store starts empty and fills in a moment later. Until then it
// holds back writes, since writing the not-yet-loaded state would overwrite
// the saved history, and the UI uses useJobHistoryHydrated() to tell "still
// loading" from "empty". Only the first load counts: a cross-tab reload swaps
// the history in place, and treating it as loading would flash the UI.
let hydrated = false
// A change was made (or stale entries swept) before the history loaded;
// write the merged result once it has.
let writeHeldBack = false
// The saved history could not be read. Writing would replace data we never
// saw, so this session stays in memory.
let readFailed = false
const hydrationListeners = new Set<() => void>()

function subscribeHydration(onChange: () => void) {
  hydrationListeners.add(onChange)
  return () => {
    hydrationListeners.delete(onChange)
  }
}

/** Whether the saved history has loaded. Always false during SSR. */
export function useJobHistoryHydrated(): boolean {
  return useSyncExternalStore(
    subscribeHydration,
    () => hydrated,
    () => false,
  )
}

/** Resolves once the saved history has loaded. Client only. */
export function whenJobHistoryHydrated(): Promise<void> {
  if (hydrated) return Promise.resolve()
  return new Promise((resolve) => {
    const unsubscribe = subscribeHydration(() => {
      unsubscribe()
      resolve()
    })
  })
}

// Cross-tab sync: after a write lands, tell the other tabs to reload, so
// every open tab converges on the same history. Without this, a design run
// in Tab A is invisible to Tab B, and two tabs can clobber each other's
// writes. IndexedDB has no equivalent of localStorage's
// `storage` event; a channel never delivers to its own sender.
const channel =
  typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel(STORAGE_KEY)
    : null

const storage = createJobHistoryStorage({
  maxEntries: MAX_ENTRIES,
  onWrite: () => channel?.postMessage('written'),
})

const gatedStorage: PersistStorage<PersistedJobHistory> | undefined =
  storage && {
    ...storage,
    // Returns nothing on purpose: persist hands setItem's return value back
    // from every store setter, and a promise there turns callers' sync
    // callbacks (an act() in tests, an onProgress handler) into async ones.
    // The storage handles its own write failures.
    setItem: (name, value) => {
      if (hydrated && !readFailed) {
        void storage.setItem(name, value)
      } else if (!hydrated) {
        writeHeldBack = true
      }
    },
  }

function finishHydration(entries: JobHistoryEntry[], error: unknown) {
  if (hydrated) return
  if (error) {
    readFailed = true
    log.warn('could not read job history — keeping this session in memory', {
      error: error instanceof Error ? error.message : 'unknown',
    })
  }
  hydrated = true
  if (writeHeldBack && !readFailed) {
    void storage?.setItem(STORAGE_KEY, {
      state: { entries },
      version: PERSIST_VERSION,
    })
  }
  writeHeldBack = false
  for (const listener of hydrationListeners) listener()
}

/** Drops running entries older than the TTL: runs that never settled. */
function sweepStaleRunning(entries: JobHistoryEntry[]): JobHistoryEntry[] {
  const cutoff = Date.now() - STALE_RUNNING_TTL_MS
  return entries.filter(
    (e) =>
      e.status !== 'running' ||
      e.cloudId !== undefined ||
      new Date(e.createdAt).getTime() >= cutoff,
  )
}

/**
 * Entries changed in this tab before the history loaded (a run submitted in
 * the first instant, an import) go on top of the saved ones, and win an id
 * collision, being the newer.
 */
function mergeEntries(
  memory: JobHistoryEntry[],
  saved: JobHistoryEntry[],
): JobHistoryEntry[] {
  if (memory.length === 0) return saved
  const known = new Set(memory.map((e) => e.id))
  return [...memory, ...saved.filter((e) => !known.has(e.id))].slice(
    0,
    MAX_ENTRIES,
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
      upsertEntry: ({
        id,
        status,
        result,
        error,
        formValues,
        cloudId,
        cloudDeleted,
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
            ...((cloudId ?? existing?.cloudId)
              ? { cloudId: cloudId ?? existing?.cloudId }
              : {}),
            ...((cloudDeleted ?? existing?.cloudDeleted)
              ? { cloudDeleted: true }
              : {}),
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
    }),
    {
      name: STORAGE_KEY,
      version: PERSIST_VERSION,
      storage: gatedStorage,
      partialize: (state): PersistedJobHistory => ({ entries: state.entries }),
      merge: (persisted, current) => {
        const raw = (persisted as Partial<PersistedJobHistory> | undefined)
          ?.entries
        const saved = Array.isArray(raw) ? raw : []
        // Orphans come from runs that never settled; after the TTL we assume
        // they never will.
        const fresh = sweepStaleRunning(saved)
        // Another tab wrote, and its copy is the latest.
        if (hydrated) return { ...current, entries: fresh }
        if (fresh.length !== saved.length) writeHeldBack = true
        return { ...current, entries: mergeEntries(current.entries, fresh) }
      },
      onRehydrateStorage: () => (state, error) =>
        finishHydration(state?.entries ?? [], error),
    },
  ),
)

function omit<T>(record: Record<string, T>, key: string): Record<string, T> {
  if (!(key in record)) return record
  const next = { ...record }
  delete next[key]
  return next
}

channel?.addEventListener('message', () => {
  if (hydrated) void useJobHistory.persist.rehydrate()
})
