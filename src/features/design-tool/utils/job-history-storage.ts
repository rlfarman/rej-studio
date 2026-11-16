import { createStore, del, get, set } from 'idb-keyval'
import type { PersistStorage, StorageValue } from 'zustand/middleware'
import type { JobHistoryEntry } from '@/features/design-tool/hooks/use-job-history'
import { createLogger } from '@/lib/logger'

const log = createLogger('job-history-storage')

export interface PersistedJobHistory {
  entries: JobHistoryEntry[]
}

type Stored = StorageValue<PersistedJobHistory>

/**
 * Where the history lives. A database of its own rather than a store in a
 * shared one: idb-keyval creates its object store only when the database is
 * first made, so a second store added later would never be created.
 */
export const JOB_HISTORY_IDB = {
  database: 'rej-studio-job-history',
  store: 'keyval',
} as const

interface Backend {
  kind: 'indexeddb' | 'localStorage'
  read: (name: string) => Promise<Stored | null>
  write: (name: string, value: Stored) => Promise<void>
  remove: (name: string) => Promise<void>
}

interface Options {
  /** History cap, applied when the migration merges two copies. */
  maxEntries: number
  /** Called after each write lands, so other tabs can be told to reload. */
  onWrite?: () => void
}

/**
 * Persist storage for the design history: IndexedDB, falling back to
 * localStorage, falling back to nothing (the store then lives in memory).
 *
 * The history used to live in localStorage, which caps an origin at ~5MB and
 * holds every run's full optimized sequences. IndexedDB's quota is a share of
 * the disk instead. Small preferences (species filter, favorites, recent
 * genes, sidebar state, form drafts) stay in localStorage: they are tiny and
 * read synchronously during render.
 *
 *  - The first read moves an old localStorage history into IndexedDB and
 *    deletes the localStorage key only once the IndexedDB write has landed.
 *  - Without IndexedDB (blocked, or a browser that refuses it in private
 *    windows) the old localStorage storage is used, under the same key, so
 *    such a browser keeps its history and a later session can migrate it.
 *  - Writes are serialized and coalesced, so a slow write can't land after a
 *    newer one, and a QuotaExceededError retries with a slimmed payload
 *    rather than losing the write.
 *  - Nothing here throws to the caller except a failed IndexedDB read, which
 *    the store treats as "don't overwrite what we couldn't read".
 */
export function createJobHistoryStorage({
  maxEntries,
  onWrite,
}: Options): PersistStorage<PersistedJobHistory> | undefined {
  // No window on the server, so persistence is simply off there.
  if (typeof window === 'undefined') return undefined

  let backend: Promise<Backend | null> | undefined
  const getBackend = () => (backend ??= openBackend())

  // Coalescing write queue: one write in flight; anything newer replaces the
  // queued value rather than lining up behind it.
  let queued: { name: string; value: Stored } | null = null
  let flushing: Promise<void> | null = null

  async function flush() {
    const target = await getBackend()
    while (queued) {
      const { name, value } = queued
      queued = null
      if (target && (await writeSlimming(target, name, value))) onWrite?.()
    }
    flushing = null
  }

  return {
    getItem: async (name) => {
      const target = await getBackend()
      if (!target) return null
      const stored = await target.read(name)
      if (target.kind !== 'indexeddb') return stored
      return migrateFromLocalStorage(target, name, stored, maxEntries)
    },
    setItem: (name, value) => {
      queued = { name, value }
      flushing ??= flush()
      return flushing
    },
    removeItem: async (name) => {
      queued = null
      const target = await getBackend()
      await target?.remove(name).catch(() => {})
    },
  }
}

async function openBackend(): Promise<Backend | null> {
  const idb = await openIndexedDb()
  if (idb) return idb
  log.warn('IndexedDB unavailable — job history falls back to localStorage')
  return openLocalStorage()
}

