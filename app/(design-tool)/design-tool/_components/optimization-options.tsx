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
                Remove cryptic splice donors and cryptic splice acceptors from
                sequence
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
                Minimize the number of CpG sites in the sequence
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
                Reduce the complexity of the sequence by minimizing repetitive
                k-mers
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
                GC content of the sequence will be enforced to be between 35%
                and 60%
              </FormDescription>
            </div>
          </FormItem>
        )}
      />
    </div>
  )
}
