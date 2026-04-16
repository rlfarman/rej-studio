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
import { SPECIES_DISPLAY_NAME } from '@/lib/bio/species'
import {
  computeGcPercent,
  hasStartCodon,
  getStopCodonStatus,
} from '@/lib/bio/sequence-utils'
import {
  assessDesignSuitability,
  getSuitabilityConfig,
} from '@/lib/bio/design-suitability'
import type { IsoformListItem } from '@/features/gene-search/types/domain-types'
import { geneSearchCopy } from '@/features/gene-search/copy'

const compareCopy = geneSearchCopy.compare

interface IsoformComparisonSheetProps {
  isoforms: IsoformListItem[]
  children: React.ReactNode
}

const SUITABILITY_VARIANT_MAP = {
  'single-aav': 'default',
  'dual-aav': 'secondary',
  'triple-aav': 'destructive',
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
          <SheetTitle>{compareCopy.title}</SheetTitle>
          <SheetDescription>
            {compareCopy.description(isoforms.length)}
          </SheetDescription>
        </SheetHeader>

        <div className="overflow-x-auto px-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-24">
                  {compareCopy.property}
                </TableHead>
                {analyses.map((iso) => (
                  <TableHead
                    key={iso.id}
                    className="min-w-28 font-mono text-xs"
                  >
                    {iso.id}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <CompRow
                label={compareCopy.rows.species}
                values={analyses.map(
                  (a) =>
                    SPECIES_DISPLAY_NAME[
                      a.species as keyof typeof SPECIES_DISPLAY_NAME
                    ] ?? compareCopy.values.unknown,
                )}
                diffClass={diffClass(analyses.map((a) => a.species))}
              />
              <CompRow
                label={compareCopy.rows.cdsLength}
                values={analyses.map(
                  (a) => `${a.codingSequenceLength.toLocaleString()} bp`,
                )}
                diffClass={diffClass(
                  analyses.map((a) => a.codingSequenceLength),
                )}
              />
              <CompRow
                label={compareCopy.rows.proteinLength}
                values={analyses.map(
                  (a) => `${a.proteinSequenceLength.toLocaleString()} aa`,
                )}
                diffClass={diffClass(
                  analyses.map((a) => a.proteinSequenceLength),
                )}
              />
              <CompRow
                label={compareCopy.rows.gcContent}
                values={analyses.map((a) => `${a.gc.toFixed(1)}%`)}
                diffClass={diffClass(analyses.map((a) => Math.round(a.gc)))}
              />
              <CompRow
                label={compareCopy.rows.startCodon}
                values={analyses.map((a) =>
                  a.startCodon
                    ? compareCopy.values.startAtg
                    : compareCopy.values.missing,
                )}
                diffClass={diffClass(analyses.map((a) => a.startCodon))}
              />
              <CompRow
                label={compareCopy.rows.stopCodon}
                values={analyses.map((a) =>
                  a.stopCodon === 'present'
                    ? compareCopy.values.present
                    : compareCopy.values.missing,
                )}
                diffClass={diffClass(analyses.map((a) => a.stopCodon))}
              />
              <TableRow>
                <TableCell className="text-muted-foreground text-xs font-semibold">
                  {compareCopy.rows.suitability}
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
                  {compareCopy.rows.design}
                </TableCell>
                {analyses.map((a) => (
                  <TableCell key={a.id}>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/design-tool?isoform=${a.id}`}>
                        <ExternalLink className="size-3.5" />
                        {compareCopy.designAction}
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
        <TableCell
          key={i}
          className={`font-mono text-xs tabular-nums ${diffClass}`}
        >
          {v}
        </TableCell>
      ))}
    </TableRow>
  )
}
