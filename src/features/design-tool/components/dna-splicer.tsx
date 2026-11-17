import { useFormContext, useWatch } from 'react-hook-form'
import { FormValues, type SelectedWggwSite } from '../types/form-schema'
import { SpliceSliderContext } from './splice-slider-context'

// Typing rescales the split points in the sequence field's change handler
// (coding-sequence-input.tsx, rescaleSplitPoints), not here.
export function DNASplicer() {
  const { control, setValue } = useFormContext<FormValues>()
  const [watchedSequence, watchedPositions, species] = useWatch({
    control,
    name: ['codingSequence', 'spliceJunctionPositions', 'species'],
  })
  const codingSequence = watchedSequence ?? ''
  const seqLength = codingSequence.length || 1
  const positions = watchedPositions ?? []

  // These callbacks are deps of the editor's write-back effects; the React
  // Compiler keeps their identities stable while seqLength is unchanged.
  const setPositions = (next: number[]) => {
    const clamped = next.map((p) => Math.max(1, Math.min(p, seqLength - 1)))
    setValue('spliceJunctionPositions', clamped)
  }

  const setSelectedSites = (sites: (SelectedWggwSite | null)[]) => {
    setValue('selectedWggwSites', sites)
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
      onSelectionChange={setSelectedSites}
    />
  )
}
