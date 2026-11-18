import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import {
  browserOptimizerSupported,
  designInBrowser,
  registerBrowserRun,
  warmOptimizerWorker,
} from '@/features/design-tool/api/browser-optimizer'
import {
  deleteCloudDesign,
  fetchCloudDesign,
  myCloudDesignsQuery,
  submitCloudDesign,
} from '@/features/design-tool/api/cloud-designs'
import { afterAccountChange } from '@/lib/account/account'
import { openSignIn } from '@/stores/sign-in-dialog-store'
import {
  CLOUD_DESIGN_MAX_BASES,
  estimateCloudSeconds,
  isCloudDesignId,
} from '@/features/design-tool/types/cloud-design'
import { buildJobParams } from '@/features/design-tool/utils/form-handler'
import {
  applyCloudDesign,
  cloudRuns,
} from '@/features/design-tool/utils/cloud-runs'
import {
  BROWSER_ID_PREFIX,
  isBrowserJobId,
  useJobHistory,
  useJobHistoryHydrated,
  type JobStatus as EntryStatus,
  type JobError,
} from '@/features/design-tool/hooks/use-job-history'
import type { ProcessResult } from '@/features/design-tool/types/process-result'
import type { FormValues } from '@/features/design-tool/types/form-schema'
import {
  guardUnload,
  holdRunLock,
} from '@/features/design-tool/utils/browser-run-guard'
import {
  notifyRunSettled,
  requestOpenJob,
} from '@/features/design-tool/utils/finish-notification'
import { designToolCopy } from '@/features/design-tool/copy'

const copy = designToolCopy.jobErrors
const runCopy = designToolCopy.browserRun
const cloudCopy = designToolCopy.cloud

/** A cloud submission the Worker refused; its message is for the person. */
class CloudSubmitError extends Error {
  override name = 'CloudSubmitError'
}

interface SubmitOptions {
  /** Run in the cloud rather than in this tab, so the tab can close. */
  cloud?: boolean
}

type JobStatus = 'idle' | 'submitting' | EntryStatus

/**
 * Whether this run has already been recorded as cancelled — by the Recent
 * jobs list, or by a cloud copy being deleted mid-flight. Its result, which
 * can still arrive while the worker winds down, is then not written anywhere.
 */
function wasCancelled(id: string): boolean {
  return useJobHistory.getState().getEntry(id)?.status === 'cancelled'
}

interface UseJobOptions {
  // If set, seeds jobId so derived state reads from this design's history
  // entry. Designs run in the browser, so only this browser's history can
  // resolve it: an id it doesn't have reads as no longer available.
  initialJobId?: string | null
  /**
   * Called when a new run replaces the design `initialJobId` named, so the
   * caller can drop it from the URL (without remounting the form mid-run).
   */
  onLeaveJob?: (jobId: string) => void
  /**
   * Called with a cloud design's id once it is submitted. Unlike a browser
   * run's, it resolves anywhere, so the caller can put it in the URL: a
   * reload, or the link sent to a colleague, opens the same design.
   */
  onCloudJob?: (jobId: string) => void
}

/** What the job view needs to know about a design that ran in the cloud. */
interface CloudJobInfo {
  id: string
  /** Its cloud copy was deleted; only this browser's remains. */
  deleted: boolean
  /** About how long it takes, from its length (no live progress exists). */
  estimateSeconds: number
}

interface UseJobReturn {
  submitJob: (values: FormValues, options?: SubmitOptions) => Promise<void>
  cancelJob: () => Promise<void>
  jobId: string | null
  status: JobStatus
  result: ProcessResult | null
  error: JobError | null
  formValues: FormValues | null
  progress: number | undefined
  stage: string | undefined
  isLoading: boolean
  /** Whether this browser can run the designer (Web Workers + WebAssembly). */
  runsInBrowser: boolean
  /**
   * True while a resumed job's entry may still be loading from storage
   * (history hydrates asynchronously). Callers should show neither the
   * empty form nor "not found" until it clears.
   */
  isRestoring: boolean
  /**
   * The submission was refused before anything ran (a cloud design the
   * Worker would not take). Nothing exists to show, so the caller keeps the
   * form up — the option to change is on it.
   */
  failedBeforeStart: boolean
  /** Set when the design shown ran in the cloud. */
  cloud: CloudJobInfo | null
  /** Deletes the shown design's cloud copy (its owner only). */
  deleteFromCloud: () => Promise<void>
  isDeletingFromCloud: boolean
}