async function openIndexedDb(): Promise<Backend | null> {
  try {
    const store = createStore(JOB_HISTORY_IDB.database, JOB_HISTORY_IDB.store)
    // Opening is lazy, so probe with a read: a browser that blocks IndexedDB
    // fails here (sometimes asynchronously) rather than on first use.
    await get('probe', store)
    return {
      kind: 'indexeddb',
      read: async (name) => {
        const value: unknown = await get(name, store)
        return isStored(value) ? value : null
      },
      write: (name, value) => set(name, value, store),
      remove: (name) => del(name, store),
    }
  } catch {
    return null
  }
}

function openLocalStorage(): Backend | null {
  try {
    if (!window.localStorage) return null
  } catch {
    return null
  }
  return {
    kind: 'localStorage',
    read: async (name) => readLocalStorage(name),
    write: async (name, value) => {
      window.localStorage.setItem(name, JSON.stringify(value))
    },
    remove: async (name) => window.localStorage.removeItem(name),
  }
}

/** The localStorage copy, or null when absent, unreadable or not ours. */
function readLocalStorage(name: string): Stored | null {
  try {
    const raw = window.localStorage.getItem(name)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    return isStored(value) ? value : null
  } catch {
    return null
  }
}

/**
 * Moves a localStorage history into IndexedDB. When both exist (an older
 * tab wrote localStorage after a migration), they are merged by id with the
 * IndexedDB copy winning, so neither side's runs are lost. The localStorage
 * key is removed only after the merged history is safely in IndexedDB; if
 * that write fails, the key stays and the next load tries again.
 */
async function migrateFromLocalStorage(
  idb: Backend,
  name: string,
  stored: Stored | null,
  maxEntries: number,
): Promise<Stored | null> {
  const legacy = readLocalStorage(name)
  if (!legacy) return stored

  const migrated: Stored = stored
    ? {
        ...stored,
        state: {
          entries: mergeById(
            stored.state.entries,
            legacy.state.entries,
            maxEntries,
          ),
        },
      }
    : legacy

  try {
    await idb.write(name, migrated)
  } catch (err) {
    log.warn(
      'could not move job history to IndexedDB — keeping it in localStorage',
      {
        error: err instanceof Error ? err.message : 'unknown',
      },
    )
    return migrated
  }
  try {
    window.localStorage.removeItem(name)
  } catch {
    // Already safe in IndexedDB; the next load merges and retries.
  }
  log.info('moved job history from localStorage to IndexedDB', {
    entries: migrated.state.entries.length,
  })
  return migrated
}

/** Union by id, `primary` winning on a collision, newest first. */
function mergeById(
  primary: JobHistoryEntry[],
  secondary: JobHistoryEntry[],
  maxEntries: number,
): JobHistoryEntry[] {
  const known = new Set(primary.map((e) => e.id))
  return [...primary, ...secondary.filter((e) => !known.has(e.id))]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, maxEntries)
}

/**
 * Successively smaller payloads: full, results dropped from the oldest half,
 * results dropped entirely, then only the newest 10. Returns whether any
 * attempt landed.
 */
async function writeSlimming(
  target: Backend,
  name: string,
  value: Stored,
): Promise<boolean> {
  const { entries } = value.state
  const attempts: PersistedJobHistory[] = [
    { entries },
    { entries: dropResults(entries, Math.ceil(entries.length / 2)) },
    { entries: dropResults(entries, 0) },
    { entries: dropResults(entries, 0).slice(0, 10) },
  ]
  for (const state of attempts) {
    try {
      await target.write(name, { ...value, state })
      return true
    } catch (err) {
      // Blocked storage or a closed database: nothing a smaller payload fixes.
      if (!isQuotaError(err)) return false
    }
  }
  log.warn('could not persist job history — storage quota exceeded')
  return false
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

function isStored(value: unknown): value is Stored {
  if (typeof value !== 'object' || value === null) return false
  const { state } = value as { state?: unknown }
  return (
    typeof state === 'object' &&
    state !== null &&
    Array.isArray((state as { entries?: unknown }).entries)
  )
}
