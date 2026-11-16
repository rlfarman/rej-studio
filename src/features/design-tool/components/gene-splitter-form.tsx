'use client'
import * as React from 'react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Undo2, X } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { DNASplicer } from './dna-splicer'
import { Form } from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import type { DesignToolSpecies } from '@/features/design-tool/types/species-options'
import { validationSchema, FormValues } from '../types/form-schema'
import { formatOptionsForReport } from '../utils/form-handler'
import { useJob } from '@/features/design-tool/hooks/use-job'
import { useFormDraft } from '@/features/design-tool/hooks/use-form-draft'
import { CustomizationOptions } from './customization-options'
import { DesignObjectives } from './optimization-options'
import { SubmitButton } from './submit-button'
import { FieldHelp } from './field-help'
import { RunSummary } from './run-summary'
import { ResultsPanel } from './results-panel'
import { JobHeader, RunningPlaceholder } from './job-header'
import { toast } from 'sonner'
import { designToolCopy } from '../copy'

const copy = designToolCopy.form
const draftCopy = designToolCopy.draft

interface GeneSplitterFormProperties {
  defaultCodingSequence?: string
  defaultName?: string
  defaultSpecies?: DesignToolSpecies
  defaultJobId?: string
  defaultSpliceJunctionPosition?: number
  /** Scope for the saved draft — the isoform id, or 'new'. */
  draftKey?: string
}

export function GeneSplitterForm({
  defaultCodingSequence,
  defaultName,
  defaultSpecies,
  defaultJobId,
  defaultSpliceJunctionPosition,
  draftKey = 'new',
}: GeneSplitterFormProperties) {
  const [isEditing, setIsEditing] = useState(false)
  // Guards the one-shot form restore. Set true after we hydrate from a
  // resumed URL job, or eagerly on submit so the new job's own persisted
  // formValues don't ricochet back and overwrite the live form.
  const didResetRef = useRef(false)
  // Dedup error toasts: a given failure is announced once per mount, so
  // navigating back to a previously-failed job doesn't spam. Keyed by the
  // error itself, not just the job id, so a fresh failure always speaks up.
  const toastedFailuresRef = useRef<Set<string>>(new Set())
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
      selectedWggwSites: [null],
      spliceJunctionPositions: [
        defaultSpliceJunctionPosition ??
          (defaultCodingSequence
            ? Math.floor(defaultCodingSequence.length / 2)
            : 1),
      ],
    },
  })

  // Draft persistence — only when starting fresh. Resuming a job (?job=…)
  // restores that job's own inputs instead, below.
  const draft = useFormDraft({
    draftKey,
    methods,
    enabled: !defaultJobId,
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
      toast.warning(copy.savedInputsIncompatible)
    }
    didResetRef.current = true
  }, [job.formValues, methods])

  // Results are derived, not mirrored into local state: the entry in history
  // is the single source of truth, and a completed job's result is already
  // there (set by useJob on a local run, by JobWatcher on a polled one).
  const result = job.status === 'completed' ? job.result : null

  // Announce failures. Storage is handled centrally (useJob on submit,
  // JobWatcher on poll settle), so the form just presents.
  React.useEffect(() => {
    if (job.status !== 'failed' || !job.error) return
    const signature = `${job.jobId ?? 'unknown'}:${job.error.code}:${job.error.message}`
    if (toastedFailuresRef.current.has(signature)) return
    toastedFailuresRef.current.add(signature)
    toast.error(job.error.message)
  }, [job.status, job.error, job.jobId])

  const onSubmit = async (values: FormValues) => {
    // Mark as reset so the about-to-be-persisted formValues don't trigger
    // the hydration effect above and overwrite the live form.
    didResetRef.current = true
    setIsEditing(false)
    await job.submitJob(values)
    // The inputs are safe in the job entry now, so the draft can go.
    draft.clear()
  }

  const handleRerun = async () => {
    const valid = await methods.trigger()
    if (!valid) {
      setIsEditing(true)
      toast.error(copy.fixErrorsBeforeRerun)
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
  // A job we have no record of (shared link, cleared history, expired
  // call_id) has no length or species to report — the header hides those
  // chips rather than inventing "0 bp".
  const hasJobRecord = job.status === 'submitting' || job.formValues != null

  return (
    <Form {...methods}>
      {/* eslint-disable react-hooks/refs -- onSubmit only writes didResetRef in the submit event handler, never during render */}
      <form
        onSubmit={methods.handleSubmit(onSubmit)}
        className="flex flex-col gap-6"
      >
        {!showForm && headerStatus && (
          <JobHeader
            name={methods.getValues('name')}
            sequenceLength={
              hasJobRecord ? methods.getValues('codingSequence').length : null
            }
            species={hasJobRecord ? methods.getValues('species') : 'none'}
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
            {draft.restored && (
              <div
                role="status"
                className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs"
              >
                <span>{draftCopy.restored}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2"
                  onClick={draft.discard}
                >
                  <Undo2 className="size-3.5" />
                  {draftCopy.discard}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  aria-label={draftCopy.dismissAria}
                  onClick={draft.dismiss}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            )}

            {/* ── Input + split point ── */}
            <Card>
              <CardHeader>
                <CardTitle
                  render={
                    <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                      {copy.title}
                    </h1>
                  }
                />
                <CardDescription>{copy.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <CustomizationOptions />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-medium">
                      {copy.spliceJunctionLabel}
                    </p>
                    <FieldHelp topic={copy.spliceJunctionLabel}>
                      {copy.spliceJunctionHelp}
                    </FieldHelp>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {copy.spliceJunctionHint}
                  </p>
                  <DNASplicer />
                </div>
              </CardContent>
            </Card>

            {/* ── Objectives (summarized; expand to customize) ── */}
            <Card>
              <CardContent>
                <DesignObjectives />
              </CardContent>
            </Card>

            {/* Sticky so the primary action stays in reach on a long form,
                and within thumb reach on a phone. */}
            <div className="bg-background/85 border-border supports-[backdrop-filter]:bg-background/70 sticky bottom-0 z-20 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-t-lg border-t px-4 py-3 backdrop-blur">
              <RunSummary />
              <SubmitButton
                isJobRunning={job.isLoading}
                isJobComplete={job.status === 'completed'}
                stage={job.stage}
              />
            </div>
          </>
        )}

        {result && (
          <div>
            <ResultsPanel
              result={result}
              optionsUsed={formatOptionsForReport(methods.getValues())}
              species={methods.getValues('species')}
            />
          </div>
        )}
      </form>
      {/* eslint-enable react-hooks/refs */}
    </Form>
  )
}
