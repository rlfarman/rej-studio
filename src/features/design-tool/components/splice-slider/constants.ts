// AAV packaging threshold: each fragment must fit in a single AAV (~<4 kb
// is the safe upper bound for the typical AAV cassette). When a fragment
// exceeds this, the chosen split won't actually package — flag it.
export const AAV_MAX_BP = 4000

// Minimum sequence length before the slider renders. Shorter than this
// can't have a meaningful splice junction (cut + buffer on both sides).
export const MIN_SEQUENCE_LENGTH = 12

// Tick-click hit-detection: parent-routed click on the WGGW strip picks
// the nearest site within this many pixels of the click. Larger than the
// visible tick width (~4px) so the hit area feels generous; small enough
// that adjacent ticks don't both qualify.
export const TICK_CLICK_THRESHOLD_PX = 14

// When the cursor moves by more than this many bp between renders, treat
// it as a "jump" (active-splice switch, midpoint, GoTo, etc.) and smooth-
// scroll the strip. Smaller deltas are presumed to come from a drag and
// scroll instantly so the strip stays glued to the cursor.
export const STRIP_SMOOTH_SCROLL_THRESHOLD_BP = 30

// Cosmetic timing: how long the assigned splice's bp readout pulses after
// a tick-click, and the toast cooldown / duration for auto-swap.
export const RECENTLY_ASSIGNED_DURATION_MS = 700
export const SWAP_TOAST_THROTTLE_MS = 1500
export const SWAP_TOAST_DURATION_MS = 2000
