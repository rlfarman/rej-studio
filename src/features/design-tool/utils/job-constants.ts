/** Shared target constants for the design tool. */

/**
 * GC band the optimizer actually enforces: `GC_MIN`/`GC_MAX` (0.35–0.60)
 * in `rust/optimizer/src/lib.rs`. Charts, metric colouring and the
 * objective label all read these so they can't disagree with the solver.
 */
export const GC_TARGET_MIN_PERCENT = 35
export const GC_TARGET_MAX_PERCENT = 60
