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
          <FormLabel>Codon optimization weight</FormLabel>
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
              Select a species above to enable codon optimization.
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
          <FormLabel>Cryptic splice site removal weight</FormLabel>
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
              Enable cryptic splice site removal above to set this weight.
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
          <FormLabel>CpG minimization weight</FormLabel>
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
              Enable CpG minimization above to set this weight.
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
          <FormLabel>k-mer complexity reduction weight</FormLabel>
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
              Enable k-mer complexity reduction above to set this weight.
            </FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
