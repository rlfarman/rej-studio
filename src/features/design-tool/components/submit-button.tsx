'use client'
import { useEffect, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Loader2, Check, Play } from 'lucide-react'
import { FormValues } from '../types/form-schema'
import { AnimatePresence, m } from 'motion/react'
import { quickFade, softSpring } from '@/lib/motion'
import { designToolCopy } from '../copy'

interface SubmitButtonProps {
  isJobRunning?: boolean
  isJobComplete?: boolean
  stage?: string
}

export function SubmitButton({
  isJobRunning = false,
  isJobComplete = false,
  stage,
}: SubmitButtonProps) {
  const { formState } = useFormContext<FormValues>()
  const [showSuccess, setShowSuccess] = useState(false)
  const isProcessing = formState.isSubmitting || isJobRunning
  // Prefer the real backend stage when the job is running. During the brief
  // pre-submit window (form still validating / action in flight, no job
  // entry yet) we don't have one — show a generic label instead of the
  // previous fake timer-based cycle, which contradicted the real stage
  // shown in the running card below.
  const stageText = stage ?? designToolCopy.submit.processing

  useEffect(() => {
    if (isJobComplete) {
      setShowSuccess(true) // eslint-disable-line react-hooks/set-state-in-effect
      const timer = setTimeout(() => setShowSuccess(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [isJobComplete])

  return (
    <Button
      type="submit"
      size="lg"
      className="min-w-56 bg-[oklch(0.82_0.2_125)] px-6 py-6 text-base font-semibold text-[oklch(0.2_0.06_140)] hover:bg-[oklch(0.77_0.2_125)]"
      disabled={isProcessing}
      aria-busy={isProcessing}
      aria-live="polite"
    >
      <AnimatePresence mode="wait" initial={false}>
        {isProcessing ? (
          <m.span
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={quickFade}
            className="inline-flex items-center gap-2.5"
          >
            <Loader2 className="size-4.5 animate-spin" />
            {stageText}
          </m.span>
        ) : showSuccess ? (
          <m.span
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={softSpring}
            className="inline-flex items-center gap-2.5"
          >
            <Check className="size-4.5" />
            {designToolCopy.submit.success}
          </m.span>
        ) : (
          <m.span
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={quickFade}
            className="inline-flex items-center gap-2.5"
          >
            <Play className="size-4.5" />
            {designToolCopy.submit.idle}
          </m.span>
        )}
      </AnimatePresence>
    </Button>
  )
}
