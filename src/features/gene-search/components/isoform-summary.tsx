import { Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { downloadTextFile } from '@/lib/download-file'
import {
  assessDesignSuitability,
  getSuitabilityConfig,
  type Suitability,
} from '@/lib/bio/design-suitability'
import type { IsoformListItem } from '@/features/gene-search/types/domain-types'
import {
  buildIsoformsFasta,
  isoformsFastaFilename,
} from '@/features/gene-search/utils/isoform-fasta'
import { TermHint } from '@/components/term-hint'
import { geneSearchCopy } from '../copy'

const copy = geneSearchCopy.summary
const terms = geneSearchCopy.terms
const tableCopy = geneSearchCopy.isoformTable

interface IsoformSummaryProps {
  geneSymbol: string
  isoforms: IsoformListItem[]
}

const SUITABILITY_ORDER: Suitability[] = [
  'single-aav',
  'dual-aav',
  'triple-aav',
]

export function IsoformSummary({ geneSymbol, isoforms }: IsoformSummaryProps) {
  if (isoforms.length === 0) return null

  const lengths = isoforms.map((i) => i.codingSequenceLength)
  const stats = {
    shortest: Math.min(...lengths),
    longest: Math.max(...lengths),
  }

  const counts: Record<Suitability, number> = {
    'single-aav': 0,
    'dual-aav': 0,
    'triple-aav': 0,
  }
  for (const i of isoforms) {
    counts[assessDesignSuitability(i.codingSequence)]++
  }

  const downloadAll = () => {
    downloadTextFile(
      isoformsFastaFilename(geneSymbol),
      buildIsoformsFasta(geneSymbol, isoforms),
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
      <Stat label={copy.isoforms} value={String(isoforms.length)} />
      <Stat
        label={copy.cdsRange}
        value={
          stats.shortest === stats.longest
            ? `${stats.longest.toLocaleString()} bp`
            : `${stats.shortest.toLocaleString()}–${stats.longest.toLocaleString()} bp`
        }
      />
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">{copy.aavFit}</span>
        {/* Counts are spelled out with their tier name; the dot is only a
            supporting cue, so meaning doesn't depend on telling colors apart. */}
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
          {SUITABILITY_ORDER.filter((s) => counts[s] > 0).map((s) => {
            const cfg = getSuitabilityConfig(s)
            return (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span
                  className={cn('size-1.5 rounded-full', cfg.dotClass)}
                  aria-hidden="true"
                />
                <span className="font-medium">{counts[s]}</span>
                <span className={cfg.textClass}>{cfg.label}</span>
              </span>
            )
          })}
        </span>
        <TermHint
          topic={terms.suitability.label}
          hint={terms.suitability.hint}
        />
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="ml-auto"
        onClick={downloadAll}
        aria-label={tableCopy.downloadAllFastaAria(isoforms.length)}
      >
        <Download className="size-4" />
        {tableCopy.downloadAllFasta}
      </Button>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium whitespace-nowrap tabular-nums">
        {value}
      </span>
    </div>
  )
}
