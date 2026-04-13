'use client'

import { DiagBadge } from '@/components/bio/diag-badge'
import { SplitBar } from '@/components/bio/split-bar'
import { GcSparkline } from '@/components/bio/gc-sparkline'
import { SpeciesIcon } from '@/components/bio/species-icon'
import { IsoformMetricsStrip } from '@/features/gene-search/components/isoform-metrics-strip'
import { IsoformValidationBadges } from '@/features/gene-search/components/isoform-validation-badges'
import {
  AavPreflight,
  AavResults,
} from '@/features/design-tool/components/aav-size-estimator'

// ── Sample data ──

// A realistic CDS fragment — human TP53 exons 5-8 region (~480 bp).
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

// ── Direct-prop components (usable with any values in MDX) ──

function DocsDiagBadge(props: {
  status: 'good' | 'warn' | 'error' | 'neutral'
  label: string
  tooltip: string
}) {
  return (
    <span className="not-prose inline-flex">
      <DiagBadge {...props} />
    </span>
  )
}

function DocsSplitBar(props: {
  fivePrimeLength: number
  threePrimeLength: number
}) {
  return (
    <div className="not-prose">
      <SplitBar {...props} />
    </div>
  )
}

function DocsSpeciesIcon(props: { species: 'human' | 'mouse' | 'both' }) {
  return (
    <span className="not-prose inline-flex">
      <SpeciesIcon {...props} />
    </span>
  )
}

function DocsAavPreflight(props: { sequenceLength: number }) {
  return (
    <span className="not-prose inline-flex">
      <AavPreflight {...props} />
    </span>
  )
}

function DocsAavResults(props: { seq5Length: number; seq3Length: number }) {
  return (
    <div className="not-prose">
      <AavResults {...props} />
    </div>
  )
}

// ── Showcase components (baked-in sample data for common patterns) ──

function DiagBadgeShowcase() {
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

function SplitBarShowcase() {
  return (
    <div className="not-prose">
      <SplitBar fivePrimeLength={1836} threePrimeLength={1920} />
    </div>
  )
}

function GcSparklineShowcase() {
  return (
    <div className="not-prose">
      <GcSparkline sequence={EXAMPLE_CDS} />
    </div>
  )
}

function MetricsStripShowcase() {
  return (
    <div className="not-prose">
      <IsoformMetricsStrip codingSequence={EXAMPLE_CDS} />
    </div>
  )
}

function ValidationBadgesShowcase() {
  return (
    <div className="not-prose">
      <IsoformValidationBadges codingSequence={EXAMPLE_CDS} />
    </div>
  )
}

function AavResultsShowcase() {
  return (
    <div className="not-prose">
      <AavResults seq5Length={1836} seq3Length={1920} />
    </div>
  )
}

export {
  // Direct-prop components
  DocsDiagBadge,
  DocsSplitBar,
  DocsSpeciesIcon,
  DocsAavPreflight,
  DocsAavResults,
  // Showcase components
  DiagBadgeShowcase,
  SplitBarShowcase,
  GcSparklineShowcase,
  MetricsStripShowcase,
  ValidationBadgesShowcase,
  AavResultsShowcase,
}
