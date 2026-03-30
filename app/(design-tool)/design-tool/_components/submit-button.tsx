'use client'
import { useFormContext } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { FormValues } from './form-schema'

export function SubmitButton() {
  const { formState } = useFormContext<FormValues>()
  return (
    <Button type="submit" className="inline" disabled={formState.isSubmitting}>
      {formState.isSubmitting ? (
        <>
          <Loader2 className="animate-spin" />
          Processing sequence...
        </>
      ) : (
        'Download customized sequence'
      )}
    </Button>
  )
}
