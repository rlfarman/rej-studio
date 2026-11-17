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
 * Design a sequence in this browser.
 *
 * Never rejects: a failure comes back as `ok: false`.
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
      finish({ ok: true, data: parsed.data })
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
