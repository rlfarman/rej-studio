'use client'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import { useFormContext } from 'react-hook-form'
import { SpeciesOptions as SpeciesOptionsType } from '../_types/species-options'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { FormValues } from './gene-splitter-form'

export function SpeciesOptions() {
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
              {SpeciesOptionsType.map(({ label, value }) => (
                <div key={value} className="flex items-center space-x-2">
                  <RadioGroupItem id={value} value={value} />
                  <label htmlFor={value} className="text-sm font-medium">
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
