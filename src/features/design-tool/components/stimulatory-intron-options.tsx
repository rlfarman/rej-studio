'use client'
import { ToggleCard } from './toggle-card'
import { designToolCopy } from '../copy'

export function StimulatoryIntronOptions() {
  const { stim5Prime, stim3Prime } = designToolCopy.toggles
  return (
    <div className="space-y-3">
      <SpliceJunctionDiagram />
      <div className="grid gap-2 sm:grid-cols-2">
        <ToggleCard
          name="5PrimeStimulatoryIntron"
          label={stim5Prime.label}
          description={stim5Prime.description}
          helpHref="/docs/design-tool#stim-5"
        />
        <ToggleCard
          name="3PrimeStimulatoryIntron"
          label={stim3Prime.label}
          description={stim3Prime.description}
          helpHref="/docs/design-tool#stim-3"
        />
      </div>
    </div>
  )
}

function SpliceJunctionDiagram() {
  return (
    <div
      className="bg-muted/40 text-muted-foreground rounded-md border px-3 py-2.5 text-[11px]"
      aria-hidden="true"
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] tracking-wider uppercase">
          5′
        </span>
        <div className="bg-primary/15 border-primary/30 flex h-6 flex-1 items-center justify-center rounded-l-sm border-y border-l text-[10px]">
          fragment
        </div>
        <div className="bg-primary/40 h-6 w-px" />
        <div className="bg-primary/15 border-primary/30 flex h-6 flex-1 items-center justify-center rounded-r-sm border-y border-r text-[10px]">
          fragment
        </div>
        <span className="font-mono text-[10px] tracking-wider uppercase">
          3′
        </span>
      </div>
      <div className="mt-1 flex items-center justify-center gap-1.5 text-center">
        <span className="text-muted-foreground/80 text-[10px]">
          splice junction
        </span>
      </div>
    </div>
  )
}
