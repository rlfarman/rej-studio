import { useEffect, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Loader2, Check, Play } from 'lucide-react'
import { FormValues } from '../types/form-schema'
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
      className="min-w-56 text-base font-semibold"
      disabled={isProcessing}
      aria-busy={isProcessing}
      // No aria-live here: the stage shown on this button is the same stage
      // the running card announces, and two live regions carrying it read it
      // out twice. aria-busy still says the button is working.
    >
      <span className="inline-flex items-center gap-2.5">
        {isProcessing ? (
          <>
            <Loader2 className="size-4.5 animate-spin" />
            {stageText}
          </>
        ) : showSuccess ? (
          <>
            <Check className="size-4.5" />
            {designToolCopy.submit.success}
          </>
        ) : (
          <>
            <Play className="size-4.5" />
            {designToolCopy.submit.idle}
          </>
        )}
      </span>
    </Button>
  )
}
