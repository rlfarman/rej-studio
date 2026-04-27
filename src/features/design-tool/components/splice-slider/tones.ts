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

// Cost tone for individual WGGW sites and rewrite chips. The tool can't
// actually judge "1 bp vs 2 bp" as better/worse — that's a soft
// preference, not a correctness constraint. Native sites are
// qualitatively different (zero modification needed, no optimizer
// constraints introduced) so they get a positive accent; everything
// else is neutral and labels the bp-change count for the user to weigh.
export interface CostTone {
  tickBg: string
  text: string
  badgeBg: string
  badgeBorder: string
}

export function costToneFor(baseChanges: number): CostTone {
  if (baseChanges === 0) {
    return {
      tickBg: 'bg-success',
      text: 'text-success-soft',
      badgeBg: 'bg-success/10',
      badgeBorder: 'border-success/25',
    }
  }
  return {
    tickBg: 'bg-marker',
    text: 'text-foreground',
    badgeBg: 'bg-muted/40',
    badgeBorder: 'border-border/60',
  }
}
