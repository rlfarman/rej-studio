'use client'
import { useFormContext } from 'react-hook-form'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import { FormValues } from './form-schema'
import { cn } from '@/lib/utils'

export function CodingSequenceInput() {
  const { control } = useFormContext<FormValues>()
  return (
    <FormField
      name="codingSequence"
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Enter your coding sequence</FormLabel>
          <FormControl>
            <textarea
              placeholder="ATGATTACA..."
              rows={4}
              {...field}
              className={cn(
                'border-input file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex w-full min-w-0 rounded-md border bg-transparent px-3 py-2 font-mono text-sm shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
                'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
                'resize-y',
              )}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
