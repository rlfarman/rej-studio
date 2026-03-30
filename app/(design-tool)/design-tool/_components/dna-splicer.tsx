'use client'

import * as React from 'react'
import { useFormContext } from 'react-hook-form'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import {
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormField,
} from '@/components/ui/form'
import { FormValues } from './form-schema'

export function DNASplicer() {
  const { control, setValue, watch } = useFormContext<FormValues>()
  const codingSequence = watch('codingSequence')
  const seqLength = codingSequence.length || 1

  const prevSeqLengthRef = React.useRef(seqLength)
  const prevPositionRef = React.useRef<number>(
    watch('spliceJunctionPosition') || Math.floor(seqLength / 2),
  )

  // When sequence length changes, maintain the relative position (percentage)
  if (seqLength !== prevSeqLengthRef.current) {
    const ratio = prevPositionRef.current / (prevSeqLengthRef.current || 1)
    const newPosition = Math.max(1, Math.min(Math.floor(ratio * seqLength), seqLength - 1))
    prevSeqLengthRef.current = seqLength
    prevPositionRef.current = newPosition
    setValue('spliceJunctionPosition', newPosition)
  }

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

  const handlePercentageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const pct = Math.min(Math.max(Number(event.target.value), 0), 100)
    setPosition(Math.floor((pct / 100) * seqLength))
  }

  const tickCount = 5
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const frac = i / tickCount
    return Math.floor(frac * seqLength)
  })

  const hasSequence = codingSequence.length > 0

  if (!hasSequence) {
    return (
      <div className="flex h-24 items-center justify-center rounded-md border border-dashed">
        <p className="text-muted-foreground text-sm">
          Enter a coding sequence to configure the splice junction
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Sequence visualization bar */}
      <div className="space-y-1.5">
        <div className="flex h-8 w-full overflow-hidden rounded-md border">
          <div
            className="bg-primary/15 border-primary flex items-center justify-center border-r-2 transition-all duration-150"
            style={{ width: `${percentage}%` }}
          >
            {percentage > 15 && (
              <span className="text-primary text-xs font-medium">
                5&apos; &middot; {fivePrimeLength.toLocaleString()} bp
              </span>
            )}
          </div>
          <div className="bg-muted/50 flex flex-1 items-center justify-center transition-all duration-150">
            {percentage < 85 && (
              <span className="text-muted-foreground text-xs font-medium">
                3&apos; &middot; {threePrimeLength.toLocaleString()} bp
              </span>
            )}
          </div>
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
          {ticks.map((val, i) => (
            <span
              key={i}
              className="text-muted-foreground absolute text-[10px] tabular-nums"
              style={{
                left: `${(i / tickCount) * 100}%`,
                transform:
                  i === 0
                    ? 'none'
                    : i === tickCount
                      ? 'translateX(-100%)'
                      : 'translateX(-50%)',
              }}
            >
              {val.toLocaleString()}
            </span>
          ))}
        </div>
      </div>

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
              <FormMessage />
            </FormItem>
          )}
        />
        <FormItem className="flex-1">
          <FormLabel>Percentage</FormLabel>
          <FormControl>
            <div className="relative">
              <Input
                type="number"
                value={parseFloat(percentage.toFixed(1))}
                onChange={handlePercentageChange}
                min={0}
                max={100}
                step={0.1}
                className="pr-7"
              />
              <span className="text-muted-foreground pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                %
              </span>
            </div>
          </FormControl>
        </FormItem>
      </div>
    </div>
  )
}
