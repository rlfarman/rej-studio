'use client'
import { useFormContext, Controller } from 'react-hook-form'
import {
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
} from '@/components/ui/form'
import { Checkbox } from '@/components/ui/checkbox'
import { FormValues } from './form-schema'

export function FiveFragmentOptions() {
  const { control } = useFormContext<FormValues>()
  return (
    <Controller
      name="5PrimeStimulatoryIntron"
      control={control}
      render={({ field }) => (
        <FormItem className="flex flex-row items-start space-y-0 space-x-3">
          <FormControl>
            <Checkbox
              id="5PrimeStimulatoryIntron"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          </FormControl>
          <div>
            <FormLabel>5' Stimulatory Intron</FormLabel>
            <FormDescription>
              Add a stimulatory intron to the 5' REJ RNA sequence
            </FormDescription>
          </div>
        </FormItem>
      )}
    />
  )
}

export function ThreeFragmentOptions() {
  const { control } = useFormContext<FormValues>()
  return (
    <Controller
      name="3PrimeStimulatoryIntron"
      control={control}
      render={({ field }) => (
        <FormItem className="flex flex-row items-start space-y-0 space-x-3">
          <FormControl>
            <Checkbox
              id="3PrimeStimulatoryIntron"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          </FormControl>
          <div>
            <FormLabel>3' Stimulatory Intron</FormLabel>
            <FormDescription>
              Add a stimulatory intron to the 3' REJ RNA
            </FormDescription>
          </div>
        </FormItem>
      )}
    />
  )
}
