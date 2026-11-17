// Backup and restore of the browser-only user data (favorite genes, recent
// genes, design-job history) behind the sidebar's Export/Import items. Each
// feature owns its store; this app-level module composes them, like
// seed-data.ts does for the demo data.
//
// Import goes through each store's own API rather than writing storage
// directly: the stores are already hydrated, so a raw storage write was
// overwritten by the next store update and the import was lost. Both wait for
// the design history to load (it is read from IndexedDB asynchronously), so
// an export can't miss jobs and an import counts against the full history.
import { z } from 'zod'
import { downloadTextFile } from '@/lib/download-file'
import { useFavoriteGenes } from '@/features/gene-search/stores/favorite-genes-store'
import { useRecentGenes } from '@/features/gene-search/stores/recent-genes-store'
import type { SavedGene } from '@/features/gene-search/types/domain-types'
import {
  isSeedId,
  useJobHistory,
  whenJobHistoryHydrated,
  type JobHistoryEntry,
} from '@/features/design-tool/hooks/use-job-history'
import type { ProcessResult } from '@/features/design-tool/types/process-result'
import type { FormValues } from '@/features/design-tool/types/form-schema'
import { jobErrorSchema } from '@/features/design-tool/types/backend-contract'

const EXPORT_VERSION = 1
// Backups hold at most 50 jobs (the history's own cap), each with full
// sequences; anything far larger isn't one of ours.
const MAX_FILE_BYTES = 10 * 1024 * 1024

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const savedGeneSchema = z.object({
  id: z.string().min(1).max(100),
  symbol: z.string().min(1).max(100),
  name: z.string().max(500),
  species: z.string().max(50).optional(),
  matchedIsoformId: z.string().max(100).optional(),
  isSeed: z.boolean().optional(),
}) satisfies z.ZodType<SavedGene>

// Results and form values are large nested objects written by the app
// itself; check the fields the UI reads first rather than the whole shape.
const processResultSchema = z.custom<ProcessResult>(
  (v) =>
    isRecord(v) &&
    typeof v.name === 'string' &&
    typeof v.original_sequence === 'string' &&
    typeof v.optimized_sequence === 'string',
)
const formValuesSchema = z.custom<FormValues>(
  (v) =>
    isRecord(v) &&
    typeof v.name === 'string' &&
    typeof v.codingSequence === 'string',
)

const jobEntrySchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().max(500),
  sequenceLength: z.number().int().nonnegative(),
  createdAt: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date'),
  status: z.enum(['running', 'completed', 'failed', 'cancelled']),
  result: processResultSchema.nullable(),
  // Same codes as the live job pipeline, so new codes need no edit here.
  error: jobErrorSchema.extend({ message: z.string().max(2000) }).nullable(),
  formValues: formValuesSchema.optional(),
  progress: z.number().min(0).max(1).optional(),
  stage: z.string().max(100).optional(),
  isSeed: z.boolean().optional(),
}) satisfies z.ZodType<JobHistoryEntry>

// Each section mirrors a store's zustand-persist payload (`{ state, version }`)
// under its storage key, the format backups have always used, so files
// exported by earlier versions still import.
const persisted = <T extends z.ZodType>(state: T) =>
  z.object({ state, version: z.number().optional() })

const backupSchema = z.object({
  version: z.literal(EXPORT_VERSION),
  exportedAt: z.string().optional(),
  data: z.object({
    favoriteGenes: persisted(
      z.object({ favoriteGenes: z.array(savedGeneSchema).max(1000) }),
    ).optional(),
    recentGenes: persisted(
      z.object({ recentGenes: z.array(savedGeneSchema).max(100) }),
    ).optional(),
    'rej-studio:job-history': persisted(
      z.object({ entries: z.array(jobEntrySchema).max(50) }),
    ).optional(),
  }),
})

type Backup = z.infer<typeof backupSchema>

