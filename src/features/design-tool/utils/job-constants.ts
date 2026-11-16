/** Shared timing and target constants for the design tool. */

/**
 * How long the client keeps polling a job before giving up.
 *
 * The Modal worker's own timeout is 600s (`modal/app.py`), and a run also
 * costs submit latency plus a possible container cold start. Matching 600s
 * exactly made the client declare a timeout at the same moment a slow-but-
 * healthy job was finishing, so this carries ~1 minute of headroom.
 */
export const POLL_DEADLINE_MS = 11 * 60 * 1000

/**
 * GC band the optimizer actually enforces: `EnforceGCContent(mini=0.35,
 * maxi=0.60)` in `python/algorithm.py`. Charts, metric colouring and the
 * objective label all read these so they can't disagree with the solver.
 */
export const GC_TARGET_MIN_PERCENT = 35
export const GC_TARGET_MAX_PERCENT = 60
