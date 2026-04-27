import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { SpliceSliderContext } from './splice-slider-context'
import { pickDefaultSplitPoints } from '../utils/default-split-point'

const TP53_CDS =
  'ATGGAGGAGCCGCAGTCAGATCCTAGCGTCGAGCCCCCTCTGAGTCAGGAAACATTTTCAGACCTATGGAAACTACTTCCTGAAAACAACGTTCTGTCCCCCTTGCCGTCCCAAGCAATGGATGATTTGATGCTGTCCCCGGACGATATTGAACAATGGTTCACTGAAGACCCAGGTCCAGATGAAGCTCCCAGAATGCCAGAGGCTGCTCCCCCCGTGGCCCCTGCACCAGCAGCTCCTACACCGGCGGCCCCTGCACCAGCCCCCTCCTGGCCCCTGTCATCTTCTGTCCCTTCCCAGAAAACCTACCAGGGCAGCTACGGTTTCCGTCTGGGCTTCTTGCATTCTGGGACAGCCAAGTCTGTGACTTGCACGTACTCCCCTGCCCTCAACAAGATGTTTTGCCAACTGGCCAAGACCTGCCCTGTGCAGCTGTGGGTTGATTCCACACCCCCGCCCGGCACCCGCGTCCGCGCCATGGCCATCTACAAGCAGTCACAGCACATGACGGAGGTTGTGAGGCGCTGCCCCCACCATGAGCGCTGCTCAGATAGCGATGGTCTGGCCCCTCCTCAGCATCTTATCCGAGTGGAAGGAAATTTGCGTGTGGAGTATTTGGATGACAGAAACACTTTTCGACATAGTGTGGTGGTGCCCTATGAGCCGCCTGAGGTTGGCTCTGACTGTACCACCATCCACTACAACTACATGTGTAACAGTTCCTGCATGGGCGGCATGAACCGGAGGCCCATCCTCACCATCATCACACTGGAAGACTCCAGTGGTAATCTACTGGGACGGAACAGCTTTGAGGTGCGTGTTTGTGCCTGTCCTGGGAGAGACCGGCGCACAGAGGAAGAGAATCTCCGCAAGAAAGGGGAGCCTCACCACGAGCTGCCCCCAGGGAGCACTAAGCGAGCACTGCCCAACAACACCAGCTCCTCTCCCCAGCCAAAGAAGAAACCACTGGATGGAGAATATTTCACCCTTCAGATCCGTGGGCGTGAGCGCTTCGAGATGTTCCGAGAGCTGAATGAGGCCTTGGAACTCAAGGATGCCCAGGCTGGGAAGGAGCCAGGGGGGAGCAGGGCTCACTCCAGCCACCTGAAGTCCAAAAAGGGTCAGTCTACCTCCCGCCATAAAAAACTCATGTTCAAGACAGAAGGGCCTGACTCAGACTGA'

function Playground({
  sequence,
  initialPositions,
}: {
  sequence: string
  initialPositions: number[]
}) {
  const [positions, setPositions] = useState(initialPositions)
  return (
    <div className="mx-auto w-full max-w-5xl p-4">
      <SpliceSliderContext
        sequence={sequence}
        positions={positions}
        species="human"
        onPositionsChange={setPositions}
        onSelectionChange={() => {}}
      />
    </div>
  )
}

const meta = {
  title: 'DesignTool/SpliceSliderContext',
  component: Playground,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Playground>

export default meta
type Story = StoryObj<typeof meta>

export const TP53Single: Story = {
  args: {
    sequence: TP53_CDS,
    initialPositions: [Math.floor(TP53_CDS.length / 2)],
  },
}

export const TP53Dual: Story = {
  args: {
    sequence: TP53_CDS,
    initialPositions: [
      Math.floor(TP53_CDS.length / 3),
      Math.floor((TP53_CDS.length * 2) / 3),
    ],
  },
}

// Demo sequence for the triple-AAV layout case. Real candidates are
// genes like dystrophin (DMD, ~11 kb) or neurofibromin (NF1, ~8.5 kb);
// inlining one of those CDSes in a story file is unwieldy, so the demo
// stitches real TP53 fragments together into a >10 kb CDS that the
// component can render meaningfully. The exact sequence content is not
// what's being demoed — the layout, fragment-length labels, and
// auto-suggested two splices are.
const TRIPLE_AAV_DEMO_CDS = (() => {
  const tilesNeeded = Math.ceil(10000 / TP53_CDS.length)
  const body = TP53_CDS.slice(0, -3) // strip trailing stop on all but the last
  return body.repeat(tilesNeeded) + 'TGA'
})()

export const TripleAAVDemo: Story = {
  args: {
    sequence: TRIPLE_AAV_DEMO_CDS,
    initialPositions: pickDefaultSplitPoints(TRIPLE_AAV_DEMO_CDS),
  },
}
