'use client'

import { useEffect, useState } from 'react'
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
import { hasStartCodon, getStopCodonStatus } from '@/lib/bio/sequence-utils'
import { getSuitabilityConfig } from '@/lib/bio/design-suitability'
import type { IsoformListItem } from '@/features/gene-search/types/domain-types'
import { fetchIsoformSequences } from '@/features/gene-search/utils/use-isoform-sequence'

interface IsoformComparisonSheetProps {
  isoforms: IsoformListItem[]
  children: React.ReactNode
}

type Analysis = IsoformListItem & {
  startCodon: boolean
  stopCodon: 'present' | 'absent' | 'none'
  suitConfig: ReturnType<typeof getSuitabilityConfig>
}

export function IsoformComparisonSheet({
  isoforms,
  children,
}: IsoformComparisonSheetProps) {
  const [open, setOpen] = useState(false)
  const [analyses, setAnalyses] = useState<Analysis[] | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      const seqs = await fetchIsoformSequences(isoforms.map((i) => i.id))
      if (cancelled) return
      const result: Analysis[] = isoforms.map((iso) => {
        const seq = seqs[iso.id] ?? ''
        return {
          ...iso,
          startCodon: hasStartCodon(seq),
          stopCodon: getStopCodonStatus(seq),
          suitConfig: getSuitabilityConfig(iso.suitability),
        }
      })
      setAnalyses(result)
    })()
    return () => {
      cancelled = true
    }
  }, [open, isoforms])

  const allSame = (values: (string | number | boolean)[]) =>
    values.every((v) => v === values[0])

  function diffClass(values: (string | number | boolean)[]) {
    return allSame(values) ? '' : 'bg-muted/50'
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Compare Isoforms</SheetTitle>
          <SheetDescription>
            Side-by-side comparison of {isoforms.length} selected isoforms
          </SheetDescription>
        </SheetHeader>

        <div className="overflow-x-auto px-4">
          {analyses === null ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Loading sequences…
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-24">Property</TableHead>
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
                  values={analyses.map((a) => `${a.gcPercent.toFixed(1)}%`)}
                  diffClass={diffClass(
                    analyses.map((a) => Math.round(a.gcPercent)),
                  )}
                />
                <CompRow
                  label="Start Codon"
                  values={analyses.map((a) =>
                    a.startCodon ? 'ATG' : 'Missing',
                  )}
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
                      <Badge className={`text-xs ${a.suitConfig.badgeClass}`}>
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
          )}
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
