'use client'
import { ToggleCard } from './toggle-card'
import { designToolCopy } from '../copy'

const copy = designToolCopy.optimizationOptions

export function CodonOptimizationOptions() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {copy.objectivesHeading}
        </p>
        <div className="flex flex-col space-y-2">
          <ToggleCard
            name="removeCrypticSpliceSites"
            label={copy.removeCrypticSpliceSites.label}
            description={copy.removeCrypticSpliceSites.description}
            helpHref="/docs/design-tool#remove-cryptic-splice-sites"
          />
          <ToggleCard
            name="minimizeCpgs"
            label={copy.minimizeCpGs.label}
            description={copy.minimizeCpGs.description}
            helpHref="/docs/design-tool#minimize-cpgs"
          />
          <ToggleCard
            name="reduceKmerComplexity"
            label={copy.reduceKmer.label}
            description={copy.reduceKmer.description}
            helpHref="/docs/design-tool#kmer-complexity"
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {copy.constraintsHeading}
        </p>
        <ToggleCard
          name="enforceGcContent"
          label={copy.enforceGc.label}
          description={copy.enforceGc.description}
          badge={copy.enforceGc.badge}
          helpHref="/docs/design-tool#gc-content"
        />
      </div>
    </div>
  )
}
