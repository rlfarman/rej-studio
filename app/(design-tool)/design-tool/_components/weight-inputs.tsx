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
  const { control, watch, setValue } = useFormContext<FormValues>()
  const species = watch('species')
  const disabled = species === 'none'

  return (
    <FormField
      name="codonOptimizeWeight"
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel className={disabled ? 'text-muted-foreground' : undefined}>
            Adjust priority for codon optimization
          </FormLabel>
          <FormControl>
            <Input
              type="number"
              value={field.value}
              onChange={(e) => field.onChange(Number(e.target.value))}
              min={0}
              max={100}
              step={1}
              disabled={disabled}
            />
          </FormControl>
          {disabled && (
            <FormDescription>
              <button
                type="button"
                className="text-primary underline-offset-2 hover:underline"
                onClick={() => setValue('species', 'human')}
              >
                Select a species
              </button>{' '}
              to enable codon optimization.
            </FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export function RemoveCrypticSpliceSitesWeight() {
  const { control, watch, setValue } = useFormContext<FormValues>()
  const removeCrypticSpliceSites = watch('removeCrypticSpliceSites')
  const disabled = !removeCrypticSpliceSites

  return (
    <FormField
      name="removeCrypticSpliceSitesWeight"
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel className={disabled ? 'text-muted-foreground' : undefined}>
            Adjust priority for removing cryptic splice sites
          </FormLabel>
          <FormControl>
            <Input
              type="number"
              value={field.value}
              onChange={(e) => field.onChange(Number(e.target.value))}
              min={0}
              max={100}
              step={1}
              disabled={disabled}
            />
          </FormControl>
          {disabled && (
            <FormDescription>
              <button
                type="button"
                className="text-primary underline-offset-2 hover:underline"
                onClick={() => setValue('removeCrypticSpliceSites', true)}
              >
                Enable &ldquo;Remove cryptic splice sites&rdquo;
              </button>{' '}
              to customize this weight.
            </FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export function MinimizeCpGsWeight() {
  const { control, watch, setValue } = useFormContext<FormValues>()
  const minimizeCpgs = watch('minimizeCpgs')
  const disabled = !minimizeCpgs

  return (
    <FormField
      name="minimizeCpgsWeight"
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel className={disabled ? 'text-muted-foreground' : undefined}>
            Adjust priority for minimizing CpG sites
          </FormLabel>
          <FormControl>
            <Input
              type="number"
              value={field.value}
              onChange={(e) => field.onChange(Number(e.target.value))}
              min={0}
              max={100}
              step={1}
              disabled={disabled}
            />
          </FormControl>
          {disabled && (
            <FormDescription>
              <button
                type="button"
                className="text-primary underline-offset-2 hover:underline"
                onClick={() => setValue('minimizeCpgs', true)}
              >
                Enable &ldquo;Minimize CpG sites&rdquo;
              </button>{' '}
              to customize this weight.
            </FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export function ReduceKmerComplexityWeight() {
  const { control, watch, setValue } = useFormContext<FormValues>()
  const reduceKmerComplexity = watch('reduceKmerComplexity')
  const disabled = !reduceKmerComplexity

  return (
    <FormField
      name="reduceKmerComplexityWeight"
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel className={disabled ? 'text-muted-foreground' : undefined}>
            Adjust priority for reducing k-mer complexity
          </FormLabel>
          <FormControl>
            <Input
              type="number"
              value={field.value}
              onChange={(e) => field.onChange(Number(e.target.value))}
              min={0}
              max={100}
              step={1}
              disabled={disabled}
            />
          </FormControl>
          {disabled && (
            <FormDescription>
              <button
                type="button"
                className="text-primary underline-offset-2 hover:underline"
                onClick={() => setValue('reduceKmerComplexity', true)}
              >
                Enable &ldquo;Reduce k-mer complexity&rdquo;
              </button>{' '}
              to customize this weight.
            </FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
