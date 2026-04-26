'use client'
import { ToggleCard } from './toggle-card'
import { designToolCopy } from '../copy'

const copy = designToolCopy.stimulatoryIntrons

export function StimulatoryIntronOptions() {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      <ToggleCard
        name="5PrimeStimulatoryIntron"
        label={copy.fivePrime.label}
        description={copy.fivePrime.description}
        // helpHref="/docs/design-tool#stim-5"
      />
      <ToggleCard
        name="3PrimeStimulatoryIntron"
        label={copy.threePrime.label}
        description={copy.threePrime.description}
        // helpHref="/docs/design-tool#stim-3"
      />
    </div>
  )
}
