'use client'
import { ToggleCard } from './toggle-card'
import { designToolCopy } from '../copy'

const copy = designToolCopy.stimulatoryIntrons

export function StimulatoryIntronOptions() {
  return (
    <div className="flex flex-col divide-y divide-border/60 sm:grid sm:grid-cols-2 sm:divide-y-0">
      <ToggleCard
        name="5PrimeStimulatoryIntron"
        label={copy.fivePrime.label}
        description={copy.fivePrime.description}
      />
      <ToggleCard
        name="3PrimeStimulatoryIntron"
        label={copy.threePrime.label}
        description={copy.threePrime.description}
      />
    </div>
  )
}
