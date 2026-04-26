'use client'

import * as React from 'react'
import { useFormContext } from 'react-hook-form'
import { FormValues, type SelectedWggwSite } from '../types/form-schema'
import { SpliceSliderContext } from './splice-slider-context'

export function DNASplicer() {
  const { setValue, watch } = useFormContext<FormValues>()
  const codingSequence = watch('codingSequence') ?? ''
  const seqLength = codingSequence.length || 1

  const positions = watch('spliceJunctionPositions') ?? []

  const prevSeqLengthRef = React.useRef(seqLength)
  const prevPositionsRef = React.useRef<number[]>(
    positions.length > 0 ? positions : [Math.floor(seqLength / 2)],
  )

  // When sequence length changes, maintain the relative position
  // (percentage) per splice — but only between two real sequences.
  // Transitions from the empty/stub state would otherwise scale by
  // a garbage ratio; in that case just sync refs.
  React.useEffect(() => {
    if (seqLength === prevSeqLengthRef.current) return
    const prevLen = prevSeqLengthRef.current
    if (prevLen > 1 && seqLength > 1) {
      const next = prevPositionsRef.current.map((p) =>
        Math.max(
          1,
          Math.min(Math.round((p / prevLen) * seqLength), seqLength - 1),
        ),
      )
      prevPositionsRef.current = next
      setValue('spliceJunctionPositions', next)
      setValue(
        'selectedWggwSites',
        next.map(() => null),
      )
    } else {
      prevPositionsRef.current = positions.length
        ? positions
        : [Math.floor(seqLength / 2)]
      setValue(
        'selectedWggwSites',
        prevPositionsRef.current.map(() => null),
      )
    }
    prevSeqLengthRef.current = seqLength
  }, [positions, seqLength, setValue])

  const setPositions = React.useCallback(
    (next: number[]) => {
      const clamped = next.map((p) => Math.max(1, Math.min(p, seqLength - 1)))
      prevPositionsRef.current = clamped
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
      <p className="text-muted-foreground rounded-md border border-dashed px-3 py-2 text-xs">
        Add a coding sequence above to configure the split point.
      </p>
    )
  }

  return (
    <SpliceSliderContext
      sequence={codingSequence}
      positions={positions.length ? positions : [Math.floor(seqLength / 2)]}
      onPositionsChange={setPositions}
      onSelectionChange={setSelectedSites}
    />
  )
}
