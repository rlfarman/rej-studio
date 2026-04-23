'use client'
import { useFormContext } from 'react-hook-form'
import { ToggleCard } from './toggle-card'
import { designToolCopy } from '../copy'
import {
  CodonOptimizeWeight,
  RemoveCrypticSpliceSitesWeight,
  MinimizeCpGsWeight,
  ReduceKmerComplexityWeight,
} from './weight-inputs'
import { FormValues } from '../types/form-schema'
import { isSpecies } from '@/lib/bio/species'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { DESIGN_TOOL_SPECIES_OPTIONS } from '../types/species-options'
import { SpeciesIcon } from '@/components/bio/species-icon'

const copy = designToolCopy.optimizationOptions
const CODON_OPTIMIZATION_CHECKBOX_ID = 'codon-optimization-enabled'

function CodonOptimizationCard() {
  const { watch, setValue } = useFormContext<FormValues>()
  const species = watch('species')
  const sequenceType = watch('sequenceType')
  const enabled = isSpecies(species)
  const isProtein = sequenceType === 'protein'
  const selectableSpecies = DESIGN_TOOL_SPECIES_OPTIONS.filter(
    ({ value }) => value !== 'none',
  )

  const handleToggle = (checked: boolean) => {
    if (checked) {
      setValue('species', enabled ? species : 'human')
      return
    }

    if (!isProtein) {
      setValue('species', 'none')
    }
  }

  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5 transition-colors',
        enabled ? 'border-primary/40 bg-primary/5' : 'hover:bg-muted/50',
      )}
    >
      <div className="flex items-center gap-2.5">
        <label
          htmlFor={CODON_OPTIMIZATION_CHECKBOX_ID}
          className={cn(
            'flex min-w-0 flex-1 cursor-pointer items-center gap-2.5',
            isProtein && 'cursor-default',
          )}
        >
          <Checkbox
            id={CODON_OPTIMIZATION_CHECKBOX_ID}
            checked={enabled}
            disabled={isProtein}
            aria-label={copy.codonOptimize.label}
            className="self-center"
            onCheckedChange={(value) => handleToggle(value === true)}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 self-center">
            <span className="text-sm leading-none font-medium">
              {copy.codonOptimize.label}
            </span>
            <p className="text-muted-foreground text-xs leading-snug">
              {copy.codonOptimize.description}
            </p>
          </div>
        </label>
        <div className="flex flex-wrap items-center gap-1.5 self-center">
          {selectableSpecies.map(({ label, value }) => {
            const isActive = species === value
            const isDisabled = !enabled

            return (
              <button
                key={value}
                type="button"
                aria-pressed={isActive}
                aria-disabled={isDisabled}
                disabled={isDisabled}
                title={
                  isDisabled ? copy.codonOptimize.enableSpeciesFirst : undefined
                }
                onClick={() => setValue('species', value)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
                  isActive
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'bg-background text-muted-foreground hover:text-foreground hover:bg-muted/60',
                  isDisabled &&
                    'hover:bg-background hover:text-muted-foreground cursor-not-allowed opacity-50',
                )}
              >
                <SpeciesIcon species={value} className="size-3.5" />
                {label}
              </button>
            )
          })}
        </div>
        <div className="min-w-fit self-center pl-1.5">
          <CodonOptimizeWeight inline />
        </div>
      </div>
    </div>
  )
}

export function CodonOptimizationOptions() {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <CodonOptimizationCard />
        <div className="flex flex-col space-y-1.5">
          <ToggleCard
            name="removeCrypticSpliceSites"
            label={copy.removeCrypticSpliceSites.label}
            description={copy.removeCrypticSpliceSites.description}
            // helpHref="/docs/design-tool#remove-cryptic-splice-sites"
            activeChildren={<RemoveCrypticSpliceSitesWeight />}
          />
          <ToggleCard
            name="minimizeCpgs"
            label={copy.minimizeCpGs.label}
            description={copy.minimizeCpGs.description}
            // helpHref="/docs/design-tool#minimize-cpgs"
            activeChildren={<MinimizeCpGsWeight />}
          />
          <ToggleCard
            name="reduceKmerComplexity"
            label={copy.reduceKmer.label}
            description={copy.reduceKmer.description}
            // helpHref="/docs/design-tool#kmer-complexity"
            activeChildren={<ReduceKmerComplexityWeight />}
          />
          <ToggleCard
            name="enforceGcContent"
            label={copy.enforceGc.label}
            description={copy.enforceGc.description}
            badge={copy.enforceGc.badge}
            // helpHref="/docs/design-tool#gc-content"
          />
        </div>
      </div>
    </div>
  )
}
