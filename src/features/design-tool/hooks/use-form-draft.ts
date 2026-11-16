'use client'

import { useEffect, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type { FormValues } from '@/features/design-tool/types/form-schema'
import { createLogger } from '@/lib/logger'

const log = createLogger('design-draft')

const STORAGE_PREFIX = 'rej-studio:design-draft:'
const DEBOUNCE_MS = 750
const DRAFT_VERSION = 1

/**
 * The slice worth keeping: the inputs a reload would otherwise throw away.
 * Objective toggles and weights are cheap to re-pick and would make the
 * stored payload (and the restore surprise) bigger than it needs to be.
 */
interface DraftPayload {
  v: number
  savedAt: string
  values: Pick<
    FormValues,
    | 'sequenceType'
    | 'codingSequence'
    | 'proteinSequence'
    | 'name'
    | 'species'
    | 'spliceJunctionPositions'
  >
}

function storageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`
}

function readDraft(key: string): DraftPayload | null {
  try {
    const raw = window.localStorage.getItem(storageKey(key))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      (parsed as DraftPayload).v !== DRAFT_VERSION
    ) {
      return null
    }
    const draft = parsed as DraftPayload
    if (!draft.values || typeof draft.values !== 'object') return null
    return draft
  } catch {
    // Unreadable or blocked storage — behave as if there were no draft.
    return null
  }
}

function writeDraft(key: string, values: DraftPayload['values']) {
  try {
    window.localStorage.setItem(
      storageKey(key),
      JSON.stringify({
        v: DRAFT_VERSION,
        savedAt: new Date().toISOString(),
        values,
      } satisfies DraftPayload),
    )
  } catch (err) {
    // Quota or blocked storage: a lost draft must never break the form.
    log.warn('could not save draft', {
      reason: err instanceof Error ? err.name : 'unknown',
    })
  }
}

export function clearDraft(key: string) {
  try {
    window.localStorage.removeItem(storageKey(key))
  } catch {
    // Nothing to clean up.
  }
}

function hasContent(values: DraftPayload['values']): boolean {
  return Boolean(
    values.codingSequence?.trim() ||
    values.proteinSequence?.trim() ||
    values.name?.trim(),
  )
}

interface UseFormDraftOptions {
  /** Draft scope — the isoform id being designed, or 'new'. */
  draftKey: string
  methods: UseFormReturn<FormValues>
  /** Off while a saved job is being resumed, so a draft can't fight it. */
  enabled: boolean
}

interface UseFormDraftReturn {
  /** True once a stored draft has been restored into the form. */
  restored: boolean
  /** Keep the restored values, just hide the notice. */
  dismiss: () => void
  /** Throw the draft away and go back to the page's defaults. */
  discard: () => void
  /** Called after a successful submit — the draft has served its purpose. */
  clear: () => void
}

/**
 * Debounced draft persistence for the design form.
 *
 * A reload used to lose a pasted CDS entirely. Values are saved to
 * localStorage under the isoform id (or 'new'), restored on mount, and
 * cleared on a successful submit or an explicit discard.
 */
export function useFormDraft({
  draftKey,
  methods,
  enabled,
}: UseFormDraftOptions): UseFormDraftReturn {
  const [restored, setRestored] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Restore once per draft key. localStorage is read in an effect, not during
  // render: the page is server-rendered, so a draft-aware first client render
  // would be a hydration mismatch.
  useEffect(() => {
    if (!enabled) return
    const draft = readDraft(draftKey)
    if (!draft || !hasContent(draft.values)) return
    const current = methods.getValues()
    methods.reset({ ...current, ...draft.values }, { keepDefaultValues: true })
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is an external system; the notice can only be decided after mount
    setRestored(true)
    // methods is stable across renders for a given form instance.
  }, [draftKey, enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced save on every change.
  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = methods.subscribe({
      formState: { values: true },
      callback: ({ values }) => {
        clearTimeout(timer)
        timer = setTimeout(() => {
          const slice: DraftPayload['values'] = {
            sequenceType: values.sequenceType,
            codingSequence: values.codingSequence,
            proteinSequence: values.proteinSequence,
            name: values.name,
            species: values.species,
            spliceJunctionPositions: values.spliceJunctionPositions,
          }
          if (hasContent(slice)) {
            writeDraft(draftKey, slice)
          } else {
            clearDraft(draftKey)
          }
        }, DEBOUNCE_MS)
      },
    })
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
    // methods is stable across renders for a given form instance.
  }, [draftKey, enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    restored: restored && !dismissed,
    dismiss: () => setDismissed(true),
    discard: () => {
      clearDraft(draftKey)
      methods.reset()
      setRestored(false)
    },
    clear: () => {
      clearDraft(draftKey)
      setRestored(false)
    },
  }
}
