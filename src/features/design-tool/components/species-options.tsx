'use client'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import { SpeciesIcon } from '@/components/bio/species-icon'
import { cn } from '@/lib/utils'
import { Dna } from 'lucide-react'
import { useFormContext } from 'react-hook-form'
import { DESIGN_TOOL_SPECIES_OPTIONS } from '../types/species-options'
import { FormValues } from '../types/form-schema'
import { designToolCopy } from '../copy'

export function SpeciesOptions() {
  const { control, watch } = useFormContext<FormValues>()
  const sequenceType = watch('sequenceType')
  const isProtein = sequenceType === 'protein'
  return (
    <FormField
      name="species"
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {designToolCopy.speciesOptions.label}
            {isProtein && <span aria-hidden="true"> *</span>}
          </FormLabel>
          <FormControl>
            <div
              role="radiogroup"
              aria-label={designToolCopy.speciesOptions.label}
              className="grid grid-cols-1 gap-2 sm:grid-cols-3"
            >
              {DESIGN_TOOL_SPECIES_OPTIONS.map(({ label, value }) => {
                const isActive = field.value === value

                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => field.onChange(value)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
                      isActive
                        ? 'border-primary bg-primary/5 ring-primary/20 ring-1'
                        : 'hover:bg-muted/50',
                    )}
                  >
                    {value === 'none' ? (
                      <Dna className="text-muted-foreground size-4" />
                    ) : (
                      <SpeciesIcon
                        species={value}
                        className="text-muted-foreground size-4"
                      />
                    )}
                    <span
                      className={cn(
                        'text-sm font-medium',
                        isActive && 'text-primary',
                      )}
                    >
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
