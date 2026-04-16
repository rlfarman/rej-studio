'use client'
import * as React from 'react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { DNASplicer } from './dna-splicer'
import { Form } from '@/components/ui/form'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import type { DesignToolSpecies } from '@/features/design-tool/types/species-options'
import type { ProcessResult } from '@/features/design-tool/types/process-result'
import { validationSchema, FormValues } from '../types/form-schema'
import { formatOptionsForReport } from '../utils/form-handler'
import { useJob } from '@/features/design-tool/hooks/use-job'
import { CustomizationOptions } from './customization-options'
import { SpeciesOptions } from './species-options'
import { CodonOptimizationOptions } from './optimization-options'
import { StimulatoryIntronOptions } from './stimulatory-intron-options'
import {
  CodonOptimizeWeight,
  RemoveCrypticSpliceSitesWeight,
  MinimizeCpGsWeight,
  ReduceKmerComplexityWeight,
} from './weight-inputs'
import { SubmitButton } from './submit-button'
import { ResultsPanel } from './results-panel'
import { JobHeader, RunningPlaceholder } from './job-header'
import { toast } from 'sonner'
import { designToolCopy } from '../copy'

interface GeneSplitterFormProperties {
  defaultCodingSequence?: string
  defaultName?: string
  defaultSpecies?: DesignToolSpecies
  defaultJobId?: string
  defaultSpliceJunctionPosition?: number
}

