'use client'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import { useFormContext } from 'react-hook-form'
import { SpeciesOptions } from '../_types/species-options'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { FormValues } from './gene-splitter-form'

export function SpeciesSelect() {
  const { control } = useFormContext<FormValues>()
  return (
    <FormField
      name="species"
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Codon optimization for species</FormLabel>
          <FormControl>
            <RadioGroup
              className="flex gap-6"
              value={field.value}
              onValueChange={field.onChange}
            >
              {SpeciesOptions.map(({ label, value }) => (
                <div key={value} className="flex items-center space-x-2">
                  <RadioGroupItem id={value} value={value} />
                  <label
                    htmlFor={value}
                    className="text-sm font-medium text-neutral-900 dark:text-white"
                  >
                    {label}
                  </label>
                </div>
              ))}
            </RadioGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
