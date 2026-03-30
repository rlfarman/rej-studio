'use client'
import { useFormContext } from 'react-hook-form'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormAssistiveText,
} from '@/components/ui/form'
import { FormValues } from './form-schema'
import { SequenceWarnings } from './sequence-warnings'
import { cn } from '@/lib/utils'

const MAX_LENGTH = 50_000

export function CodingSequenceInput() {
  const { control, watch } = useFormContext<FormValues>()
  const value = watch('codingSequence')
  const length = value?.length ?? 0

  return (
    <FormField
      name="codingSequence"
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Enter your coding sequence <span aria-hidden="true">*</span></FormLabel>
          <FormControl>
            <textarea
              placeholder="ATGATTACA..."
              rows={4}
              aria-required="true"
              {...field}
              className={cn(
                'border-input file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex w-full min-w-0 rounded-md border bg-transparent px-3 py-2 font-mono text-sm shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
                'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
                'resize-y',
              )}
            />
          </FormControl>
          <div className="flex min-h-5 items-start justify-between gap-4">
            <FormAssistiveText className="min-w-0">
              Valid characters: A, C, G, T, U. Length must be a multiple of 3.
            </FormAssistiveText>
            <span
              className={cn(
                'text-muted-foreground shrink-0 text-xs tabular-nums',
                length > MAX_LENGTH && 'text-destructive',
              )}
            >
              {length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
            </span>
          </div>
          <SequenceWarnings />
        </FormItem>
      )}
    />
  )
}
