'use client'

import * as React from 'react'
import { useFormContext } from 'react-hook-form'
import { FormValues, type SelectedWggwSite } from '../types/form-schema'
import { SpliceSliderContext } from './splice-slider-context'

export function DNASplicer() {
  const { setValue, watch } = useFormContext<FormValues>()
  const codingSequence = watch('codingSequence')
  const seqLength = codingSequence.length || 1

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
      setValue('selectedWggwSite', null)
    } else {
      prevPositionRef.current = watch('spliceJunctionPosition')
      setValue('selectedWggwSite', null)
    }
    prevSeqLengthRef.current = seqLength
  }, [seqLength, setValue, watch])

  const position = watch('spliceJunctionPosition')

  const setPosition = (pos: number) => {
    const clamped = Math.max(1, Math.min(pos, seqLength - 1))
    prevPositionRef.current = clamped
    setValue('spliceJunctionPosition', clamped)
    setValue('selectedWggwSite', null)
  }

  const setSelectedSite = React.useCallback(
    (site: SelectedWggwSite | null) => {
      setValue('selectedWggwSite', site)
    },
    [setValue],
  )

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

  return (
    <SpliceSliderContext
      sequence={codingSequence}
      position={position}
      onSnap={setPosition}
      onSelectionChange={setSelectedSite}
    />
  )
}
