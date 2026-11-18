// Minimum sequence length before the slider renders. Shorter than this
// can't have a meaningful splice junction (cut + buffer on both sides).
export const MIN_SEQUENCE_LENGTH = 12

// Tick-click hit-detection: parent-routed click on the WGGW strip picks
// the nearest site within this many pixels of the click. Much larger than
// the visible tick width (~4px) because the ticks are the primary way to
// choose a split point and were hard to hit, especially by touch; still
// small enough that a click far from any tick does nothing.
export const TICK_CLICK_THRESHOLD_PX = 22

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

// Keyboard stepping on the split-point slider: an arrow moves one base,
// with Shift a larger nudge, and PageUp/PageDown a twentieth of the
// sequence but never less than this.
export const KEYBOARD_SHIFT_STEP_BP = 10
export const KEYBOARD_PAGE_MIN_BP = 10
