'use client'
import { useId, useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { ChevronDown } from 'lucide-react'
import { ToggleCard } from './toggle-card'
import { FieldHelp } from './field-help'
import { designToolCopy } from '../copy'
import {
  CodonOptimizeWeight,
  RemoveCrypticSpliceSitesWeight,
  MinimizeCpGsWeight,
  ReduceKmerComplexityWeight,
} from './weight-inputs'
import { StimulatoryIntronOptions } from './stimulatory-intron-options'
import { FormValues } from '../types/form-schema'
import { isSpecies } from '@/lib/bio/species'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DESIGN_TOOL_SPECIES_OPTIONS } from '../types/species-options'
import { SpeciesIcon } from '@/components/bio/species-icon'
import { summarizeObjectives } from '../utils/objectives-summary'

const copy = designToolCopy.optimizationOptions
const formCopy = designToolCopy.form
const CODON_OPTIMIZATION_CHECKBOX_ID = 'codon-optimization-enabled'

function CodonOptimizationRow({ showWeight }: { showWeight: boolean }) {
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
      setValue('species', 'human')
      return
    }
    // Protein input is reverse-translated with the species codon table, so
    // it can't be turned off there.
    if (!isProtein) {
      setValue('species', 'none')
    }
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2.5 rounded-md px-2 py-2.5 transition-colors',
        enabled ? 'bg-primary/[0.04]' : 'hover:bg-muted/40',
      )}
    >
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
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm leading-none font-medium">
              {copy.codonOptimize.label}
            </span>
            <FieldHelp topic={copy.codonOptimize.label}>
              {copy.help.codonOptimize}
            </FieldHelp>
          </div>
          <p className="text-muted-foreground text-xs leading-snug">
            {copy.codonOptimize.description}
          </p>
        </div>
      </label>
      <div className="flex items-center gap-1.5 self-center">
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
        {showWeight ? (
          <div className="min-w-fit pl-1.5">
            <CodonOptimizeWeight inline />
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Design objectives, summarized by default.
 *
 * All eight objectives used to be on screen at once, each in its own bordered
 * row with a bare numeric weight. Most runs use the defaults, so the default
 * view is now a one-line summary; the full controls — and, a level deeper,
 * the weights — are opened on demand.
 */
export function DesignObjectives() {
  const [customizing, setCustomizing] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const panelId = useId()
  const advancedId = useId()

  const { control } = useFormContext<FormValues>()
  const values = useWatch({ control }) as Partial<FormValues>
  const summary = summarizeObjectives({
    species: values.species ?? 'none',
    removeCrypticSpliceSites: values.removeCrypticSpliceSites ?? false,
    minimizeCpgs: values.minimizeCpgs ?? false,
    reduceKmerComplexity: values.reduceKmerComplexity ?? false,
    enforceGcContent: values.enforceGcContent ?? false,
    '5PrimeStimulatoryIntron': values['5PrimeStimulatoryIntron'] ?? false,
    '3PrimeStimulatoryIntron': values['3PrimeStimulatoryIntron'] ?? false,
    codonOptimizeWeight: values.codonOptimizeWeight ?? 1,
    removeCrypticSpliceSitesWeight: values.removeCrypticSpliceSitesWeight ?? 1,
    minimizeCpgsWeight: values.minimizeCpgsWeight ?? 1,
    reduceKmerComplexityWeight: values.reduceKmerComplexityWeight ?? 1,
  })

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-medium">
            {formCopy.optimizationHeading}
          </h2>
          <p className="text-muted-foreground text-sm">
            <span className="text-foreground font-medium">
              {summary.isDefault
                ? copy.summary.recommendedLabel
                : copy.summary.customLabel}
            </span>
            {summary.items.length > 0 ? (
              <>
                {': '}
                {summary.items.join(' · ')}
              </>
            ) : (
              <>
                {' — '}
                {copy.summary.none}
              </>
            )}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={customizing}
          aria-controls={panelId}
          aria-label={copy.summary.editAria}
          onClick={() => setCustomizing((open) => !open)}
        >
          {customizing ? copy.summary.hide : copy.summary.customize}
          <ChevronDown
            aria-hidden
            className={cn('transition-transform', customizing && 'rotate-180')}
          />
        </Button>
      </div>

      {customizing && (
        <div id={panelId} className="flex flex-col">
          <div className="divide-border/60 flex flex-col divide-y">
            <CodonOptimizationRow showWeight={showAdvanced} />
            <ToggleCard
              name="removeCrypticSpliceSites"
              label={copy.removeCrypticSpliceSites.label}
              description={copy.removeCrypticSpliceSites.description}
              help={copy.help.spliceSites}
              activeChildren={
                showAdvanced ? <RemoveCrypticSpliceSitesWeight /> : undefined
              }
            />
            <ToggleCard
              name="minimizeCpgs"
              label={copy.minimizeCpGs.label}
              description={copy.minimizeCpGs.description}
              help={copy.help.cpg}
              activeChildren={showAdvanced ? <MinimizeCpGsWeight /> : undefined}
            />
            <ToggleCard
              name="reduceKmerComplexity"
              label={copy.reduceKmer.label}
              description={copy.reduceKmer.description}
              help={copy.help.kmer}
              activeChildren={
                showAdvanced ? <ReduceKmerComplexityWeight /> : undefined
              }
            />
            <ToggleCard
              name="enforceGcContent"
              label={copy.enforceGc.label}
              help={copy.help.gc}
            />
          </div>

          <div className="mt-5 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-sm font-medium">
                {formCopy.accordion.stimulatoryIntrons}
              </h3>
              <FieldHelp topic={formCopy.accordion.stimulatoryIntrons}>
                {copy.help.stimulatoryIntrons}
              </FieldHelp>
            </div>
            <StimulatoryIntronOptions />
          </div>

          <div className="mt-5">
            <button
              type="button"
              aria-expanded={showAdvanced}
              aria-controls={advancedId}
              onClick={() => setShowAdvanced((open) => !open)}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
            >
              <ChevronDown
                aria-hidden
                className={cn(
                  'size-4 transition-transform',
                  showAdvanced && 'rotate-180',
                )}
              />
              {copy.advanced.label}
            </button>
            {showAdvanced && (
              <p
                id={advancedId}
                className="text-muted-foreground mt-2 max-w-prose text-xs leading-relaxed"
              >
                {copy.advanced.hint}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
