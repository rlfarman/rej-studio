import { useFormContext, useWatch } from 'react-hook-form'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { FormValues } from '../types/form-schema'
import { designToolCopy } from '../copy'

const MAX_NAME_LENGTH = 250
// The counter is noise on a short name, so it appears only as the limit nears.
// The input's maxLength stops typing at the limit, so it never goes over.
const SHOW_COUNTER_FROM = 200

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
            {length >= SHOW_COUNTER_FROM && (
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {length.toLocaleString()} / {MAX_NAME_LENGTH.toLocaleString()}
              </span>
            )}
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
          {/* The name is required and starts empty, so without this a form
              submitted without one failed with nothing on screen. */}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
