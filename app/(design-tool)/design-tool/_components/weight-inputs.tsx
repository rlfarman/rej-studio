'use client'
import { useFormContext } from 'react-hook-form'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { FormValues } from './form-schema'

export function CodonOptimizeWeight() {
  const { control, watch } = useFormContext<FormValues>()
  const species = watch('species')

  return (
    <FormField
      name="codonOptimizeWeight"
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Adjust priority for codon optimization</FormLabel>
          <FormControl>
            <Input
              type="number"
              value={field.value}
              onChange={(e) => field.onChange(Number(e.target.value))}
              min={0}
              max={Number.MAX_SAFE_INTEGER}
              step={1}
              disabled={species === 'none'}
            />
          </FormControl>
          {species === 'none' && (
            <FormDescription>
              Please select a species to enable codon optimization.
            </FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export function RemoveCrypticSpliceSitesWeight() {
  const { control, watch } = useFormContext<FormValues>()
  const removeCrypticSpliceSites = watch('removeCrypticSpliceSites')

  return (
    <FormField
      name="removeCrypticSpliceSitesWeight"
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            Adjust priority for removing cryptic splice sites
          </FormLabel>
          <FormControl>
            <Input
              type="number"
              value={field.value}
              onChange={(e) => field.onChange(Number(e.target.value))}
              min={0}
              max={Number.MAX_SAFE_INTEGER}
              step={1}
              disabled={!removeCrypticSpliceSites}
            />
          </FormControl>
          {!removeCrypticSpliceSites && (
            <FormDescription>
              Enable "Remove cryptic splice sites" to customize this weight.
            </FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export function MinimizeCpGsWeight() {
  const { control, watch } = useFormContext<FormValues>()
  const minimizeCpgs = watch('minimizeCpgs')

  return (
    <FormField
      name="minimizeCpgsWeight"
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Adjust priority for minimizing CpG sites</FormLabel>
          <FormControl>
            <Input
              type="number"
              value={field.value}
              onChange={(e) => field.onChange(Number(e.target.value))}
              min={0}
              max={Number.MAX_SAFE_INTEGER}
              step={1}
              disabled={!minimizeCpgs}
            />
          </FormControl>
          {!minimizeCpgs && (
            <FormDescription>
              Enable "Minimize CpG sites" to customize this weight.
            </FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export function ReduceKmerComplexityWeight() {
  const { control, watch } = useFormContext<FormValues>()
  const reduceKmerComplexity = watch('reduceKmerComplexity')

  return (
    <FormField
      name="reduceKmerComplexityWeight"
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Adjust priority for reducing k-mer complexity</FormLabel>
          <FormControl>
            <Input
              type="number"
              value={field.value}
              onChange={(e) => field.onChange(Number(e.target.value))}
              min={0}
              max={Number.MAX_SAFE_INTEGER}
              step={1}
              disabled={!reduceKmerComplexity}
            />
          </FormControl>
          {!reduceKmerComplexity && (
            <FormDescription>
              Enable "Reduce k-mer complexity" to customize this weight.
            </FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
