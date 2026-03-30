'use client'
import { useEffect, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Loader2, Check } from 'lucide-react'
import { FormValues } from './form-schema'

export function SubmitButton() {
  const { formState } = useFormContext<FormValues>()
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    if (formState.isSubmitSuccessful && !formState.isSubmitting) {
      setShowSuccess(true)
      const timer = setTimeout(() => setShowSuccess(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [formState.isSubmitSuccessful, formState.isSubmitting])

  return (
    <Button
      type="submit"
      className={`inline ${showSuccess ? 'animate-success-pulse' : ''}`}
      disabled={formState.isSubmitting}
    >
      {formState.isSubmitting ? (
        <>
          <Loader2 className="animate-spin" />
          Processing sequence...
        </>
      ) : showSuccess ? (
        <>
          <Check className="size-4" />
          Sequence downloaded
        </>
      ) : (
        'Download customized sequence'
      )}
    </Button>
  )
}
