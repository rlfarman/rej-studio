'use client'

import * as React from 'react'
import { useFormContext } from 'react-hook-form'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import {
  FormItem,
  FormLabel,
  FormControl,
  FormAssistiveText,
  FormField,
} from '@/components/ui/form'
import { FormValues } from '../types/form-schema'
import { SpliceSliderContext } from './splice-slider-context'

export function DNASplicer() {
  const { control, setValue, watch } = useFormContext<FormValues>()
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
  const percentage = seqLength > 1 ? (position / seqLength) * 100 : 0
  const fivePrimeLength = position
  const threePrimeLength = seqLength - position

  const setPosition = (pos: number) => {
    const clamped = Math.max(1, Math.min(pos, seqLength - 1))
    prevPositionRef.current = clamped
    setValue('spliceJunctionPosition', clamped)
  }

  const handleSliderChange = (value: number[]) => {
    setPosition(Math.floor(value[0]))
  }

  const handlePositionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPosition(Number(event.target.value))
  }

  const handlePercentageChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const pct = Math.min(Math.max(Number(event.target.value), 0), 100)
    setPosition(Math.round((pct / 100) * seqLength))
  }

  const tickCount = 5
  const allTicks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const frac = i / tickCount
    return { value: Math.floor(frac * seqLength), frac }
  })
  // Deduplicate ticks that map to the same value (happens with short sequences)
  const ticks = allTicks.filter(
    (tick, i, arr) => i === 0 || tick.value !== arr[i - 1].value,
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
    <div className="space-y-5">
      {/* Sequence visualization bar */}
      <div className="flex h-8 w-full overflow-hidden rounded-md border">
        <div
          className="bg-primary/15 border-primary flex min-w-0 items-center justify-center border-r-2 transition-all duration-150"
          style={{ width: `${percentage}%` }}
        >
          <span className="text-primary truncate px-1.5 text-xs font-medium">
            5&apos; &middot; {fivePrimeLength.toLocaleString()} bp
          </span>
        </div>
        <div className="bg-muted/50 flex min-w-0 flex-1 items-center justify-center transition-all duration-150">
          <span className="text-muted-foreground truncate px-1.5 text-xs font-medium">
            3&apos; &middot; {threePrimeLength.toLocaleString()} bp
          </span>
        </div>
      </div>

      {/* Slider with tick marks */}
      <div className="space-y-1">
        <FormField
          name="spliceJunctionPosition"
          control={control}
          render={({ field }) => (
            <Slider
              value={[field.value]}
              max={seqLength - 1}
              min={1}
              step={1}
              onValueChange={(value) => {
                field.onChange(value[0])
                handleSliderChange(value)
              }}
            />
          )}
        />
        <div className="relative h-4 w-full">
          {ticks.map((tick, i) => (
            <span
              key={tick.value}
              className="text-muted-foreground absolute text-[10px] tabular-nums"
              style={{
                left: `${tick.frac * 100}%`,
                transform:
                  i === 0
                    ? 'none'
                    : i === ticks.length - 1
                      ? 'translateX(-100%)'
                      : 'translateX(-50%)',
              }}
            >
              {tick.value.toLocaleString()}
            </span>
          ))}
        </div>
      </div>

      {/* Split context: GC profile, WGGW candidates, frame-at-split */}
      <SpliceSliderContext
        sequence={codingSequence}
        position={position}
        onSnap={setPosition}
      />

      {/* Inputs row */}
      <div className="flex gap-4">
        <FormField
          name="spliceJunctionPosition"
          control={control}
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>Position (bp)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  value={field.value}
                  onChange={(e) => {
                    field.onChange(e)
                    handlePositionChange(e)
                  }}
                  min={1}
                  max={seqLength - 1}
                />
              </FormControl>
              <FormAssistiveText reserveSpace />
            </FormItem>
          )}
        />
        <FormItem className="flex-1">
          <FormLabel>Percentage</FormLabel>
          <FormControl>
            <div className="relative">
              <Input
                type="number"
                value={Math.round(percentage * 10) / 10}
                onChange={handlePercentageChange}
                min={0}
                max={100}
                step={0.1}
                className="pr-7"
              />
              <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm">
                %
              </span>
            </div>
          </FormControl>
          <FormAssistiveText reserveSpace />
        </FormItem>
      </div>
    </div>
  )
}
