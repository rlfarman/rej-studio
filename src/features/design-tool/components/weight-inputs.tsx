'use client'
import { useFormContext } from 'react-hook-form'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { FormValues } from '../types/form-schema'
import { designToolCopy } from '../copy'

const copy = designToolCopy.weights

interface WeightFieldProperties {
  name: keyof FormValues
  disabled: boolean
  inline?: boolean
}

function WeightField({
  name,
  disabled,
  inline = false,
}: WeightFieldProperties) {
  const { control } = useFormContext<FormValues>()

  return (
    <FormField
      name={name}
      control={control}
      render={({ field }) => {
        const numericValue = typeof field.value === 'number' ? field.value : 1

        return (
          <FormItem>
            <div
              className={
                inline ? 'flex items-center justify-end gap-2' : 'space-y-2'
              }
            >
              <FormLabel
                className={
                  disabled
                    ? 'text-muted-foreground text-xs font-medium'
                    : 'text-muted-foreground text-xs font-medium'
                }
              >
                {copy.label}
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  aria-label={copy.inputAria}
                  value={numericValue}
                  onChange={(e) => {
                    const next = e.target.value
                    field.onChange(next === '' ? 0 : Number(next))
                  }}
                  min={0}
                  max={100}
                  step={0.1}
                  disabled={disabled}
                  className="w-14 [appearance:textfield] text-center tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}

export function CodonOptimizeWeight({
  inline = false,
}: {
  inline?: boolean
} = {}) {
  const { watch } = useFormContext<FormValues>()
  const disabled = watch('species') === 'none'

  return (
    <WeightField
      name="codonOptimizeWeight"
      disabled={disabled}
      inline={inline}
    />
  )
}

export function RemoveCrypticSpliceSitesWeight() {
  const { watch } = useFormContext<FormValues>()
  const disabled = !watch('removeCrypticSpliceSites')

  return (
    <WeightField
      name="removeCrypticSpliceSitesWeight"
      disabled={disabled}
      inline
    />
  )
}

export function MinimizeCpGsWeight() {
  const { watch } = useFormContext<FormValues>()
  const disabled = !watch('minimizeCpgs')

  return <WeightField name="minimizeCpgsWeight" disabled={disabled} inline />
}

export function ReduceKmerComplexityWeight() {
  const { watch } = useFormContext<FormValues>()
  const disabled = !watch('reduceKmerComplexity')

  return (
    <WeightField name="reduceKmerComplexityWeight" disabled={disabled} inline />
  )
}
