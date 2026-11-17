import type { CloudCall } from '@/features/design-tool/api/cloud-designs'
import type { CloudDesign } from '@/features/design-tool/types/cloud-design'

/**
 * Polls the cloud designs this browser is waiting on, with backoff.
 *
 * A Workflow cannot push, and a design takes from seconds to minutes, so the
 * history polls: soon after a submit, then less and less often, up to once a
 * minute. Focus (the person came back) resets the backoff and polls at once,
 * which is when an answer matters. Nothing polls when nothing is running.
 *
 * Environment-free on purpose: the fetch, the list of running ids, what to do
 * with an answer and the timers are all passed in, so the schedule is tested
 * with fake timers and no network (cloud-poller.test.ts).
 */

/** The first wait, and the cap the waits double up to. */
const FIRST_DELAY_MS = 2_000
const MAX_DELAY_MS = 60_000

/** The wait before poll number `attempt` (0-based): 2 s, 4 s, 8 s … 60 s. */
export function nextPollDelay(attempt: number): number {
  return Math.min(MAX_DELAY_MS, FIRST_DELAY_MS * 2 ** Math.max(0, attempt))
}

export interface CloudPollerDeps {
  /** Ids of the cloud designs history shows as running. */
  runningIds: () => string[]
  fetchDesign: (id: string) => Promise<CloudCall<CloudDesign>>
  /** A design reached an answer: finished, failed, or gone (404). */
  onSettled: (
    id: string,
    outcome: { found: true; design: CloudDesign } | { found: false },
  ) => void
  setTimer?: (callback: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

export interface CloudPoller {
  /** Polls now and keeps polling while anything runs. Idempotent. */
  start: () => void
  /** Something changed (focus, a new submit): reset the backoff, poll now. */
  wake: () => void
  stop: () => void
}

export function createCloudPoller({
  runningIds,
  fetchDesign,
  onSettled,
  setTimer = (callback, ms) => setTimeout(callback, ms),
  clearTimer = (handle) => clearTimeout(handle as number),
}: CloudPollerDeps): CloudPoller {
  let attempt = 0
  let timer: unknown = null
  let polling: Promise<void> | null = null
  let stopped = true
  // A wake that arrived mid-poll: poll again straight after, with the reset.
  let wokeDuringPoll = false

  function schedule() {
    if (stopped || timer !== null) return
    if (runningIds().length === 0) return
    timer = setTimer(() => {
      timer = null
      void poll()
    }, nextPollDelay(attempt))
    attempt++
  }

  async function poll(): Promise<void> {
    if (stopped) return
    if (polling) {
      wokeDuringPoll = true
      return polling
    }
    polling = (async () => {
      for (const id of runningIds()) {
        const answer = await fetchDesign(id)
        if (answer.ok) {
          const { status } = answer.data
          if (status === 'completed' || status === 'failed') {
            onSettled(id, { found: true, design: answer.data })
          }
        } else if (answer.status === 404) {
          onSettled(id, { found: false })
        }
        // Anything else (offline, signed out, a 5xx) is not an answer about
        // the design: keep it running and try again on the next poll.
      }
    })()
    try {
      await polling
    } finally {
      polling = null
    }
    if (wokeDuringPoll) {
      wokeDuringPoll = false
      attempt = 0
      return poll()
    }
    schedule()
  }

  function cancelTimer() {
    if (timer !== null) clearTimer(timer)
    timer = null
  }

  // Arrow functions, so they can be handed around as listeners unbound.
  return {
    start: () => {
      if (!stopped) return
      stopped = false
      attempt = 0
      void poll()
    },
    wake: () => {
      if (stopped) return
      cancelTimer()
      attempt = 0
      void poll()
    },
    stop: () => {
      stopped = true
      cancelTimer()
    },
  }
}
