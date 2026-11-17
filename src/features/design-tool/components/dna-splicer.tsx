'use client'

import * as React from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { FormValues, type SelectedWggwSite } from '../types/form-schema'
import { SpliceSliderContext } from './splice-slider-context'

// Stable fallback so an unset field doesn't hand the effect below a new
// array (and so a changed dependency) on every render.
const NO_POSITIONS: number[] = []

function toFractions(positions: number[], length: number): number[] {
  return positions.map((p) => p / length)
}

/** Split points at these fractions of `length`, each inside 1..length-1. */
function fromFractions(fractions: number[], length: number): number[] {
  return fractions.map((f) =>
    Math.max(1, Math.min(Math.round(f * length), length - 1)),
  )
}

function samePositions(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((p, i) => p === b[i])
}

export function DNASplicer() {
  const { control, setValue } = useFormContext<FormValues>()
  const [watchedSequence, watchedPositions, species] = useWatch({
    control,
    name: ['codingSequence', 'spliceJunctionPositions', 'species'],
  })
  const codingSequence = watchedSequence ?? ''
  const seqLength = codingSequence.length || 1

  const positions = watchedPositions ?? NO_POSITIONS

  // What the split points were last reconciled against. `fractions` are the
  // split points as exact fractions of the length; rescaling from them, not
  // from the previous rounded positions, is what keeps a split where it was
  // while a sequence is typed (rounding and clamping each step walked it to
  // the last base).
  const lastRef = React.useRef({
    length: seqLength,
    positions,
    fractions: toFractions(positions, seqLength),
  })

  React.useEffect(() => {
    const last = lastRef.current
    const positionsChanged = !samePositions(positions, last.positions)
    if (seqLength === last.length) {
      // A split moved without the sequence changing (drag, snap, clamp).
      if (positionsChanged) {
        lastRef.current = {
          length: seqLength,
          positions,
          fractions: toFractions(positions, seqLength),
        }
      }
      return
    }

    let next: number[]
    let fractions: number[]
    if (positionsChanged) {
      // Split points set together with the sequence: a paste or FASTA upload
      // (which picks defaults for the new sequence), a draft restore, a
      // reverse translation. They are meant for this sequence; keep them.
      next = positions
      fractions = toFractions(positions, seqLength)
    } else if (last.length <= 1 || seqLength <= 1) {
      // Typed from empty, or cleared: the stored points are the empty form's
      // placeholder, not a choice. Start from even splits.
      fractions = positions.map((_, i) => (i + 1) / (positions.length + 1))
      next = fromFractions(fractions, seqLength)
    } else {
      // Typing or deleting: each split keeps its relative place.
      fractions = last.fractions
      next = fromFractions(fractions, seqLength)
    }

    lastRef.current = { length: seqLength, positions: next, fractions }
    if (!samePositions(next, positions)) {
      setValue('spliceJunctionPositions', next)
    }
    setValue(
      'selectedWggwSites',
      next.map(() => null),
    )
  }, [positions, seqLength, setValue])

  const setPositions = React.useCallback(
    (next: number[]) => {
      const clamped = next.map((p) => Math.max(1, Math.min(p, seqLength - 1)))
      setValue('spliceJunctionPositions', clamped)
    },
    [seqLength, setValue],
  )

  const setSelectedSites = React.useCallback(
    (sites: (SelectedWggwSite | null)[]) => {
      setValue('selectedWggwSites', sites)
    },
    [setValue],
  )

  const hasSequence = codingSequence.length > 0

  if (!hasSequence) {
    return (
      <p className="rounded-xl border border-dashed px-3 py-2 text-xs text-muted-foreground">
        Add a coding sequence above to configure the split point.
      </p>
    )
  }

  return (
    <SpliceSliderContext
      sequence={codingSequence}
      positions={positions.length ? positions : [Math.floor(seqLength / 2)]}
      species={species ?? 'none'}
      onPositionsChange={setPositions}
      onSelectionChange={setSelectedSites}
    />
  )
}
