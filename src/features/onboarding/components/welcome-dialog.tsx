'use client'

import { m, AnimatePresence } from 'motion/react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useOnboarding } from '../stores/onboarding-store'
import { Dna, Search, FlaskConical, Download } from 'lucide-react'
import { popSpring } from '@/lib/motion'
import { onboardingCopy } from '../copy'

const copy = onboardingCopy.welcomeDialog

const FEATURES = [
  {
    icon: Search,
    title: copy.features.searchGenes.title,
    description: copy.features.searchGenes.description,
  },
  {
    icon: FlaskConical,
    title: copy.features.compareIsoforms.title,
    description: copy.features.compareIsoforms.description,
  },
  {
    icon: Download,
    title: copy.features.optimizeSequences.title,
    description: copy.features.optimizeSequences.description,
  },
] as const

export function WelcomeDialog() {
  const {
    welcomeDialogOpen: open,
    closeWelcome,
    markWelcomeSeen,
    startTour,
  } = useOnboarding()

  function handleStart() {
    markWelcomeSeen()
    closeWelcome()
    // Wait for the close animation so the overlay doesn't stack with the
    // tour overlay. startTour resets the step index to 0 and the runner
    // takes over from there, navigating as needed.
    setTimeout(() => startTour('guided'), 300)
  }

  function handleSkip() {
    markWelcomeSeen()
    closeWelcome()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleSkip()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        {/* Animated header band */}
        <div className="bg-primary/5 relative flex items-center justify-center overflow-hidden py-8">
          <AnimatePresence>
            {open && (
              <m.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 200,
                  damping: 20,
                  delay: 0.15,
                }}
              >
                <div className="bg-primary/10 flex size-16 items-center justify-center rounded-2xl">
                  <Dna className="text-primary size-8" />
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl">{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>

          {/* Feature list */}
          <div className="space-y-3">
            {FEATURES.map((feature, i) => (
              <m.div
                key={feature.title}
                className="flex items-start gap-3"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...popSpring, delay: 0.25 + i * 0.08 }}
              >
                <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <feature.icon className="text-muted-foreground size-4" />
                </div>
                <div>
                  <p className="text-sm leading-tight font-medium">
                    {feature.title}
                  </p>
                  <p className="text-muted-foreground text-[13px] leading-snug">
                    {feature.description}
                  </p>
                </div>
              </m.div>
            ))}
          </div>

          <DialogFooter className="mt-6">
            <Button variant="ghost" onClick={handleSkip}>
              {copy.skip}
            </Button>
            <Button onClick={handleStart}>{copy.takeTour}</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
