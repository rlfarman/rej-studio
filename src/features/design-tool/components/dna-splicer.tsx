import { useFormContext, useWatch } from 'react-hook-form'
import type { FormValues, RewritePick } from '../types/form-schema'
import { SpliceSliderContext } from './splice-slider-context'

// Typing rescales the split points in the sequence field's change handler
// (coding-sequence-input.tsx, rescaleSplitPoints), not here.
export function DNASplicer() {
  const { control, getValues, setValue } = useFormContext<FormValues>()
  const [watchedSequence, watchedPositions, species, sitePicks, rewritePicks] =
    useWatch({
      control,
      name: [
        'codingSequence',
        'spliceJunctionPositions',
        'species',
        'wggwSitePicks',
        'wggwRewritePicks',
      ],
    })
  const codingSequence = watchedSequence ?? ''
  const seqLength = codingSequence.length || 1
  const positions = watchedPositions ?? []

  // A dep of the editor's position write-back effect; the React Compiler
  // keeps its identity stable while seqLength is unchanged.
  const setPositions = (next: number[]) => {
    const clamped = next.map((p) => Math.max(1, Math.min(p, seqLength - 1)))
    setValue('spliceJunctionPositions', clamped)
  }

  // The picks are only written from the editor's event handlers. The
  // updaters read the form's latest value, not the rendered one, so a
  // handler's successive updates build on each other.
  const updateSitePicks = (
    update: (prev: (number | null)[]) => (number | null)[],
  ) => {
    setValue('wggwSitePicks', update(getValues('wggwSitePicks') ?? []))
  }
  const updateRewritePicks = (
    update: (prev: RewritePick[]) => RewritePick[],
  ) => {
    setValue('wggwRewritePicks', update(getValues('wggwRewritePicks') ?? []))
  }

  if (codingSequence.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-3 py-2 text-xs text-muted-foreground">
        Add a coding sequence above to configure the split point.
      </p>
    )
  }

  return (
    <SpliceSliderContext
      sequence={codingSequence}
      positions={positions.length ? positions : [Math.floor(seqLength / 2)]}
      species={species ?? 'none'}
      onPositionsChange={setPositions}
      sitePicks={sitePicks ?? []}
      rewritePicks={rewritePicks ?? []}
      onSitePicksChange={updateSitePicks}
      onRewritePicksChange={updateRewritePicks}
    />
  )
}
