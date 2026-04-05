'use client'
import { ToggleCard } from './toggle-card'

export function CodonOptimizationOptions() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Sequence objectives
        </p>
        <div className="flex flex-col space-y-2">
          <ToggleCard
            name="removeCrypticSpliceSites"
            label="Remove cryptic splice sites"
            description="Eliminates donor- and acceptor-like motifs to prevent unintended mRNA splicing in mammalian cells."
          />
          <ToggleCard
            name="minimizeCpgs"
            label="Minimize CpG sites"
            description="Reduces CpG dinucleotides to lower silencing risk from DNA methylation."
          />
          <ToggleCard
            name="reduceKmerComplexity"
            label="Reduce k-mer complexity"
            description="Diversifies 10-mer repeats to ease synthesis and reduce recombination risk."
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Constraints
        </p>
        <ToggleCard
          name="enforceGcContent"
          label="Enforce 35–60% GC content"
          description="Keeps GC content within the range optimal for mRNA stability and expression."
          badge="Hard constraint"
        />
      </div>
    </div>
  )
}
