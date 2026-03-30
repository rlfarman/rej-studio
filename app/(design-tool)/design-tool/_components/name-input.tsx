'use client'
import { useFormContext } from 'react-hook-form'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { FormValues } from './form-schema'

export function NameInput() {
  const { control } = useFormContext<FormValues>()
  return (
    <FormField
      name="name"
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Choose a name for your coding sequence <span aria-hidden="true">*</span></FormLabel>
          <FormControl>
            <Input type="text" placeholder="ABC123..." aria-required="true" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
