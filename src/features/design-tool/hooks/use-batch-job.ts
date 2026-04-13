'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { submitJob } from '@/features/design-tool/api/jobs'
import { useJobHistory } from '@/features/design-tool/hooks/use-job-history'
import type { BatchOptions } from '@/features/design-tool/types/batch-form-schema'
import type { BatchEntry } from '@/features/design-tool/utils/parse-batch-file'
import type { FormValues } from '@/features/design-tool/types/form-schema'
import { pickDefaultSplitPoint } from '@/features/design-tool/utils/default-split-point'
import { reverseTranslate } from '@/lib/bio/reverse-translate'
import { isSpecies, type Species } from '@/lib/bio/species'

const STORAGE_KEY = 'rej-studio:batch-jobs'
const MAX_BATCHES = 10
const CONCURRENCY = 3

export type BatchEntryStatus =
  | 'pending'
  | 'submitting'
  | 'running'
  | 'completed'
  | 'failed'

export interface BatchJobEntry {
  name: string
  sequence: string
  sequenceType: 'dna' | 'protein'
  jobId: string | null
  status: BatchEntryStatus
  error: string | null
}

export type BatchStatus =
  | 'idle'
  | 'submitting'
  | 'running'
  | 'completed'
  | 'partial'
  | 'failed'

export interface BatchJob {
  batchId: string
  createdAt: string
  entries: BatchJobEntry[]
  options: BatchOptions
  status: BatchStatus
}

interface BatchJobState {
  batches: BatchJob[]
  activeBatchId: string | null
  createBatch: (entries: BatchEntry[], options: BatchOptions) => string
  updateEntryStatus: (
    batchId: string,
    index: number,
    update: Partial<BatchJobEntry>,
  ) => void
  updateBatchStatus: (batchId: string, status: BatchStatus) => void
  removeBatch: (batchId: string) => void
  setActiveBatchId: (id: string | null) => void
  getActiveBatch: () => BatchJob | null
}

export const useBatchJobStore = create<BatchJobState>()(
  persist(
    (set, get) => ({
      batches: [],
      activeBatchId: null,

      createBatch: (entries, options) => {
        const batchId = crypto.randomUUID()
        const batch: BatchJob = {
          batchId,
          createdAt: new Date().toISOString(),
          entries: entries.map((e) => ({
            name: e.name,
            sequence: e.cleanedSequence,
            sequenceType: e.sequenceType,
            jobId: null,
            status: 'pending',
            error: null,
          })),
          options,
          status: 'idle',
        }
        set((state) => ({
          batches: [batch, ...state.batches].slice(0, MAX_BATCHES),
          activeBatchId: batchId,
        }))
        return batchId
      },

      updateEntryStatus: (batchId, index, update) => {
        set((state) => ({
          batches: state.batches.map((b) => {
            if (b.batchId !== batchId) return b
            const entries = [...b.entries]
            entries[index] = { ...entries[index], ...update }
            return { ...b, entries }
          }),
        }))
      },

      updateBatchStatus: (batchId, status) => {
        set((state) => ({
          batches: state.batches.map((b) =>
            b.batchId === batchId ? { ...b, status } : b,
          ),
        }))
      },

      removeBatch: (batchId) => {
        set((state) => ({
          batches: state.batches.filter((b) => b.batchId !== batchId),
          activeBatchId:
            state.activeBatchId === batchId ? null : state.activeBatchId,
        }))
      },

      setActiveBatchId: (id) => set({ activeBatchId: id }),

      getActiveBatch: () => {
        const { batches, activeBatchId } = get()
        return batches.find((b) => b.batchId === activeBatchId) ?? null
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        batches: state.batches,
        activeBatchId: state.activeBatchId,
      }),
    },
  ),
)

function buildFormValuesForEntry(
  entry: BatchJobEntry,
  options: BatchOptions,
  dnaSequence: string,
): FormValues {
  return {
    sequenceType: entry.sequenceType,
    codingSequence: dnaSequence,
    proteinSequence: entry.sequenceType === 'protein' ? entry.sequence : '',
    name: entry.name,
    species: options.species,
    codonOptimizeWeight: options.codonOptimizeWeight,
    removeCrypticSpliceSites: options.removeCrypticSpliceSites,
    removeCrypticSpliceSitesWeight: options.removeCrypticSpliceSitesWeight,
    minimizeCpgs: options.minimizeCpgs,
    minimizeCpgsWeight: options.minimizeCpgsWeight,
    reduceKmerComplexity: options.reduceKmerComplexity,
    reduceKmerComplexityWeight: options.reduceKmerComplexityWeight,
    enforceGcContent: options.enforceGcContent,
    '5PrimeStimulatoryIntron': options['5PrimeStimulatoryIntron'],
    '3PrimeStimulatoryIntron': options['3PrimeStimulatoryIntron'],
    spliceJunctionPosition: pickDefaultSplitPoint(dnaSequence),
  }
}

