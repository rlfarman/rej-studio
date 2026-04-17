'use client'
import { useEffect, useRef, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Loader2, Check, Play } from 'lucide-react'
import { FormValues } from '../types/form-schema'
import { AnimatePresence, m } from 'motion/react'
import { quickFade, softSpring } from '@/lib/motion'

const PROCESSING_STAGES = [
  'Optimizing codons\u2026',
  'Finding split points\u2026',
  'Inserting WGGW motifs\u2026',
  'Generating sequences\u2026',
]

function useProcessingStage(isSubmitting: boolean) {
  const [stage, setStage] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null)

  useEffect(() => {
    if (isSubmitting) {
      setStage(0) // eslint-disable-line react-hooks/set-state-in-effect
      // Advance through stages on a timer
      intervalRef.current = setInterval(() => {
        setStage((s) => Math.min(s + 1, PROCESSING_STAGES.length - 1))
      }, 3000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
      setStage(0)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isSubmitting])

  return PROCESSING_STAGES[stage]
}

interface SubmitButtonProps {
  isJobRunning?: boolean
  isJobComplete?: boolean
}

export function SubmitButton({
  isJobRunning = false,
  isJobComplete = false,
}: SubmitButtonProps) {
  const { formState } = useFormContext<FormValues>()
  const [showSuccess, setShowSuccess] = useState(false)
  const isProcessing = formState.isSubmitting || isJobRunning
  const stageText = useProcessingStage(isProcessing)

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
      className="inline bg-[oklch(0.82_0.2_125)] text-[oklch(0.2_0.06_140)] hover:bg-[oklch(0.77_0.2_125)]"
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
            className="inline-flex items-center gap-2"
          >
            <Loader2 className="animate-spin" />
            {stageText}
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
            Optimization complete
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
            <Play className="size-4" />
            Run optimizer
          </m.span>
        )}
      </AnimatePresence>
    </Button>
  )
}
