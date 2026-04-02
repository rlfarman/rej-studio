'use client'
import { useFormContext, Controller } from 'react-hook-form'
import {
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
} from '@/components/ui/form'
import { Checkbox } from '@/components/ui/checkbox'
import { FormValues } from './form-schema'

export function CodonOptimizationOptions() {
  const { control } = useFormContext<FormValues>()
  return (
    <div className="flex flex-col space-y-4">
      <Controller
        name="removeCrypticSpliceSites"
        control={control}
        render={({ field }) => (
          <FormItem className="flex flex-row items-start space-y-0 space-x-3">
            <FormControl>
              <Checkbox
                id="removeCrypticSpliceSites"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <div>
              <FormLabel>Remove cryptic splice sites</FormLabel>
              <FormDescription>
                Prevents unintended mRNA splicing in mammalian cells by
                eliminating sequences resembling splice donor and acceptor
                motifs.
              </FormDescription>
            </div>
          </FormItem>
        )}
      />
      <Controller
        name="minimizeCpgs"
        control={control}
        render={({ field }) => (
          <FormItem className="flex flex-row items-start space-y-0 space-x-3">
            <FormControl>
              <Checkbox
                id="minimizeCpgs"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <div>
              <FormLabel>Minimize CpG sites</FormLabel>
              <FormDescription>
                Reduces silencing risk from DNA methylation by minimizing CpG
                dinucleotides.
              </FormDescription>
            </div>
          </FormItem>
        )}
      />
      <Controller
        name="reduceKmerComplexity"
        control={control}
        render={({ field }) => (
          <FormItem className="flex flex-row items-start space-y-0 space-x-3">
            <FormControl>
              <Checkbox
                id="reduceKmerComplexity"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <div>
              <FormLabel>Reduce k-mer complexity</FormLabel>
              <FormDescription>
                Reduces synthesis complexity and repetitive regions by
                diversifying 10-mer sequences.
              </FormDescription>
            </div>
          </FormItem>
        )}
      />
      <Controller
        name="enforceGcContent"
        control={control}
        render={({ field }) => (
          <FormItem className="flex flex-row items-start space-y-0 space-x-3">
            <FormControl>
              <Checkbox
                id="enforceGcContent"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <div>
              <FormLabel>Enforce 35-60% GC Content</FormLabel>
              <FormDescription>
                Keeps GC content within the 35-60% range optimal for mRNA
                stability and expression. This is a hard constraint: the
                optimizer will not produce a sequence outside this range.
              </FormDescription>
            </div>
          </FormItem>
        )}
      />
    </div>
  )
}
