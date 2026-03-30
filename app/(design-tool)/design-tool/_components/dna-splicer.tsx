'use client'

import * as React from 'react'
import { useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { Slider } from '@/components/ui/slider'
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
  const spliceJunctionPosition = watch('spliceJunctionPosition')
  const [percentage, setPercentage] = useState(50)

  const prevSeqLengthRef = React.useRef(codingSequence.length || 1)
  const seqLength = codingSequence.length || 1

  // Only recalculate position when sequence length changes (not on every percentage change)
  if (seqLength !== prevSeqLengthRef.current) {
    prevSeqLengthRef.current = seqLength
    setValue(
      'spliceJunctionPosition',
      Math.floor((Number(percentage) / 100) * seqLength),
    )
  }

  const handleSliderChange = (value: number[]) => {
    const newPosition = Math.floor(value[0])
    setValue('spliceJunctionPosition', newPosition)
    setPercentage(parseFloat(((newPosition / seqLength) * 100).toFixed(1)))
  }

  const handlePositionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newPosition = Math.min(
      Math.max(Number(event.target.value), 1),
      seqLength - 1,
    )
    setValue('spliceJunctionPosition', newPosition)
    setPercentage(parseFloat(((newPosition / seqLength) * 100).toFixed(1)))
  }

  const handlePercentageChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const newPercentage = Math.min(Math.max(Number(event.target.value), 0), 100)
    const newPosition = Math.floor((newPercentage / 100) * seqLength)
    setValue('spliceJunctionPosition', newPosition)
    setPercentage(parseFloat(newPercentage.toFixed(1)))
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <FormField
          name="spliceJunctionPosition"
          control={control}
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="splice-junction-position">Position</FormLabel>
              <FormControl>
                <span>
                  <input
                    id="splice-junction-position"
                    type="number"
                    value={field.value}
                    onChange={(e) => {
                      field.onChange(e)
                      handlePositionChange(e)
                    }}
                    className="border-input bg-transparent text-2xl font-bold outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] rounded-md border px-2 py-1"
                    style={{ width: `${String(field.value).length + 1.5}ch` }}
                    min={1}
                    max={seqLength - 1}
                  />
                  <span className="text-muted-foreground ml-1 text-sm font-normal">
                    base pairs
                  </span>
                </span>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormItem>
          <FormLabel>Percentage</FormLabel>
          <FormControl>
            <span>
              <input
                type="number"
                value={percentage}
                onChange={handlePercentageChange}
                className="border-input bg-transparent text-2xl font-bold outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] rounded-md border px-2 py-1"
                style={{ width: `${String(percentage).length + 1.5}ch` }}
                min={0}
                max={100}
                step={0.1}
              />
              <span className="text-muted-foreground ml-1 text-sm font-normal">
                %
              </span>
            </span>
          </FormControl>
        </FormItem>
      </div>
      <div className="space-y-4">
        <div className="px-3">
          <FormField
            name="spliceJunctionPosition"
            control={control}
            render={({ field }) => (
              <Slider
                value={[field.value]}
                max={seqLength}
                step={1}
                onValueChange={(value) => {
                  field.onChange(value[0])
                  handleSliderChange(value)
                }}
                className="my-4"
                min={1}
              />
            )}
          />
        </div>
        <div className="relative w-full">
          <div className="absolute inset-x-0 inset-y-0 flex">
            {Array.from({ length: 51 }).map((_, i) => (
              <div
                key={i}
                className="flex h-full flex-1 items-center justify-center"
              >
                {i % 10 === 0 && (
                  <span className="text-muted-foreground absolute text-xs">
                    {Math.floor((i / 50) * seqLength)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
