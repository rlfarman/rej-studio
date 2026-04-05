'use client'

import * as React from 'react'
import { useFormContext } from 'react-hook-form'
import { FormValues } from '../types/form-schema'
import { SpliceSliderContext } from './splice-slider-context'

export function DNASplicer() {
  const { setValue, watch } = useFormContext<FormValues>()
  const codingSequence = watch('codingSequence')
  const seqLength = codingSequence.length || 1

  const prevSeqLengthRef = React.useRef(seqLength)
  const prevPositionRef = React.useRef<number>(
    watch('spliceJunctionPosition') || Math.floor(seqLength / 2),
  )

  // When sequence length changes, maintain the relative position (percentage)
  React.useEffect(() => {
    if (seqLength !== prevSeqLengthRef.current) {
      const ratio = prevPositionRef.current / (prevSeqLengthRef.current || 1)
      const newPosition = Math.max(
        1,
        Math.min(Math.round(ratio * seqLength), seqLength - 1),
      )
      prevSeqLengthRef.current = seqLength
      prevPositionRef.current = newPosition
      setValue('spliceJunctionPosition', newPosition)
    }
  }, [seqLength, setValue])

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

  return (
    <SpliceSliderContext
      sequence={codingSequence}
      position={position}
      onSnap={setPosition}
    />
  )
}
