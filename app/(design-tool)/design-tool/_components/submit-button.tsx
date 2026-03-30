'use client'
import { useFormContext } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { FormValues } from './form-schema'

export function SubmitButton() {
  const { formState } = useFormContext<FormValues>()
  return (
    <Button type="submit" className="inline" disabled={formState.isSubmitting}>
      Download customized sequence
    </Button>
  )
}
