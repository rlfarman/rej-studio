import * as React from 'react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
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
import { Skeleton } from '@/components/ui/skeleton'
import type { DesignToolSpecies } from '@/features/design-tool/types/species-options'
import { validationSchema, FormValues } from '../types/form-schema'
import { withSelectedWggwSites } from '../utils/wggw-selection'
import { useJob } from '@/features/design-tool/hooks/use-job'
import { useAccount } from '@/lib/account/account'
import { useFormDraft } from '@/features/design-tool/hooks/use-form-draft'
import { CustomizationOptions } from './customization-options'
import { DesignObjectives } from './optimization-options'
import { SubmitButton } from './submit-button'
import { FinishNotificationOptIn } from './finish-notification-opt-in'
import { TermHint } from '@/components/term-hint'
import { RunSummary } from './run-summary'
import {
  CloudRunningPlaceholder,
  JobHeader,
  RunningPlaceholder,
} from './job-header'
import { CloudRunToggle } from './cloud-run-toggle'
import { toast } from '@/lib/toast'
import { designToolCopy } from '../copy'

// The results UI (the panel, objectives, replay, maps, run record) is about a
// third of the design tool's code and is only needed once a run finishes.
// It loads when a run starts, so it is usually there by the time the result
// is, and the form itself arrives without it.
const loadResultsPanel = () => import('./results-panel')
const ResultsPanel = lazy(() =>
  loadResultsPanel().then((module) => ({ default: module.ResultsPanel })),
)

const copy = designToolCopy.form
const draftCopy = designToolCopy.draft
const announceCopy = designToolCopy.form.announce

interface GeneSplitterFormProperties {
  defaultCodingSequence?: string
  defaultName?: string
  defaultSpecies?: DesignToolSpecies
  defaultJobId?: string
  defaultSpliceJunctionPosition?: number
  /** Scope for the saved draft — the isoform id, or 'new'. */
  draftKey?: string
  /** A new run replaced the design `defaultJobId` named (see useJob). */
  onLeaveJob?: (jobId: string) => void
  /** A design was submitted to the cloud under this id (see useJob). */
  onCloudJob?: (jobId: string) => void
}

