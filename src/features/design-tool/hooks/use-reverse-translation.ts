import { useEffect, useState } from 'react'
import { useFormContext, useWatch, type UseFormSetValue } from 'react-hook-form'

import { reverseTranslateInBrowser } from '@/features/design-tool/api/browser-optimizer'
import type { FormValues } from '@/features/design-tool/types/form-schema'
import { pickDefaultSplitPoints } from '@/features/design-tool/utils/default-split-point'
import { isSpecies, type Species } from '@/lib/bio/species'

/**
 * How long the protein field rests before the optimizer is asked.
 *
 * Long enough that typing or pasting a 2,000-residue protein does not post a
 * message per keystroke, short enough that it feels immediate once the user
 * stops.
 */
const DEBOUNCE_MS = 350

export interface ReverseTranslationState {
  /** A translation is on its way; there is no DNA to show yet. */
  pending: boolean
  /** Why the last attempt failed, if it did. */
  error: string | null
}

/** Put a reverse-translated sequence into the form, with its split points. */
function applyReverseTranslatedDna(
  setValue: UseFormSetValue<FormValues>,
  dna: string,
) {
  const points = pickDefaultSplitPoints(dna)
  setValue('codingSequence', dna, { shouldValidate: false })
  setValue('spliceJunctionPositions', points, { shouldValidate: false })
  setValue(
    'selectedWggwSites',
    points.map(() => null),
    { shouldValidate: false },
  )
}

/**
 * Keep `codingSequence` in step with a protein sequence and species.
 *
 * The codon tables live in the Rust crate, so the DNA comes from the
 * optimizer worker — which `useJob` warms when the form mounts — rather than
 * from a table in this bundle. That makes it asynchronous, and the form must
 * stay usable meanwhile: the request is debounced, and the stale DNA is
 * cleared as soon as the protein changes so nothing downstream (the splice
 * slider, the diagnostics, a submission) works from a sequence that no longer
 * matches what is on screen.
 */
export function useReverseTranslation(): ReverseTranslationState {
  const { control, setValue } = useFormContext<FormValues>()
  const [sequenceType, proteinSequence, species] = useWatch({
    control,
    name: ['sequenceType', 'proteinSequence', 'species'],
  })
  const [state, setState] = useState<ReverseTranslationState>({
    pending: false,
    error: null,
  })

  const protein = (proteinSequence ?? '').toUpperCase().replace(/\s/g, '')
  const translatable =
    sequenceType === 'protein' && protein.length > 0 && isSpecies(species ?? '')

  useEffect(() => {
    // In DNA mode the coding sequence is the user's own input; leave it be.
    if (sequenceType !== 'protein') return
    if (!translatable) {
      setState({ pending: false, error: null }) // eslint-disable-line react-hooks/set-state-in-effect
      return
    }

    // Pending, not stale: the DNA on screen must never belong to a different
    // protein than the one in the field.
    setValue('codingSequence', '', { shouldValidate: false })
    setState({ pending: true, error: null })

    const controller = new AbortController()
    const timer = setTimeout(() => {
      void reverseTranslateInBrowser(protein, species as Species, {
        signal: controller.signal,
      }).then((outcome) => {
        if (controller.signal.aborted) return
        if (!outcome.ok) {
          setState({ pending: false, error: outcome.message })
          return
        }
        applyReverseTranslatedDna(setValue, outcome.CDS)
        setState({ pending: false, error: null })
      })
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [sequenceType, protein, species, translatable, setValue])

  return state
}