export function GeneSplitterForm({
  defaultCodingSequence,
  defaultName,
  defaultSpecies,
  defaultJobId,
  defaultSpliceJunctionPosition,
}: GeneSplitterFormProperties) {
  const [result, setResult] = useState<ProcessResult | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  // Guards the one-shot form restore. Set true after we hydrate from a
  // resumed URL job, or eagerly on submit so the new job's own persisted
  // formValues don't ricochet back and overwrite the live form.
  const didResetRef = useRef(false)
  // Dedup error toasts: only toast a given jobId once per mount, so
  // navigating back to a previously-failed job doesn't spam.
  const toastedJobsRef = useRef<Set<string>>(new Set())
  const job = useJob({ initialJobId: defaultJobId ?? null })

  const methods = useForm<FormValues>({
    resolver: zodResolver(validationSchema),
    mode: 'onBlur',
    defaultValues: {
      sequenceType: 'dna' as const,
      removeCrypticSpliceSites: true,
      '5PrimeStimulatoryIntron': true,
      '3PrimeStimulatoryIntron': true,
      codonOptimizeWeight: 1,
      removeCrypticSpliceSitesWeight: 1,
      minimizeCpgs: true,
      minimizeCpgsWeight: 1,
      reduceKmerComplexity: true,
      reduceKmerComplexityWeight: 1,
      enforceGcContent: true,
      codingSequence: defaultCodingSequence ?? '',
      proteinSequence: '',
      name: defaultName ?? '',
      species: defaultSpecies ?? 'none',
      spliceJunctionPosition:
        defaultSpliceJunctionPosition ??
        (defaultCodingSequence
          ? Math.floor(defaultCodingSequence.length / 2)
          : 1),
    },
  })

  // Hydrate the form from a resumed URL job's stored formValues — once they
  // appear in history (localStorage isn't populated on first render).
  // Guards against validation drift: if the schema has changed since this
  // job was saved, `safeParse` will reject, and we drop back to defaults
  // rather than silently loading an invalid form.
  React.useEffect(() => {
    if (didResetRef.current) return
    if (!job.formValues) return
    const parsed = validationSchema.safeParse(job.formValues)
    if (parsed.success) {
      methods.reset(parsed.data)
    } else {
      toast.warning(designToolCopy.toasts.incompatibleSavedInputs)
    }
    didResetRef.current = true
  }, [job.formValues, methods])

  // React to status changes: display result and scroll on completion, toast
  // on failure. Storage is handled centrally (useJob on submit, JobWatcher
  // on poll settle), so the form just presents.
  React.useEffect(() => {
    if (job.status === 'completed' && job.result) {
      setResult(job.result)
    } else if (job.status === 'failed' && job.error && job.jobId) {
      if (!toastedJobsRef.current.has(job.jobId)) {
        toastedJobsRef.current.add(job.jobId)
        toast.error(job.error.message)
      }
    }
  }, [job.status, job.result, job.error, job.jobId])

  const onSubmit = async (values: FormValues) => {
    setResult(null)
    // Mark as reset so the about-to-be-persisted formValues don't trigger
    // the hydration effect above and overwrite the live form.
    didResetRef.current = true
    setIsEditing(false)
    await job.submitJob(values)
  }

  const handleRerun = async () => {
    const valid = await methods.trigger()
    if (!valid) {
      setIsEditing(true)
      toast.error(designToolCopy.toasts.fixErrorsBeforeRerun)
      return
    }
    await methods
      .handleSubmit(onSubmit)()
      .catch(() => {})
  }

  const showForm = job.status === 'idle' || isEditing
  const isRunning = job.status === 'submitting' || job.status === 'running'
  // 'submitting' is the brief window while the POST is in flight; treat it
  // as running for header/placeholder purposes so the UI doesn't blank out.
  const headerStatus: 'running' | 'completed' | 'failed' | 'cancelled' | null =
    job.status === 'submitting' || job.status === 'running'
      ? 'running'
      : job.status === 'completed' ||
          job.status === 'failed' ||
          job.status === 'cancelled'
        ? job.status
        : null

  return (
    <Form {...methods}>
      {}
      {/* eslint-disable-next-line react-hooks/refs -- onSubmit only writes didResetRef in the submit event handler, never during render */}
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
        {!showForm && headerStatus && (
          <JobHeader
            name={methods.getValues('name')}
            sequenceLength={methods.getValues('codingSequence').length}
            species={methods.getValues('species')}
            status={headerStatus}
            processingTimeSeconds={result?.processing_time_seconds ?? null}
            errorMessage={job.error?.message ?? null}
            retriable={job.error?.retriable ?? true}
            onEdit={() => setIsEditing(true)}
            onRerun={handleRerun}
            onCancel={isRunning ? job.cancelJob : undefined}
          />
        )}

        {!showForm && isRunning && !result && (
          <RunningPlaceholder stage={job.stage} progress={job.progress} />
        )}

        {showForm && (
          <>
            {/* ── Card 1: Input ── */}
            <Card
              className="fade-up-stagger"
              style={{ '--stagger': 0 } as React.CSSProperties}
            >
              <CardHeader>
                <h1 className="text-2xl leading-none font-bold tracking-tight">
                  {designToolCopy.page.title}
                </h1>
                <CardDescription>
                  {designToolCopy.page.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div data-tour="dt-sequence">
                  <CustomizationOptions />
                </div>
                <SpeciesOptions />
                <div className="space-y-2" data-tour="dt-splicer">
                  <p className="text-sm font-medium">
                    {designToolCopy.form.splicer.label}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {designToolCopy.form.splicer.description}
                  </p>
                  <DNASplicer />
                </div>
              </CardContent>
            </Card>

            {/* ── Card 2: Strategy ── */}
            <Card
              className="fade-up-stagger"
              style={{ '--stagger': 1 } as React.CSSProperties}
              data-tour="dt-optimization"
            >
              <CardHeader>
                <CardTitle>{designToolCopy.form.optimization.title}</CardTitle>
                <CardDescription>
                  {designToolCopy.form.optimization.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Accordion type="multiple">
                  <AccordionItem value="codon-optimization">
                    <AccordionTrigger>
                      <div>
                        <p>
                          {designToolCopy.form.sections.codonOptimization.label}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {
                            designToolCopy.form.sections.codonOptimization
                              .description
                          }
                        </p>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 pb-8">
                      <CodonOptimizationOptions />
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="fragment-options">
                    <AccordionTrigger>
                      <div>
                        <p>
                          {
                            designToolCopy.form.sections.stimulatoryIntrons
                              .label
                          }
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {
                            designToolCopy.form.sections.stimulatoryIntrons
                              .description
                          }
                        </p>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 pb-8">
                      <StimulatoryIntronOptions />
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="weights">
                    <AccordionTrigger>
                      <div>
                        <p>{designToolCopy.form.sections.weights.label}</p>
                        <p className="text-muted-foreground text-sm">
                          {designToolCopy.form.sections.weights.description}
                        </p>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 pb-8">
                      <div className="flex flex-col space-y-4">
                        <CodonOptimizeWeight />
                        <RemoveCrypticSpliceSitesWeight />
                        <MinimizeCpGsWeight />
                        <ReduceKmerComplexityWeight />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            {/* ── Card 3: Review / Submit ── */}
            <Card
              className="fade-up-stagger"
              style={{ '--stagger': 2 } as React.CSSProperties}
              data-tour="dt-submit"
            >
              <CardHeader>
                <CardTitle>{designToolCopy.form.review.title}</CardTitle>
                <CardDescription>
                  {designToolCopy.form.review.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-end">
                  <SubmitButton
                    isJobRunning={job.isLoading}
                    isJobComplete={job.status === 'completed'}
                  />
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {result && (
          <div className="fade-up">
            <ResultsPanel
              result={result}
              optionsUsed={formatOptionsForReport(methods.getValues())}
              species={methods.getValues('species')}
            />
          </div>
        )}
      </form>
    </Form>
  )
}
