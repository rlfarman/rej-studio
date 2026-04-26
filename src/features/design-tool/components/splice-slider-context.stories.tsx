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

// Synthetic >10 kb CDS (TP53 tiled) to exercise the AAV-overflow flow:
// pickDefaultSplitPoints auto-suggests two splices and the segment labels
// flag any fragment that exceeds the AAV packaging limit.
const TRIPLE_CDS = (() => {
  const repeats = Math.ceil(10000 / TP53_CDS.length)
  // Strip the trailing stop codon from all but the last copy so the result
  // still parses as a single CDS.
  const body = TP53_CDS.slice(0, -3)
  return body.repeat(repeats) + 'TGA'
})()

export const TripleAAV: Story = {
  args: {
    sequence: TRIPLE_CDS,
    initialPositions: pickDefaultSplitPoints(TRIPLE_CDS),
  },
}