/** Submit all entries in a batch with concurrency limiting. */
export async function submitBatch(batchId: string) {
  const store = useBatchJobStore.getState()
  const batch = store.batches.find((b) => b.batchId === batchId)
  if (!batch) return

  const batchEntries = batch.entries
  const batchOptions = batch.options
  store.updateBatchStatus(batchId, 'submitting')
  const upsertEntry = useJobHistory.getState().upsertEntry

  const queue = batchEntries.map((_, i) => i)
  let running = 0
  let completed = 0
  let failed = 0

  await new Promise<void>((resolve) => {
    function next() {
      if (queue.length === 0 && running === 0) {
        // Determine final batch status
        const total = batchEntries.length
        let status: BatchStatus = 'completed'
        if (failed === total) status = 'failed'
        else if (failed > 0) status = 'partial'
        store.updateBatchStatus(batchId, status)
        resolve()
        return
      }

      while (running < CONCURRENCY && queue.length > 0) {
        const idx = queue.shift()!
        running++
        const entry = batchEntries[idx]
        store.updateEntryStatus(batchId, idx, { status: 'submitting' })

        void processEntry(entry, batchOptions, batchId, idx)
          .then(() => {
            completed++
          })
          .catch(() => {
            failed++
          })
          .finally(() => {
            running--
            next()
          })
      }
    }
    next()
  })

  async function processEntry(
    entry: BatchJobEntry,
    options: BatchOptions,
    batchId: string,
    idx: number,
  ) {
    let dnaSequence = entry.sequence

    // Reverse translate protein to DNA if needed
    if (entry.sequenceType === 'protein' && isSpecies(options.species)) {
      dnaSequence = reverseTranslate(entry.sequence, options.species as Species)
    }

    const formValues = buildFormValuesForEntry(entry, options, dnaSequence)
    const jobParams = {
      CDS: dnaSequence,
      name: entry.name,
      options: {
        codon_optimize: options.species !== 'none' ? options.species : null,
        codon_optimize_weight: options.codonOptimizeWeight,
        remove_cryptic_ss: options.removeCrypticSpliceSites,
        remove_cryptic_ss_weight: options.removeCrypticSpliceSitesWeight,
        minimize_CpGs: options.minimizeCpgs,
        minimize_CpGs_weight: options.minimizeCpgsWeight,
        reduce_kmer_complexity: options.reduceKmerComplexity,
        reduce_kmer_complexity_weight: options.reduceKmerComplexityWeight,
        enforce_gc: options.enforceGcContent,
        stim_5: options['5PrimeStimulatoryIntron'],
        stim_3: options['3PrimeStimulatoryIntron'],
        split_point: pickDefaultSplitPoint(dnaSequence),
        ensure_wggw: true,
        wggw_threshold: 300,
      } as Record<string, unknown>,
    }

    try {
      const { jobId, result } = await submitJob(jobParams)

      store.updateEntryStatus(batchId, idx, {
        jobId,
        status: result ? 'completed' : 'running',
      })

      // Also write to the global job history so JobWatcher picks it up
      if (result) {
        upsertEntry({
          id: jobId,
          status: 'completed',
          result:
            result as unknown as import('@/features/design-tool/types/process-result').ProcessResult,
          formValues,
        })
      } else {
        upsertEntry({
          id: jobId,
          status: 'running',
          formValues,
        })
      }

      // If it's running (Modal), we need to wait for it to complete.
      // The JobWatcher handles polling, but we need to sync the batch
      // entry status when it settles.
      if (!result) {
        store.updateBatchStatus(batchId, 'running')
      }
    } catch (err) {
      store.updateEntryStatus(batchId, idx, {
        status: 'failed',
        error: err instanceof Error ? err.message : 'Submission failed',
      })
      throw err
    }
  }
}

/**
 * Derive the real-time status of batch entries by cross-referencing the
 * global job history. Call this in components to get up-to-date statuses
 * that reflect poll results from JobWatcher.
 */
export function useBatchEntryStatuses(batchId: string | null) {
  const batch = useBatchJobStore(
    (s) => s.batches.find((b) => b.batchId === batchId) ?? null,
  )
  const jobEntries = useJobHistory((s) => s.entries)

  if (!batch) return null

  return batch.entries.map((entry) => {
    if (!entry.jobId) return entry

    const historyEntry = jobEntries.find((e) => e.id === entry.jobId)
    if (!historyEntry) return entry

    // Derive status from the authoritative job history
    const derivedStatus: BatchEntryStatus =
      historyEntry.status === 'cancelled' ? 'failed' : historyEntry.status
    return {
      ...entry,
      status: derivedStatus,
      error:
        historyEntry.status === 'failed' || historyEntry.status === 'cancelled'
          ? (historyEntry.error?.message ?? entry.error)
          : entry.error,
    }
  })
}
