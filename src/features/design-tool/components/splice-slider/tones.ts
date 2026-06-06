// Splice tone palettes. Splice 1 uses primary, Splice 2 uses marker; the
// fields cover the surfaces each splice paints (caret, cuts, base
// highlights, segment fills, ring colors, tinted text).
export const SPLICE_TONES: Array<{
  caret: string
  caretRing: string
  border: string
  hoverBorder: string
  tickBg: string
  baseBg: string
  baseText: string
  fillSeg: string
  text: string
}> = [
  {
    caret: 'bg-primary',
    caretRing: 'ring-primary/40',
    border: 'border-primary',
    hoverBorder: 'hover:border-primary/40',
    tickBg: 'bg-primary',
    baseBg: 'bg-primary/15',
    baseText: 'text-primary',
    fillSeg: 'bg-primary/15',
    text: 'text-primary',
  },
  {
    caret: 'bg-marker',
    caretRing: 'ring-marker/40',
    border: 'border-marker',
    hoverBorder: 'hover:border-marker/40',
    tickBg: 'bg-marker',
    baseBg: 'bg-marker/15',
    baseText: 'text-marker',
    fillSeg: 'bg-marker/15',
    text: 'text-marker',
  },
]

export function spliceTone(index: number) {
  return SPLICE_TONES[index] ?? SPLICE_TONES[0]
}

// Cost tone for individual WGGW sites and rewrite chips. Base-change count is
// useful text, but candidates share the same marker tone so native/non-native
// status is not visually privileged.
export interface CostTone {
  tickBg: string
  text: string
  badgeBg: string
  badgeBorder: string
}

export function costToneFor(_baseChanges: number): CostTone {
  return {
    tickBg: 'bg-marker',
    text: 'text-foreground',
    badgeBg: 'bg-muted/40',
    badgeBorder: 'border-border/60',
  }
}
