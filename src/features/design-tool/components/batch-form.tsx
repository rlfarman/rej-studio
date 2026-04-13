'use client'

import { useCallback, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { ArrowLeft, Play, Loader2 } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { Form } from '@/components/ui/form'
import { cn } from '@/lib/utils'
import { Dna } from 'lucide-react'
import { SpeciesIcon } from '@/components/bio/species-icon'
import { DESIGN_TOOL_SPECIES_OPTIONS } from '@/features/design-tool/types/species-options'
import {
  batchOptionsSchema,
  BATCH_OPTIONS_DEFAULTS,
  type BatchOptions,
} from '@/features/design-tool/types/batch-form-schema'
import type { BatchEntry } from '@/features/design-tool/utils/parse-batch-file'
import {
  useBatchJobStore,
  submitBatch,
} from '@/features/design-tool/hooks/use-batch-job'
import { BatchUpload } from './batch-upload'
import { BatchResultsPanel } from './batch-results-panel'
import { toast } from 'sonner'
import { isSpecies } from '@/lib/bio/species'

function BatchToggleCard({
  name,
  label,
  description,
  badge,
  control,
}: {
  name: keyof BatchOptions
  label: string
  description: string
  badge?: string
  control: ReturnType<typeof useForm<BatchOptions>>['control']
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const checked = field.value as boolean
        return (
          <div
            className={cn(
              'flex flex-row items-start gap-3 rounded-lg border p-3 transition-colors',
              checked ? 'border-primary/40 bg-primary/5' : 'hover:bg-muted/50',
            )}
          >
            <label className="flex flex-1 cursor-pointer flex-row items-start gap-3">
              <Checkbox
                checked={checked}
                onCheckedChange={field.onChange}
                className="mt-0.5"
              />
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm leading-none font-medium">
                    {label}
                  </span>
                  {badge && (
                    <Badge variant="outline" className="text-[10px]">
                      {badge}
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-[13px] leading-snug">
                  {description}
                </p>
              </div>
            </label>
          </div>
        )
      }}
    />
  )
}

export function BatchForm() {
  const [entries, setEntries] = useState<BatchEntry[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const activeBatchId = useBatchJobStore((s) => s.activeBatchId)

  const methods = useForm<BatchOptions>({
    resolver: zodResolver(batchOptionsSchema),
    defaultValues: BATCH_OPTIONS_DEFAULTS,
  })

  const validEntries = entries.filter((e) => e.validationErrors.length === 0)
  const hasProtein = validEntries.some((e) => e.sequenceType === 'protein')
  const species = methods.watch('species')

  const onSubmit = useCallback(
    async (options: BatchOptions) => {
      if (validEntries.length === 0) {
        toast.error('No valid sequences to submit.')
        return
      }

      // Check: protein sequences require a species
      if (hasProtein && !isSpecies(options.species)) {
        toast.error(
          'Species selection is required when batch contains protein sequences.',
        )
        return
      }

      setIsSubmitting(true)
      try {
        const batchId = useBatchJobStore
          .getState()
          .createBatch(validEntries, options)
        await submitBatch(batchId)
      } catch {
        toast.error('Batch submission failed.')
      } finally {
        setIsSubmitting(false)
      }
    },
    [validEntries, hasProtein],
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/design-tool"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-2xl leading-none font-bold tracking-tight">
          Batch Optimization
        </h1>
      </div>

      {!activeBatchId && (
        <Form {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
            {/* Card 1: Upload */}
            <Card>
              <CardHeader>
                <CardTitle>Upload Sequences</CardTitle>
                <CardDescription>
                  Upload a FASTA or CSV file with multiple sequences. All
                  sequences share the same optimization settings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BatchUpload entries={entries} onEntriesChange={setEntries} />
              </CardContent>
            </Card>

            {/* Card 2: Shared Options */}
            {validEntries.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Optimization Settings</CardTitle>
                  <CardDescription>
                    These settings apply to all {validEntries.length} sequences.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Species */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Harmonize codon usage for species
                      {hasProtein && <span aria-hidden="true"> *</span>}
                    </label>
                    <Controller
                      name="species"
                      control={methods.control}
                      render={({ field }) => (
                        <div
                          role="radiogroup"
                          aria-label="Harmonize codon usage for species"
                          className="grid grid-cols-1 gap-2 sm:grid-cols-3"
                        >
                          {DESIGN_TOOL_SPECIES_OPTIONS.map(
                            ({ label, value }) => {
                              const isActive = field.value === value
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  role="radio"
                                  aria-checked={isActive}
                                  onClick={() => field.onChange(value)}
                                  className={cn(
                                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
                                    isActive
                                      ? 'border-primary bg-primary/5 ring-primary/20 ring-1'
                                      : 'hover:bg-muted/50',
                                  )}
                                >
                                  {value === 'none' ? (
                                    <Dna className="text-muted-foreground size-4" />
                                  ) : (
                                    <SpeciesIcon
                                      species={value}
                                      className="text-muted-foreground size-4"
                                    />
                                  )}
                                  <span
                                    className={cn(
                                      'text-sm font-medium',
                                      isActive && 'text-primary',
                                    )}
                                  >
                                    {label}
                                  </span>
                                </button>
                              )
                            },
                          )}
                        </div>
                      )}
                    />
                    {hasProtein && !isSpecies(species) && (
                      <p className="text-sm text-amber-600 dark:text-amber-400">
                        Species is required — your batch contains protein
                        sequences.
                      </p>
                    )}
                  </div>

                  {/* Optimization toggles */}
                  <Accordion type="multiple">
                    <AccordionItem value="codon-optimization">
                      <AccordionTrigger>
                        <div>
                          <p>Codon optimization</p>
                          <p className="text-muted-foreground text-sm">
                            Control which sequence features are optimized.
                          </p>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pt-4 pb-8">
                        <BatchToggleCard
                          name="removeCrypticSpliceSites"
                          label="Remove cryptic splice sites"
                          description="Eliminates donor- and acceptor-like motifs to prevent unintended mRNA splicing."
                          control={methods.control}
                        />
                        <BatchToggleCard
                          name="minimizeCpgs"
                          label="Minimize CpG sites"
                          description="Reduces CpG dinucleotides to lower silencing risk from DNA methylation."
                          control={methods.control}
                        />
                        <BatchToggleCard
                          name="reduceKmerComplexity"
                          label="Reduce k-mer complexity"
                          description="Diversifies 10-mer repeats to ease synthesis and reduce recombination risk."
                          control={methods.control}
                        />
                        <BatchToggleCard
                          name="enforceGcContent"
                          label="Enforce 35–60% GC content"
                          description="Keeps GC content within the range optimal for mRNA stability and expression."
                          badge="Hard constraint"
                          control={methods.control}
                        />
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="stimulatory-introns">
                      <AccordionTrigger>
                        <div>
                          <p>Stimulatory introns</p>
                          <p className="text-muted-foreground text-sm">
                            Add introns to boost fragment expression.
                          </p>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pt-4 pb-8">
                        <BatchToggleCard
                          name="5PrimeStimulatoryIntron"
                          label="5′ stimulatory intron"
                          description="Inserted ~150 bp upstream of the junction to boost 5′ fragment expression."
                          control={methods.control}
                        />
                        <BatchToggleCard
                          name="3PrimeStimulatoryIntron"
                          label="3′ stimulatory intron"
                          description="Inserted ~150 bp downstream of the junction to boost 3′ fragment expression."
                          control={methods.control}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            )}

            {/* Card 3: Submit */}
            {validEntries.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Review &amp; Run</CardTitle>
                  <CardDescription>
                    Optimize {validEntries.length} sequence
                    {validEntries.length > 1 ? 's' : ''} with the settings
                    above. Each sequence is processed independently.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={isSubmitting || validEntries.length === 0}
                      className="gap-2"
                    >
                      {isSubmitting ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Play className="size-4" />
                      )}
                      {isSubmitting
                        ? 'Submitting...'
                        : `Run Batch (${validEntries.length})`}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </form>
        </Form>
      )}

      {activeBatchId && <BatchResultsPanel batchId={activeBatchId} />}

      {activeBatchId && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => {
              useBatchJobStore.getState().setActiveBatchId(null)
              setEntries([])
            }}
          >
            Start New Batch
          </Button>
        </div>
      )}
    </div>
  )
}