export function GeneSplitterForm({
  defaultCodingSequence,
  defaultName,
  defaultSpecies,
  defaultJobId,
  defaultSpliceJunctionPosition,
  draftKey = 'new',
  onLeaveJob,
  onCloudJob,
}: GeneSplitterFormProperties) {
  const [isEditing, setIsEditing] = useState(false)
  // Off by default: a cloud run sends the sequence off this machine, so it
  // is only ever the person's explicit choice, made each time. It also needs
  // an account: signed out, nothing runs in the cloud whatever was ticked.
  const [cloudChosen, setCloudChosen] = useState(false)
  const account = useAccount()
  const runInCloud = cloudChosen && account.status === 'signed-in'
  // Guards the one-shot form restore. Set true after we hydrate from a
  // resumed URL job, or eagerly on submit so the new job's own persisted
  // formValues don't ricochet back and overwrite the live form.
  const didResetRef = useRef(false)
  // Dedup error toasts: a given failure is announced once per mount, so
  // navigating back to a previously-failed job doesn't spam. Keyed by the
  // error itself, not just the job id, so a fresh failure always speaks up.
  const toastedFailuresRef = useRef<Set<string>>(new Set())
  const job = useJob({
    initialJobId: defaultJobId ?? null,
    onLeaveJob,
    onCloudJob,
  })

  const methods = useForm<FormValues>({
    resolver: zodResolver(validationSchema),
    // First check on blur, then on every change: with 'onBlur' an error
    // stayed up after the sequence was fixed, until the next blur.
    mode: 'onTouched',
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
  // restores that job's own inputs instead, below. Decided at mount: a new
  // run drops ?job= from the URL without remounting, and a draft restored
  // then would overwrite the inputs of the run in progress.
  const [resumedJob] = useState(defaultJobId)
  const draft = useFormDraft({
    draftKey,
    methods,
    enabled: !resumedJob,
  })

  // Hydrate the form from a resumed URL job's stored formValues — once they
  // appear in history (it loads from IndexedDB after the first render).
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
  // there (set by useJob when the run settles).
  const result = job.status === 'completed' ? job.result : null

  // Announce failures. Storage is handled centrally (useJob, and
  // BrowserRuns for a run its tab didn't live to finish), so the form just
  // presents.
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
    // The split-point editor keeps only the person's WGGW picks in the form;
    // the sites they resolve to are worked out here, once, for the request.
    await job.submitJob(withSelectedWggwSites(values), { cloud: runInCloud })
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

  // While a resumed job's entry is still loading, the job is neither new nor
  // missing: show a placeholder rather than flashing an empty form.
  // A submission the backend refused before it started (a cloud design over
  // the length limit) kept the form hidden behind a red error naming a
  // toggle that was no longer on screen, and "Run again" repeated it. The
  // form stays up instead: the thing to change is on it.
  const showForm =
    (job.status === 'idle' && !job.isRestoring) ||
    isEditing ||
    job.failedBeforeStart
  const isRunning = job.status === 'submitting' || job.status === 'running'
  // A run (or a restored job) is under way: fetch the results UI now.
  useEffect(() => {
    if (job.status !== 'idle') void loadResultsPanel()
  }, [job.status])
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
        {/* Mounted for the whole life of the form, so a run settling is
            announced: the only live region used to be inside the progress
            card, which unmounts with the run. */}
        <p role="status" aria-live="polite" className="sr-only">
          {job.status === 'completed'
            ? announceCopy.completed
            : job.status === 'failed'
              ? announceCopy.failed(job.error?.message ?? '')
              : job.status === 'cancelled'
                ? announceCopy.cancelled
                : ''}
        </p>

        {job.failedBeforeStart && job.error && (
          <div
            role="alert"
            className="rounded-2xl border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {job.error.message}
          </div>
        )}

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
            // Nothing of this design is on this device, so "Edit" would
            // open a blank form: the header says "Start a new design".
            missing={job.error?.code === 'not_found'}
            onEdit={() => setIsEditing(true)}
            onRerun={handleRerun}
            // A cloud run cannot be cancelled from here: it is not this
            // tab's to stop. Deleting it from the cloud is the way out.
            onCancel={isRunning && !job.cloud ? job.cancelJob : undefined}
            cloud={
              job.cloud && {
                estimateSeconds: job.cloud.estimateSeconds,
                deleted: job.cloud.deleted,
                deleting: job.isDeletingFromCloud,
                onDelete: () => void job.deleteFromCloud(),
              }
            }
          />
        )}

        {!showForm && job.isRestoring && (
          <Skeleton
            aria-hidden
            className="h-[28rem] rounded-[min(var(--radius-4xl),24px)]"
          />
        )}

        {!showForm &&
          isRunning &&
          !result &&
          (job.cloud ? (
            <CloudRunningPlaceholder
              bases={methods.getValues('codingSequence').length}
              estimateSeconds={job.cloud.estimateSeconds}
            />
          ) : (
            <RunningPlaceholder stage={job.stage} progress={job.progress} />
          ))}

        {showForm && (
          <>
            {draft.restored && (
              <div
                role="status"
                className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
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
                    <TermHint
                      topic={copy.spliceJunctionLabel}
                      hint={copy.spliceJunctionHelp}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
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
            <div className="sticky bottom-0 z-20 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-t border-border bg-background/85 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70">
              <RunSummary />
              <div className="flex flex-wrap items-center gap-3">
                <CloudRunToggle
                  checked={runInCloud}
                  onCheckedChange={setCloudChosen}
                  disabled={job.isLoading}
                />
                {/* Only browser runs can finish unseen in a background tab. */}
                {job.runsInBrowser && !runInCloud && (
                  <FinishNotificationOptIn />
                )}
                <SubmitButton
                  isJobRunning={job.isLoading}
                  // Not while editing: reopening a finished run's inputs
                  // flashed "✓ Optimization complete" over a form whose
                  // values no longer match that run.
                  isJobComplete={job.status === 'completed' && !isEditing}
                  stage={job.stage}
                />
              </div>
            </div>
          </>
        )}

        {result && (
          <Suspense
            fallback={<Skeleton className="h-[36rem] w-full rounded-2xl" />}
          >
            {showForm ? (
              // Results of a different set of inputs than the form above
              // now holds: say whose they are rather than leave them to be
              // read as the form's output.
              <section
                aria-labelledby="previous-run-heading"
                className="flex flex-col gap-3"
              >
                <div>
                  <h2
                    id="previous-run-heading"
                    className="text-base font-semibold tracking-tight"
                  >
                    {copy.previousRun.heading}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {copy.previousRun.description}
                  </p>
                </div>
                <ResultsPanel result={result} runValues={job.formValues} />
              </section>
            ) : (
              <ResultsPanel result={result} runValues={job.formValues} />
            )}
          </Suspense>
        )}
      </form>
      {/* eslint-enable react-hooks/refs */}
    </Form>
  )
}
