'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, X } from 'lucide-react'
import Link from 'next/link'
import { SPECIES_DISPLAY_NAME } from '@/lib/species'
import { computeGcPercent, hasStartCodon, getStopCodonStatus } from '@/lib/sequence-utils'
import {
  assessDesignSuitability,
  getSuitabilityConfig,
} from '@/lib/design-suitability'
import type { IsoformListItem } from '@/lib/domain-types'

interface IsoformComparisonPanelProps {
  isoforms: IsoformListItem[]
  onClose: () => void
}

const SUITABILITY_VARIANT_MAP = {
  easy: 'default',
  moderate: 'secondary',
  complex: 'outline',
  oversized: 'destructive',
} as const

export function IsoformComparisonPanel({
  isoforms,
  onClose,
}: IsoformComparisonPanelProps) {
  if (isoforms.length === 0) return null

  const analyses = isoforms.map((iso) => {
    const suitability = assessDesignSuitability(iso.codingSequence)
    return {
      ...iso,
      gc: computeGcPercent(iso.codingSequence),
      startCodon: hasStartCodon(iso.codingSequence),
      stopCodon: getStopCodonStatus(iso.codingSequence),
      suitability,
      suitConfig: getSuitabilityConfig(suitability),
    }
  })

  const allSame = (values: (string | number | boolean)[]) =>
    values.every((v) => v === values[0])

  function diffClass(values: (string | number | boolean)[]) {
    return allSame(values) ? '' : 'bg-muted/50'
  }

  return (
    <div className="border-l flex flex-col min-w-[280px] max-w-sm shrink-0">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">Compare Isoforms</h3>
          <p className="text-muted-foreground text-xs">
            {isoforms.length} selected
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onClose}
          aria-label="Close comparison"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="overflow-y-auto overflow-x-auto flex-1 px-2 py-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-20 text-xs">Property</TableHead>
              {analyses.map((iso) => (
                <TableHead key={iso.id} className="min-w-24 font-mono text-xs">
                  {iso.enst}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <CompRow
              label="Species"
              values={analyses.map(
                (a) =>
                  SPECIES_DISPLAY_NAME[
                    a.species as keyof typeof SPECIES_DISPLAY_NAME
                  ] ?? 'Unknown',
              )}
              diffClass={diffClass(analyses.map((a) => a.species))}
            />
            <CompRow
              label="CDS Length"
              values={analyses.map(
                (a) => `${a.codingSequenceLength.toLocaleString()} bp`,
              )}
              diffClass={diffClass(
                analyses.map((a) => a.codingSequenceLength),
              )}
            />
            <CompRow
              label="Protein Length"
              values={analyses.map(
                (a) => `${a.proteinSequenceLength.toLocaleString()} aa`,
              )}
              diffClass={diffClass(
                analyses.map((a) => a.proteinSequenceLength),
              )}
            />
            <CompRow
              label="GC Content"
              values={analyses.map((a) => `${a.gc.toFixed(1)}%`)}
              diffClass={diffClass(
                analyses.map((a) => Math.round(a.gc)),
              )}
            />
            <CompRow
              label="Start Codon"
              values={analyses.map((a) => (a.startCodon ? 'ATG' : 'Missing'))}
              diffClass={diffClass(analyses.map((a) => a.startCodon))}
            />
            <CompRow
              label="Stop Codon"
              values={analyses.map((a) =>
                a.stopCodon === 'present' ? 'Present' : 'Missing',
              )}
              diffClass={diffClass(analyses.map((a) => a.stopCodon))}
            />
            <TableRow>
              <TableCell className="text-muted-foreground text-xs font-semibold">
                Suitability
              </TableCell>
              {analyses.map((a) => (
                <TableCell
                  key={a.id}
                  className={diffClass(analyses.map((x) => x.suitability))}
                >
                  <Badge
                    variant={SUITABILITY_VARIANT_MAP[a.suitability]}
                    className="text-xs"
                  >
                    {a.suitConfig.label}
                  </Badge>
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground text-xs font-semibold">
                Design
              </TableCell>
              {analyses.map((a) => (
                <TableCell key={a.id}>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/design-tool?isoform=${a.id}`}>
                      <ExternalLink className="size-3.5" />
                      Design
                    </Link>
                  </Button>
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function CompRow({
  label,
  values,
  diffClass,
}: {
  label: string
  values: string[]
  diffClass: string
}) {
  return (
    <TableRow>
      <TableCell className="text-muted-foreground text-xs font-semibold">
        {label}
      </TableCell>
      {values.map((v, i) => (
        <TableCell key={i} className={`font-mono text-xs tabular-nums ${diffClass}`}>
          {v}
        </TableCell>
      ))}
    </TableRow>
  )
}
