'use client'
import { useEffect, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Loader2, Check, Download } from 'lucide-react'
import { FormValues } from './form-schema'
import { AnimatePresence, m } from 'motion/react'
import { quickFade, softSpring } from '@/lib/motion'

export function SubmitButton() {
  const { formState } = useFormContext<FormValues>()
  const [showSuccess, setShowSuccess] = useState(false)

  // Show a timed success flash after form submission completes.
  // This is a legitimate effect: we're synchronizing a timed UI state
  // with an external state change (react-hook-form's submitCount).
  useEffect(() => {
    if (formState.isSubmitSuccessful && !formState.isSubmitting) {
      setShowSuccess(true) // eslint-disable-line react-hooks/set-state-in-effect
      const timer = setTimeout(() => setShowSuccess(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [formState.isSubmitSuccessful, formState.isSubmitting])

  return (
    <Button
      type="submit"
      className="inline"
      disabled={formState.isSubmitting}
    >
      <AnimatePresence mode="wait" initial={false}>
        {formState.isSubmitting ? (
          <m.span
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={quickFade}
            className="inline-flex items-center gap-2"
          >
            <Loader2 className="animate-spin" />
            Processing sequence...
          </m.span>
        ) : showSuccess ? (
          <m.span
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={softSpring}
            className="inline-flex items-center gap-2"
          >
            <Check className="size-4" />
            Sequence downloaded
          </m.span>
        ) : (
          <m.span
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={quickFade}
            className="inline-flex items-center gap-2"
          >
            <Download className="size-4" />
            Download customized sequence
          </m.span>
        )}
      </AnimatePresence>
    </Button>
  )
}
