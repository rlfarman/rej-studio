'use client'
import { useFormContext } from 'react-hook-form'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormAssistiveText,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { FormValues } from '../types/form-schema'
import { cn } from '@/lib/utils'

const MAX_NAME_LENGTH = 250

export function NameInput() {
  const { control, watch } = useFormContext<FormValues>()
  const value = watch('name')
  const length = value?.length ?? 0

  return (
    <FormField
      name="name"
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            Choose a name for your coding sequence{' '}
            <span aria-hidden="true">*</span>
          </FormLabel>
          <FormControl>
            <Input
              type="text"
              placeholder="My Custom Sequence"
              aria-required="true"
              maxLength={MAX_NAME_LENGTH}
              {...field}
            />
          </FormControl>
          <FormAssistiveText>
            <span className="flex min-h-5 items-start justify-between gap-4">
              <span />
              <span
                className={cn(
                  'shrink-0 tabular-nums',
                  length > MAX_NAME_LENGTH
                    ? 'text-destructive-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {length.toLocaleString()} / {MAX_NAME_LENGTH.toLocaleString()}
              </span>
            </span>
          </FormAssistiveText>
        </FormItem>
      )}
    />
  )
}