const isRealGene = (gene: SavedGene) => !gene.isSeed
// Seeded jobs are flagged, and their ids carry the seed prefix.
const isRealJob = (entry: JobHistoryEntry) =>
  !entry.isSeed && !isSeedId(entry.id)

/** The current user data as a backup payload. Demo (seed) entries are left out. */
export function buildBackup(now = new Date()): Backup {
  return {
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    data: {
      favoriteGenes: {
        state: {
          favoriteGenes: useFavoriteGenes
            .getState()
            .favoriteGenes.filter(isRealGene),
        },
        version: 0,
      },
      recentGenes: {
        state: {
          recentGenes: useRecentGenes.getState().recentGenes.filter(isRealGene),
        },
        version: 0,
      },
      'rej-studio:job-history': {
        state: {
          entries: useJobHistory.getState().entries.filter(isRealJob),
        },
        version: 0,
      },
    },
  }
}

export async function exportUserData() {
  await whenJobHistoryHydrated()
  const now = new Date()
  downloadTextFile(
    `rej-studio-backup-${now.toISOString().slice(0, 10)}.json`,
    JSON.stringify(buildBackup(now), null, 2),
  )
}

type ImportCounts = { favorites: number; recents: number; jobs: number }

export type ImportResult =
  | { ok: true; added: ImportCounts }
  | { ok: false; reason: 'too-large' | 'unreadable' | 'invalid' }

/**
 * Merge a backup into the stores. Entries already on this device win on an
 * id collision, so importing an old backup never rolls anything back.
 * Returns how many entries each store gained.
 */
function applyBackup(backup: Backup): ImportCounts {
  const added: ImportCounts = { favorites: 0, recents: 0, jobs: 0 }

  const favorites = backup.data.favoriteGenes?.state.favoriteGenes ?? []
  if (favorites.length > 0) {
    const current = useFavoriteGenes.getState().favoriteGenes
    const known = new Set(current.map((g) => g.id))
    const incoming = favorites.filter((g) => isRealGene(g) && !known.has(g.id))
    if (incoming.length > 0) {
      useFavoriteGenes.setState({ favoriteGenes: [...current, ...incoming] })
      added.favorites = incoming.length
    }
  }

  const recents = backup.data.recentGenes?.state.recentGenes ?? []
  if (recents.length > 0) {
    const { recentGenes: current, addRecentGene } = useRecentGenes.getState()
    const known = new Set(current.map((g) => g.id))
    const incoming = recents.filter((g) => isRealGene(g) && !known.has(g.id))
    // addRecentGene prepends and applies the store's own size cap. Replaying
    // oldest-first (imported, then this device's own, newer, entries) keeps
    // the device's recents on top and lets the cap trim imported ones first.
    for (const gene of [...incoming].reverse()) addRecentGene(gene)
    for (const gene of [...current].reverse()) addRecentGene(gene)
    const kept = new Set(useRecentGenes.getState().recentGenes.map((g) => g.id))
    added.recents = incoming.filter((g) => kept.has(g.id)).length
  }

  const jobs = backup.data['rej-studio:job-history']?.state.entries ?? []
  if (jobs.length > 0) {
    const current = useJobHistory.getState().entries
    const known = new Set(current.map((e) => e.id))
    const incoming = jobs.filter((e) => isRealJob(e) && !known.has(e.id))
    if (incoming.length > 0) {
      const merged = [...current, ...incoming].sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      )
      useJobHistory.setState({ entries: merged })
      added.jobs = incoming.length
    }
  }

  return added
}

export async function importUserData(file: File): Promise<ImportResult> {
  if (file.size > MAX_FILE_BYTES) return { ok: false, reason: 'too-large' }

  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch {
    return { ok: false, reason: 'unreadable' }
  }

  const parsed = backupSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  await whenJobHistoryHydrated()
  return { ok: true, added: applyBackup(parsed.data) }
}
