'use client'
import { ToggleCard } from './toggle-card'
import { designToolCopy } from '../copy'

export function CodonOptimizationOptions() {
  const { toggles, form } = designToolCopy
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {form.sections.objectives}
        </p>
        <div className="flex flex-col space-y-2">
          <ToggleCard
            name="removeCrypticSpliceSites"
            label={toggles.removeCrypticSpliceSites.label}
            description={toggles.removeCrypticSpliceSites.description}
            helpHref="/docs/design-tool#remove-cryptic-splice-sites"
          />
          <ToggleCard
            name="minimizeCpgs"
            label={toggles.minimizeCpgs.label}
            description={toggles.minimizeCpgs.description}
            helpHref="/docs/design-tool#minimize-cpgs"
          />
          <ToggleCard
            name="reduceKmerComplexity"
            label={toggles.reduceKmerComplexity.label}
            description={toggles.reduceKmerComplexity.description}
            helpHref="/docs/design-tool#kmer-complexity"
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {form.sections.constraints}
        </p>
        <ToggleCard
          name="enforceGcContent"
          label={toggles.enforceGcContent.label}
          description={toggles.enforceGcContent.description}
          badge={toggles.enforceGcContent.badge}
          helpHref="/docs/design-tool#gc-content"
        />
      </div>
    </div>
  )
}
