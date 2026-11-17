'use client'
import { useFormContext, useWatch } from 'react-hook-form'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { FormValues } from '../types/form-schema'
import { cn } from '@/lib/utils'
import { designToolCopy } from '../copy'

const MAX_NAME_LENGTH = 250

export function NameInput() {
  const { control } = useFormContext<FormValues>()
  const value = useWatch({ control, name: 'name' })
  const length = value?.length ?? 0

  return (
    <FormField
      name="name"
      control={control}
      render={({ field }) => (
        <FormItem>
          <div className="flex items-center justify-between gap-4">
            <FormLabel>
              {designToolCopy.nameInput.label} <span aria-hidden="true">*</span>
            </FormLabel>
            <span
              className={cn(
                'shrink-0 text-xs text-muted-foreground tabular-nums',
                length > MAX_NAME_LENGTH && 'text-destructive-foreground',
              )}
            >
              {length.toLocaleString()} / {MAX_NAME_LENGTH.toLocaleString()}
            </span>
          </div>
          <FormControl>
            <Input
              type="text"
              placeholder={designToolCopy.nameInput.placeholder}
              aria-required="true"
              maxLength={MAX_NAME_LENGTH}
              {...field}
            />
          </FormControl>
        </FormItem>
      )}
    />
  )
}
