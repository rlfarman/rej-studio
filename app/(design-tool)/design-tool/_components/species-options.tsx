'use client'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import { useFormContext } from 'react-hook-form'
import { DESIGN_TOOL_SPECIES_OPTIONS } from '../_types/species-options'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { FormValues } from './form-schema'

export function SpeciesOptions() {
  const { control } = useFormContext<FormValues>()
  return (
    <FormField
      name="species"
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Harmonize codon usage for species</FormLabel>
          <FormControl>
            <RadioGroup
              className="flex gap-6"
              value={field.value}
              onValueChange={field.onChange}
            >
              {DESIGN_TOOL_SPECIES_OPTIONS.map(({ label, value }) => (
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
