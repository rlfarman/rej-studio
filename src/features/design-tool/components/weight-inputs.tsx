'use client'
import { useFormContext, useWatch } from 'react-hook-form'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { FormValues } from '../types/form-schema'
import { designToolCopy } from '../copy'

const copy = designToolCopy.weights
const objectiveCopy = designToolCopy.optimizationOptions

type WeightName =
  | 'codonOptimizeWeight'
  | 'removeCrypticSpliceSitesWeight'
  | 'minimizeCpgsWeight'
  | 'reduceKmerComplexityWeight'

function WeightField({
  name,
  label,
  enabled,
}: {
  name: WeightName
  label: string
  enabled: boolean
}) {
  const { control } = useFormContext<FormValues>()

  return (
    <FormField
      name={name}
      control={control}
      render={({ field }) => (
        <FormItem className="gap-1 py-2">
          <div className="flex items-center justify-between gap-3">
            <FormLabel
              className={cn(
                'text-sm font-normal',
                !enabled && 'text-muted-foreground',
              )}
            >
              {label}
              {enabled ? null : (
                <span className="text-muted-foreground text-xs">
                  {copy.off}
                </span>
              )}
            </FormLabel>
            <FormControl>
              <Input
                type="number"
                value={typeof field.value === 'number' ? field.value : 1}
                onChange={(e) => {
                  const next = e.target.value
                  field.onChange(next === '' ? 0 : Number(next))
                }}
                min={0}
                max={100}
                step={0.1}
                disabled={!enabled}
                className="w-16 [appearance:textfield] text-center tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </FormControl>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

/**
 * Relative weights for the weighted objectives, listed under the "Advanced"
 * toggle that reveals them. They used to sit inline at the end of each
 * objective row, so opening the toggle (at the bottom of the section) made
 * inputs appear above it.
 */
export function ObjectiveWeights({ id }: { id: string }) {
  const { control } = useFormContext<FormValues>()
  const [species, removeCrypticSpliceSites, minimizeCpgs, reduceKmer] =
    useWatch({
      control,
      name: [
        'species',
        'removeCrypticSpliceSites',
        'minimizeCpgs',
        'reduceKmerComplexity',
      ],
    })

  return (
    <div id={id} className="mt-2 max-w-md">
      <p className="text-muted-foreground text-xs leading-relaxed">
        {copy.hint}
      </p>
      <div className="divide-border/60 mt-1 flex flex-col divide-y">
        <WeightField
          name="codonOptimizeWeight"
          label={objectiveCopy.codonOptimize.label}
          enabled={species !== 'none'}
        />
        <WeightField
          name="removeCrypticSpliceSitesWeight"
          label={objectiveCopy.removeCrypticSpliceSites.label}
          enabled={removeCrypticSpliceSites}
        />
        <WeightField
          name="minimizeCpgsWeight"
          label={objectiveCopy.minimizeCpGs.label}
          enabled={minimizeCpgs}
        />
        <WeightField
          name="reduceKmerComplexityWeight"
          label={objectiveCopy.reduceKmer.label}
          enabled={reduceKmer}
        />
      </div>
    </div>
  )
}
