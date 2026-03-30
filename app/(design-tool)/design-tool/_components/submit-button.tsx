'use client'
import { useEffect, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Loader2, Check } from 'lucide-react'
import { FormValues } from './form-schema'
import { AnimatePresence, motion } from 'motion/react'

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
      className="inline"
      disabled={formState.isSubmitting}
    >
      <AnimatePresence mode="wait" initial={false}>
        {formState.isSubmitting ? (
          <motion.span
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="inline-flex items-center gap-2"
          >
            <Loader2 className="animate-spin" />
            Processing sequence...
          </motion.span>
        ) : showSuccess ? (
          <motion.span
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            className="inline-flex items-center gap-2"
          >
            <Check className="size-4" />
            Sequence downloaded
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            Download customized sequence
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  )
}
