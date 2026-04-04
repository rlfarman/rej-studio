'use client'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import { SpeciesIcon } from '@/components/species-icon'
import { cn } from '@/lib/utils'
import { Dna } from 'lucide-react'
import { useFormContext } from 'react-hook-form'
import { DESIGN_TOOL_SPECIES_OPTIONS } from '../types/species-options'
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
            <div
              role="radiogroup"
              aria-label="Harmonize codon usage for species"
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
                      <SpeciesIcon species={value} className="text-muted-foreground size-4" />
                    )}
                    <span className={cn('text-sm font-medium', isActive && 'text-primary')}>
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
