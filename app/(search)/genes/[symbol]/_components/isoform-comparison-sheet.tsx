'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet'
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
import { ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { SPECIES_DISPLAY_NAME } from '@/lib/species'
import { computeGcPercent, hasStartCodon, getStopCodonStatus } from '@/lib/sequence-utils'
import {
  assessDesignSuitability,
  getSuitabilityConfig,
} from '@/lib/design-suitability'
import type { IsoformListItem } from '@/lib/domain-types'

interface IsoformComparisonSheetProps {
  isoforms: IsoformListItem[]
  children: React.ReactNode
}

const SUITABILITY_VARIANT_MAP = {
  single: 'default',
  dual: 'secondary',
  triple: 'destructive',
} as const

export function IsoformComparisonSheet({
  isoforms,
  children,
}: IsoformComparisonSheetProps) {
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
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Compare Isoforms</SheetTitle>
          <SheetDescription>
            Side-by-side comparison of {isoforms.length} selected isoforms
          </SheetDescription>
        </SheetHeader>

        <div className="overflow-x-auto px-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-24">Property</TableHead>
                {analyses.map((iso) => (
                  <TableHead key={iso.id} className="min-w-28 font-mono text-xs">
                    {iso.id}
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
      </SheetContent>
    </Sheet>
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
