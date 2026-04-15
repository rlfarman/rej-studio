'use client'

import { useEffect, useState } from 'react'
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
import { usePathname } from 'next/navigation'
import { Dna, Search, FlaskConical, Download } from 'lucide-react'
import type { TourId } from '../tours'

const FEATURES = [
  {
    icon: Search,
    title: 'Search genes',
    description: 'Browse 30,000+ genes across human and mouse genomes',
  },
  {
    icon: FlaskConical,
    title: 'Compare isoforms',
    description:
      'View isoform metrics, suitability scores, and sequence identity',
  },
  {
    icon: Download,
    title: 'Optimize sequences',
    description:
      'Design split-intein sequences with codon optimization and more',
  },
] as const

function tourForPath(pathname: string): TourId | null {
  if (pathname === '/') return 'home'
  if (pathname.startsWith('/design-tool')) return 'design-tool'
  if (pathname.startsWith('/genes/')) return 'gene-detail'
  return null
}

export function WelcomeDialog() {
  const { hasSeenWelcome, markWelcomeSeen, startTour } = useOnboarding()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    if (!hasSeenWelcome) {
      const timer = setTimeout(() => setOpen(true), 400)
      return () => clearTimeout(timer)
    }
  }, [mounted, hasSeenWelcome])

  function handleStart() {
    markWelcomeSeen()
    setOpen(false)
    const tourId = tourForPath(pathname)
    if (tourId) {
      setTimeout(() => startTour(tourId), 300)
    }
  }

  function handleSkip() {
    markWelcomeSeen()
    setOpen(false)
  }

  if (!mounted) return null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleSkip()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="bg-primary/5 relative flex items-center justify-center overflow-hidden py-8">
          <div className="bg-primary/10 flex size-16 items-center justify-center rounded-2xl">
            <Dna className="text-primary size-8" />
          </div>
        </div>

        <div className="p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl">Welcome to REJ Studio</DialogTitle>
            <DialogDescription>
              Design optimized RNA End-Joining sequences in three steps.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex items-start gap-3">
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
              </div>
            ))}
          </div>

          <DialogFooter className="mt-6">
            <Button variant="ghost" onClick={handleSkip}>
              Skip for now
            </Button>
            <Button onClick={handleStart}>Take the tour</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