/**
 * Whether this browser can run the designer. Checked after mount (the
 * prerendered shell can't know), and the optimizer starts downloading
 * then, while the person is still entering a sequence. A browser without
 * support still gets a run: it fails with a message saying why.
 */
function useBrowserOptimizer(): boolean {
  const [supported, setSupported] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability is an external system, only knowable on the client
    setSupported(browserOptimizerSupported())
    warmOptimizerWorker()
  }, [])
  return supported
}

export function useJob({
  initialJobId = null,
  onLeaveJob,
  onCloudJob,
}: UseJobOptions = {}): UseJobReturn {
  const [jobId, setJobIdState] = useState<string | null>(initialJobId)
  const runsInBrowser = useBrowserOptimizer()
  // The in-flight browser run, if any. Cancel aborts it (there is no
  // server-side job to cancel), and a thrown mutation settles its entry.
  const browserRunRef = useRef<{
    id: string
    controller: AbortController
  } | null>(null)
  // Selector-scoped reads so this hook only re-renders when the specific
  // entry it cares about changes.
  const upsertEntry = useJobHistory((s) => s.upsertEntry)
  const entry = useJobHistory(
    (s) => s.entries.find((e) => e.id === jobId) ?? null,
  )
  const progress = useJobHistory((s) => (jobId ? s.progressById[jobId] : null))
  const historyHydrated = useJobHistoryHydrated()
  const queryClient = useQueryClient()
  // The job this hook is showing, for a notification click to tell whether
  // the run is already on screen. Null once the form unmounts.
  const shownJobIdRef = useRef<string | null>(null)
  useEffect(() => {
    shownJobIdRef.current = jobId
    return () => {
      shownJobIdRef.current = null
    }
  }, [jobId])

  const openJob = (id: string) => {
    if (shownJobIdRef.current === id) return
    // The form that ran it is gone (the person navigated away): load the
    // job from history. A browser run's id resolves only on this device,
    // which is where the notification is.
    requestOpenJob(id)
  }

  /**
   * Submits to the cloud. Nothing runs here: the history entry, keyed by the
   * cloud id, is marked running and the app shell's poller (CloudRuns) fills
   * it in. An identical design submitted before gets the same id back, so
   * it lands on the same entry instead of a duplicate.
   */
  const submitToCloud = async (values: FormValues) => {
    // The Worker checks this too; checking here saves sending 45 kb to be
    // told no.
    if (values.codingSequence.length > CLOUD_DESIGN_MAX_BASES) {
      throw new CloudSubmitError(
        cloudCopy.tooLong(values.codingSequence.length, CLOUD_DESIGN_MAX_BASES),
      )
    }
    const submitted = await submitCloudDesign(values)
    if (!submitted.ok) {
      if (submitted.reason === 'account_required') {
        // Signed out somewhere else, or the session ran out: say so, and
        // offer the way back in.
        void afterAccountChange(queryClient)
        openSignIn()
      }
      throw new CloudSubmitError(submitted.message)
    }
    const { id, status } = submitted.data
    const existing = useJobHistory.getState().getEntry(id)
    if (existing?.status !== 'completed' || status !== 'completed') {
      upsertEntry({ id, status: 'running', formValues: values, cloudId: id })
    }
    setJobIdState(id)
    cloudRuns.wake()
    void queryClient.invalidateQueries({
      queryKey: myCloudDesignsQuery.queryKey,
    })
    onCloudJob?.(id)
  }

  const submitMutation = useMutation({
    mutationFn: async ({
      values,
      cloud = false,
    }: {
      values: FormValues
      cloud?: boolean
    }) => {
      if (cloud) {
        await submitToCloud(values)
        return null
      }
      const params = buildJobParams(values)

      // The design runs here, so there is no job to poll. A local id carries
      // progress and the finished result through the run's history entry.
      // It is never written to the URL: it resolves only in this browser.
      const id = `${BROWSER_ID_PREFIX}${crypto.randomUUID()}`
      const controller = new AbortController()
      browserRunRef.current = { id, controller }
      // Published for the whole tab, so the Recent jobs list can abort this
      // run too: nothing else stops the worker.
      const unregisterRun = registerBrowserRun(id, controller)

      upsertEntry({ id, status: 'running', formValues: values })
      useJobHistory
        .getState()
        .setProgress(id, { progress: 0.02, stage: 'Starting' })
      setJobIdState(id)

      const run = designInBrowser(params, {
        signal: controller.signal,
        onProgress: (progress, stage) =>
          useJobHistory.getState().setProgress(id, { progress, stage }),
      })
      // The worker dies with the tab: warn before it closes, and hold a lock
      // that tells other tabs this run is alive (BrowserRunRecovery).
      const releaseUnload = guardUnload()
      holdRunLock(id, run)
      try {
        return { outcome: await run, values, id }
      } catch (err) {
        // A thrown run (a bug, not an expected failure) still settles its
        // entry, or it would read as running until the next load. A run
        // already cancelled keeps that, and says nothing.
        if (wasCancelled(id)) throw err
        upsertEntry({
          id,
          status: 'failed',
          error: { code: 'unknown', message: copy.unknown, retriable: true },
        })
        notifyRunSettled({
          id,
          title: runCopy.failedTitle,
          body: runCopy.failedBody(values.name, copy.unknown),
          onOpen: () => openJob(id),
        })
        throw err
      } finally {
        releaseUnload()
        unregisterRun()
        browserRunRef.current = null
      }
    },
    onMutate: () => {
      setJobIdState(null)
      if (initialJobId) onLeaveJob?.(initialJobId)
    },
    // The run's history entry was created when the design started, so
    // progress had somewhere to go; settle that one in place.
    onSuccess: (settled) => {
      // A cloud submission settles through the poller, not here.
      if (!settled) return
      const { outcome, values, id } = settled
      // A run cancelled from elsewhere (the Recent jobs list) keeps its
      // cancelled entry: its own late result must not turn it back into a
      // finished design nobody asked for.
      if (wasCancelled(id)) return
      if (outcome.ok) {
        upsertEntry({
          id,
          status: 'completed',
          result: outcome.data,
          formValues: values,
        })
        notifyRunSettled({
          id,
          title: runCopy.completedTitle,
          body: runCopy.completedBody(values.name),
          onOpen: () => openJob(id),
        })
        return
      }
      const cancelled = outcome.error.code === 'cancelled'
      upsertEntry({
        id,
        status: cancelled ? 'cancelled' : 'failed',
        error: outcome.error,
        formValues: values,
      })
      if (!cancelled) {
        notifyRunSettled({
          id,
          title: runCopy.failedTitle,
          body: runCopy.failedBody(values.name, outcome.error.message),
          onOpen: () => openJob(id),
        })
      }
    },
  })

  // Aborting terminates the worker; the submit path records the
  // cancellation. There is nothing to cancel once no run is in flight.
  const cancelJob = () => {
    browserRunRef.current?.controller.abort()
    return Promise.resolve()
  }

  // A `?job=` naming a cloud design this browser has no entry for — a link
  // from a colleague or another device — is read from the cloud, and kept in
  // this browser's history from then on (running ones are then polled).
  const remoteId =
    historyHydrated &&
    !entry &&
    jobId !== null &&
    jobId === initialJobId &&
    isCloudDesignId(jobId)
      ? jobId
      : null
  const remoteLookup = useQuery({
    queryKey: ['cloud-design', remoteId],
    queryFn: async () => {
      const answer = await fetchCloudDesign(remoteId!)
      if (answer.ok) return answer.data
      if (answer.status === 404) return null
      throw new Error(answer.message)
    },
    enabled: remoteId !== null,
    retry: false,
    staleTime: Infinity,
  })
  const remoteDesign = remoteLookup.data
  useEffect(() => {
    if (!remoteDesign) return
    applyCloudDesign(remoteDesign)
    cloudRuns.wake()
  }, [remoteDesign])
  const remoteLookupPending =
    remoteId !== null &&
    (remoteLookup.isPending || (remoteLookup.data != null && !entry))

  // Derive unified status/result/error. Submit-in-flight comes from the
  // mutation; everything after that reads the entry, including failures
  // (which are recorded as entries above). A thrown mutation error is a bug
  // rather than an expected failure, so it gets the generic message.
  let status: JobStatus = 'idle'
  let result: ProcessResult | null = null
  let error: JobError | null = null

  if (submitMutation.isError) {
    status = 'failed'
    error =
      submitMutation.error instanceof CloudSubmitError
        ? {
            code: 'backend',
            message: submitMutation.error.message,
            retriable: true,
          }
        : { code: 'unknown', message: copy.unknown, retriable: true }
  } else if (entry) {
    status = entry.status
    result = entry.result
    error = entry.error
  } else if (submitMutation.isPending) {
    status = 'submitting'
  } else if (
    historyHydrated &&
    jobId !== null &&
    jobId === initialJobId &&
    !remoteLookupPending
  ) {
    // A `?job=` this browser has no record of and the cloud does not have
    // either: a browser run from another device, a cleared history, or a
    // cloud design past its retention. Which of those it is decides what
    // there is to do about it, so the id says so rather than one message
    // covering all three.
    status = 'failed'
    error = remoteLookup.isError
      ? // The cloud could not be asked (offline, signed out): say that, not
        // that the design does not exist.
        {
          code: 'backend',
          message: remoteLookup.error.message,
          retriable: false,
        }
      : {
          code: 'not_found',
          message: isBrowserJobId(jobId)
            ? copy.notFoundBrowser
            : isCloudDesignId(jobId)
              ? copy.notFoundCloud
              : copy.notFound,
          retriable: false,
        }
  }

  const submitJob = async (values: FormValues, options: SubmitOptions = {}) => {
    await submitMutation.mutateAsync({ values, cloud: options.cloud })
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const answer = await deleteCloudDesign(id)
      // Already gone from the cloud is what was asked for.
      if (!answer.ok && answer.status !== 404) throw new Error(answer.message)
      return id
    },
    onSuccess: (id) => {
      void queryClient.invalidateQueries({
        queryKey: myCloudDesignsQuery.queryKey,
      })
      const current = useJobHistory.getState().getEntry(id)
      if (!current) return
      upsertEntry({
        id,
        // A run deleted mid-flight will never report back.
        status: current.status === 'running' ? 'cancelled' : current.status,
        cloudDeleted: true,
      })
      toast.success(cloudCopy.deleted)
    },
    onError: (err) =>
      toast.error(
        cloudCopy.deleteFailed(err instanceof Error ? err.message : ''),
      ),
  })

  const deleteFromCloud = async () => {
    if (!entry?.cloudId || entry.cloudDeleted) return
    await deleteMutation.mutateAsync(entry.cloudId).catch(() => {})
  }

  return {
    submitJob,
    cancelJob,
    jobId,
    status,
    result,
    error,
    formValues: entry?.formValues ?? null,
    progress: progress?.progress,
    stage: progress?.stage,
    isLoading: status === 'submitting' || status === 'running',
    // Only a refused submission: a run that started and then failed has an
    // entry, a result view and a "Run again" that can work.
    failedBeforeStart: submitMutation.error instanceof CloudSubmitError,
    runsInBrowser,
    isRestoring:
      jobId !== null &&
      jobId === initialJobId &&
      !entry &&
      (!historyHydrated || remoteLookupPending),
    cloud: entry?.cloudId
      ? {
          id: entry.cloudId,
          deleted: entry.cloudDeleted === true,
          estimateSeconds: estimateCloudSeconds(entry.sequenceLength),
        }
      : null,
    deleteFromCloud,
    isDeletingFromCloud: deleteMutation.isPending,
  }
}
