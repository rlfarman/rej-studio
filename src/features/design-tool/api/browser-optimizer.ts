// Client for the in-browser optimizer.
//
// Owns the worker's lifecycle and turns its messages into a
// `JobActionResult` for `useJob`.
//
// The worker is created on first use and kept for the session: loading and
// compiling the WebAssembly costs about as much as a short design, and
// nothing carries over between runs. Cancelling terminates it, because a
// design running inside WebAssembly cannot be interrupted from outside; the
// next run starts a fresh one.

import {
  jobError,
  type JobActionResult,
} from '@/features/design-tool/types/job-result'
import {
  processResultSchema,
  type ProcessOptions,
} from '@/features/design-tool/types/optimizer-contract'
import type { ProcessResult } from '@/features/design-tool/types/process-result'
import type {
  OptimizerRequest,
  OptimizerResponse,
  ReverseTranslateRequest,
} from '@/features/design-tool/workers/optimizer-protocol'
import { designToolCopy } from '@/features/design-tool/copy'
import { createLogger } from '@/lib/logger'
import type { Species } from '@/lib/bio/species'

const log = createLogger('browser-optimizer')
const copy = designToolCopy.jobErrors

export interface BrowserDesignParams {
  CDS: string
  name: string
  options: ProcessOptions
}

export interface BrowserDesignCallbacks {
  onProgress?: (fraction: number, stage: string) => void
  /** Aborts the run by terminating the worker. */
  signal?: AbortSignal
}

/** The live worker, or null before first use and after a cancel. */
let worker: Worker | null = null

/**
 * The abort controllers of the designs running in this tab, keyed by the id of
 * the history entry each one is reported under.
 *
 * Module-level, like the unload guard in `utils/browser-run-guard.ts`: a run
 * belongs to the tab rather than to the component that started it, so UI
 * elsewhere — the Recent jobs list — can stop one. Only an abort stops a run;
 * writing a cancelled history entry leaves the worker burning CPU and its
 * result arriving later.
 */
const runningDesigns = new Map<string, AbortController>()

/**
 * Makes an in-flight run cancellable by id until the returned release is
 * called. The caller owns the controller; this only publishes it.
 */
export function registerBrowserRun(
  id: string,
  controller: AbortController,
): () => void {
  runningDesigns.set(id, controller)
  return () => {
    // Only if it is still this run's: a re-used id would otherwise lose its
    // own controller when an earlier run settles.
    if (runningDesigns.get(id) === controller) runningDesigns.delete(id)
  }
}

/**
 * Aborts the run reported under `id`, terminating the worker. Returns whether
 * there was one: a cloud design, or a run from a tab that has since gone, has
 * nothing to abort here.
 */
export function cancelBrowserRun(id: string): boolean {
  const controller = runningDesigns.get(id)
  if (!controller) return false
  runningDesigns.delete(id)
  controller.abort()
  return true
}

function getWorker(): Worker {
  worker ??= new Worker(
    new URL('../workers/optimizer.worker.ts', import.meta.url),
    { type: 'module', name: 'rej-optimizer' },
  )
  return worker
}

/** Tear the worker down; the next design starts a fresh one. */
export function terminateOptimizerWorker() {
  worker?.terminate()
  worker = null
}

/**
 * True when this browser can run the optimizer.
 *
 * Both are needed: a Worker to keep the tab responsive, and WebAssembly to
 * run the optimizer at all. Without them a run fails with a message saying
 * why.
 */
export function browserOptimizerSupported(): boolean {
  return typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined'
}

/**
 * Start the worker and the WebAssembly download ahead of time.
 *
 * Called when the design form mounts so the ~150 KB arrives while the user is
 * still entering a sequence, rather than after they press Run.
 */
export function warmOptimizerWorker() {
  if (!browserOptimizerSupported()) return
  try {
    getWorker()
  } catch (error) {
    // Pre-warming is an optimization; a failure here must not break the form.
    log.warn('could not pre-warm the optimizer worker', {
      reason: error instanceof Error ? error.name : 'unknown',
    })
  }
}

/** The DNA a protein reverse-translates to, or why it could not. */
export type ReverseTranslation =
  | { ok: true; CDS: string }
  | { ok: false; message: string }

/**
 * Reverse-translate a protein to DNA in the optimizer.
 *
 * The crate owns the codon tables, so this is the only implementation: the
 * DNA it returns is spelled with the very codons the optimizer scores
 * against. It runs in the same worker a design runs in, which the form warms
 * on mount, so by the time someone has pasted a protein the module is live.
 *
 * Never rejects; a failure comes back as `ok: false`.
 */
