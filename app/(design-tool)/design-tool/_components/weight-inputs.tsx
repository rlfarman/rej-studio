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

const WEIGHT_HELP =
  '1 = gentle nudge, 10 = strong preference, 50+ = aggressively prioritize over other objectives.'

function WeightDescription({ text }: { text: string }) {
  return (
    <FormDescription>
      <span className="text-muted-foreground block">{text}</span>
      <span className="text-muted-foreground/70 block text-[11px]">
        {WEIGHT_HELP}
      </span>
    </FormDescription>
  )
}

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
            Codon optimization weight
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
          {disabled ? (
            <FormDescription>
              <button
                type="button"
                className="text-primary underline-offset-2 hover:underline"
                onClick={() => setValue('species', 'human')}
              >
                Select a species
              </button>{' '}
              above to enable codon optimization.
            </FormDescription>
          ) : (
            <WeightDescription text="How strongly to prefer codons favored by the target species." />
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
            Cryptic splice site removal weight
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
          {disabled ? (
            <FormDescription>
              <button
                type="button"
                className="text-primary underline-offset-2 hover:underline"
                onClick={() => setValue('removeCrypticSpliceSites', true)}
              >
                Enable cryptic splice site removal
              </button>{' '}
              above to set this weight.
            </FormDescription>
          ) : (
            <WeightDescription text="How aggressively to eliminate splice-like motifs. Higher values remove more sites but constrain codon choice." />
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
            CpG minimization weight
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
          {disabled ? (
            <FormDescription>
              <button
                type="button"
                className="text-primary underline-offset-2 hover:underline"
                onClick={() => setValue('minimizeCpgs', true)}
              >
                Enable CpG minimization
              </button>{' '}
              above to set this weight.
            </FormDescription>
          ) : (
            <WeightDescription text="How strongly to avoid CpG dinucleotides. High values greatly reduce CpGs but may lower GC content." />
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
            k-mer complexity reduction weight
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
          {disabled ? (
            <FormDescription>
              <button
                type="button"
                className="text-primary underline-offset-2 hover:underline"
                onClick={() => setValue('reduceKmerComplexity', true)}
              >
                Enable k-mer complexity reduction
              </button>{' '}
              above to set this weight.
            </FormDescription>
          ) : (
            <WeightDescription text="How strongly to diversify 10-mer repeats. Helps synthesis and reduces recombination risk." />
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
