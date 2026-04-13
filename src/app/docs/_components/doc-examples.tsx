'use client'

import { DiagBadge } from '@/components/bio/diag-badge'
import { SplitBar } from '@/components/bio/split-bar'
import { GcSparkline } from '@/components/bio/gc-sparkline'
import { IsoformMetricsStrip } from '@/features/gene-search/components/isoform-metrics-strip'
import { IsoformValidationBadges } from '@/features/gene-search/components/isoform-validation-badges'
import { AavResults } from '@/features/design-tool/components/aav-size-estimator'

// A short realistic CDS fragment — human TP53 exons 5-8 region (~480 bp).
// Starts with ATG, ends with TAA, length is a multiple of 3.
const EXAMPLE_CDS =
  'ATGGAGGAGCCGCAGTCAGATCCTAGCGTGAGTTTGCACAAGATCCGTGGGCGTGAG' +
  'CGCTTTGAGGTGCGTGTTTGTGCCTGTCCTGGGAGAGACCGGCGCACAGAGGAAGAG' +
  'AATCTCCGCAAGAAAGGGGAGCCTCACCACGAGCTGCCCCCAGGGAGCACTAAGCGAG' +
  'CACTGCCCAACAACACCAGCTCCTCTCCCCAGCCAAAGAAGAAACCACTGGATGGAGAA' +
  'TATTTCACCCTTCAGATCCGTGGGCGTGAGCGCTTTGAGGTGCGTGTTTGTGCCTGTC' +
  'CTGGGAGAGACCGGCGCACAGAGGAAGAGAATCTCCGCAAGAAAGGGGAGCCTCACCAC' +
  'GAGCTGCCCCCAGGGAGCACTAAGCGAGCACTGCCCAACAACACCAGCTCCTCTCCCCAG' +
  'CCAAAGAAGAAACCACTGGATGGAGAATATTTCACCCTTCAGATTAA'

/**
 * Row of diagnostic badges showing good / warn / error states.
 */
export function DiagBadgeShowcase() {
  return (
    <div className="not-prose flex flex-wrap gap-2">
      <DiagBadge
        status="good"
        label="GC 48.2%"
        tooltip="GC content is in the optimal 35–60% range."
      />
      <DiagBadge
        status="good"
        label="Start: ATG"
        tooltip="Sequence begins with ATG start codon."
      />
      <DiagBadge
        status="good"
        label="Stop: TAA"
        tooltip="Sequence ends with TAA stop codon."
      />
      <DiagBadge
        status="warn"
        label="CpG: 24"
        tooltip="CpG count is moderate — consider enabling CpG minimization."
      />
      <DiagBadge
        status="neutral"
        label="1,182 bp / 393 aa"
        tooltip="Sequence length in base pairs and amino acids."
      />
    </div>
  )
}

/**
 * Split bar showing a balanced 5'/3' fragment split.
 */
export function SplitBarShowcase() {
  return (
    <div className="not-prose">
      <SplitBar fivePrimeLength={1836} threePrimeLength={1920} />
    </div>
  )
}

/**
 * GC sparkline with a realistic sequence.
 */
export function GcSparklineShowcase() {
  return (
    <div className="not-prose">
      <GcSparkline sequence={EXAMPLE_CDS} />
    </div>
  )
}

/**
 * Metrics strip showing length, GC%, CpG, WGGW count, AAV strategy.
 */
export function MetricsStripShowcase() {
  return (
    <div className="not-prose">
      <IsoformMetricsStrip codingSequence={EXAMPLE_CDS} />
    </div>
  )
}

/**
 * Validation badges showing pass/fail checks for a CDS.
 */
export function ValidationBadgesShowcase() {
  return (
    <div className="not-prose">
      <IsoformValidationBadges codingSequence={EXAMPLE_CDS} />
    </div>
  )
}

/**
 * AAV packaging estimate for optimized 5'/3' fragments.
 */
export function AavResultsShowcase() {
  return (
    <div className="not-prose">
      <AavResults seq5Length={1836} seq3Length={1920} />
    </div>
  )
}