export function reverseTranslateInBrowser(
  protein: string,
  species: Species,
  { signal }: { signal?: AbortSignal } = {},
): Promise<ReverseTranslation> {
  if (!browserOptimizerSupported()) {
    return Promise.resolve({ ok: false, message: copy.browserUnsupported })
  }

  const runId = crypto.randomUUID()

  return new Promise((resolve) => {
    let settled = false
    const active = getWorker()

    const finish = (outcome: ReverseTranslation) => {
      if (settled) return
      settled = true
      active.removeEventListener('message', onMessage)
      active.removeEventListener('error', onWorkerError)
      signal?.removeEventListener('abort', onAbort)
      resolve(outcome)
    }

    const onMessage = (event: MessageEvent<OptimizerResponse>) => {
      const message = event.data
      if (!message || message.runId !== runId) return
      if (message.type === 'reverse-translated') {
        finish({ ok: true, CDS: message.CDS })
        return
      }
      if (message.type === 'error') {
        log.warn('reverse translation failed', { code: message.code })
        finish({
          ok: false,
          message:
            message.code === 'invalid_input'
              ? message.message
              : copy.browserFailed,
        })
      }
    }

    const onWorkerError = (event: ErrorEvent) => {
      log.error('optimizer worker crashed', event.error)
      terminateOptimizerWorker()
      finish({ ok: false, message: copy.browserFailed })
    }

    // A superseded request is dropped rather than cancelled: the call is
    // short, and terminating the worker would throw away the warm module.
    const onAbort = () => finish({ ok: false, message: copy.cancelled })

    active.addEventListener('message', onMessage)
    active.addEventListener('error', onWorkerError)
    signal?.addEventListener('abort', onAbort, { once: true })

    const request: ReverseTranslateRequest = {
      type: 'reverse-translate',
      runId,
      protein,
      species,
    }
    active.postMessage(request)
  })
}

/**
 * Seconds, to the hundredth, as the optimizer reports them elsewhere.
 */
function roundSeconds(seconds: number): number {
  return Math.round(seconds * 100) / 100
}

/**
 * Design a sequence in this browser.
 *
 * Never rejects: a failure comes back as `ok: false`.
 *
 * The duration is measured here rather than taken from the result: the
 * optimizer's clock reads zero under WebAssembly (`now_seconds` in
 * `rust/optimizer/src/lib.rs`), so every browser run would otherwise report
 * "<1s" on screen and `0s` in the exported report. The server-side runner
 * times its own call the same way (`src/server/mcp/optimizer.ts`).
 */
export function designInBrowser(
  params: BrowserDesignParams,
  { onProgress, signal }: BrowserDesignCallbacks = {},
): Promise<JobActionResult<ProcessResult>> {
  if (!browserOptimizerSupported()) {
    return Promise.resolve(jobError('backend', copy.browserUnsupported, false))
  }
  if (signal?.aborted) {
    return Promise.resolve(jobError('cancelled', copy.cancelled, true))
  }

  const runId = crypto.randomUUID()

  return new Promise((resolve) => {
    let settled = false
    const active = getWorker()
    const startedAt = performance.now()

    const finish = (outcome: JobActionResult<ProcessResult>) => {
      if (settled) return
      settled = true
      active.removeEventListener('message', onMessage)
      active.removeEventListener('error', onWorkerError)
      signal?.removeEventListener('abort', onAbort)
      resolve(outcome)
    }

    const onMessage = (event: MessageEvent<OptimizerResponse>) => {
      const message = event.data
      // A terminated run's messages can still arrive; ignore anything that
      // is not this run's.
      if (!message || message.runId !== runId) return

      if (message.type === 'progress') {
        onProgress?.(message.fraction, message.stage)
        return
      }
      if (message.type === 'error') {
        log.warn('browser design failed', { code: message.code })
        finish(
          jobError(
            message.code,
            message.code === 'invalid_input'
              ? message.message
              : copy.browserFailed,
            message.code !== 'invalid_input',
          ),
        )
        return
      }

      // A reverse translation's reply belongs to its own caller.
      if (message.type !== 'result') return

      // Parse the result, so a contract mismatch surfaces here rather than
      // three layers into the UI.
      const parsed = processResultSchema.safeParse(message.result)
      if (!parsed.success) {
        log.error('unexpected browser optimizer result', parsed.error)
        finish(jobError('backend', copy.unexpectedResponse, false))
        return
      }
      finish({
        ok: true,
        data: {
          ...parsed.data,
          processing_time_seconds: roundSeconds(
            (performance.now() - startedAt) / 1000,
          ),
        },
      })
    }

    const onWorkerError = (event: ErrorEvent) => {
      log.error('optimizer worker crashed', event.error)
      // A crashed worker cannot be reused.
      terminateOptimizerWorker()
      finish(jobError('backend', copy.browserFailed, true))
    }

    const onAbort = () => {
      terminateOptimizerWorker()
      finish(jobError('cancelled', copy.cancelled, true))
    }

    active.addEventListener('message', onMessage)
    active.addEventListener('error', onWorkerError)
    signal?.addEventListener('abort', onAbort, { once: true })

    const request: OptimizerRequest = {
      type: 'design',
      runId,
      CDS: params.CDS,
      name: params.name,
      options: params.options,
    }
    active.postMessage(request)
  })
}
