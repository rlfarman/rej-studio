'use client'

import * as React from 'react'
import { useFormContext } from 'react-hook-form'
import { FormValues } from '../types/form-schema'
import { SpliceSliderContext } from './splice-slider-context'
import { detectSequenceType } from '@/lib/bio/sequence-type'
import { Input } from '@/components/ui/input'

export function DNASplicer() {
  const { setValue, watch } = useFormContext<FormValues>()
  const codingSequence = watch('codingSequence')
  const isProtein =
    codingSequence.length > 0 &&
    detectSequenceType(codingSequence) === 'protein'
  // For amino-acid input, the optimized DNA will be (residues × 3) long; use
  // that as the coordinate space for the splice position.
  const seqLength =
    (isProtein ? codingSequence.length * 3 : codingSequence.length) || 1

  const prevSeqLengthRef = React.useRef(seqLength)
  const prevPositionRef = React.useRef<number>(
    watch('spliceJunctionPosition') || Math.floor(seqLength / 2),
  )

  // When sequence length changes, maintain the relative position
  // (percentage) — but only between two real sequences. Transitions from
  // the empty/stub state (prevSeqLengthRef === 1 because seqLength fell
  // back to 1 for an empty textarea) would otherwise scale by a garbage
  // ratio and snap to the end; in that case just sync refs and let the
  // paste/upload handler's own default stand.
  React.useEffect(() => {
    if (seqLength === prevSeqLengthRef.current) return
    const prevLen = prevSeqLengthRef.current
    if (prevLen > 1 && seqLength > 1) {
      const ratio = prevPositionRef.current / prevLen
      const newPosition = Math.max(
        1,
        Math.min(Math.round(ratio * seqLength), seqLength - 1),
      )
      prevPositionRef.current = newPosition
      setValue('spliceJunctionPosition', newPosition)
    } else {
      prevPositionRef.current = watch('spliceJunctionPosition')
    }
    prevSeqLengthRef.current = seqLength
  }, [seqLength, setValue, watch])

  const position = watch('spliceJunctionPosition')

  const setPosition = (pos: number) => {
    const clamped = Math.max(1, Math.min(pos, seqLength - 1))
    prevPositionRef.current = clamped
    setValue('spliceJunctionPosition', clamped)
  }

  const hasSequence = codingSequence.length > 0

  if (!hasSequence) {
    return (
      <div className="flex h-24 items-center justify-center rounded-md border border-dashed">
        <p className="text-muted-foreground text-sm">
          Add a coding sequence above to configure the splice junction
        </p>
      </div>
    )
  }

  if (isProtein) {
    // Amino-acid input: the DNA doesn't exist yet, so WGGW / GC visualization
    // has nothing to show against. Fall back to a plain numeric input, in
    // bp coordinates of the DNA that will be produced by reverse-translation
    // (residues × 3). Snap to codon boundaries.
    const maxPos = seqLength - 1
    const handleChange = (raw: number) => {
      if (!Number.isFinite(raw)) return
      const snapped = Math.max(3, Math.round(raw / 3) * 3)
      setPosition(snapped)
    }
    return (
      <div className="space-y-2 rounded-md border border-dashed p-3">
        <p className="text-muted-foreground text-xs">
          Splice position is set in DNA coordinates (bp) of the reverse-
          translated sequence. Max {maxPos} bp.
        </p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={3}
            max={maxPos}
            step={3}
            value={position}
            onChange={(e) => handleChange(e.currentTarget.valueAsNumber)}
            className="w-32"
          />
          <span className="text-muted-foreground text-sm">
            / {maxPos.toLocaleString()} bp
          </span>
        </div>
      </div>
    )
  }

  return (
    <SpliceSliderContext
      sequence={codingSequence}
      position={position}
      onSnap={setPosition}
    />
  )
}
