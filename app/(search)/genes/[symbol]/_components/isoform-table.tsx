'use client'
import { useCallback, useMemo, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ExternalLink, Check } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useSpeciesContext } from '@/context/species-context'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { SPECIES_DISPLAY_NAME } from '@/lib/species'

interface Isoform {
  id: string
  enst: string
  codingSequence: string
  proteinSequence: string
  codingSequenceLength: number
  species: string
}

interface IsoformListProps {
  isoforms: Isoform[]
}

export default function IsoformTable({ isoforms }: IsoformListProps) {
  const { species } = useSpeciesContext()

  const filteredIsoforms = useMemo(
    () =>
      isoforms.filter((isoform) => {
        if (!species || species === 'both') return true
        return isoform.species.toLowerCase() === species
      }),
    [species, isoforms],
  )

  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopy = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      toast.success('Sequence copied to clipboard!')
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      toast.error('Failed to copy to clipboard.')
    }
  }, [])

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">Length</TableHead>
          <TableHead>Species</TableHead>
          <TableHead>
            <span className="hidden sm:inline">Ensembl Transcript ID</span>
            <span className="sm:hidden">ENST</span>
          </TableHead>
          <TableHead>Coding Sequence</TableHead>
          <TableHead>Protein Sequence</TableHead>
          <TableHead className="text-right">Customize</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredIsoforms.length > 0 ? (
          filteredIsoforms.map((isoform) => (
            <TableRow key={isoform.id}>
              <TableCell className="font-mono">
                {isoform.codingSequenceLength}
              </TableCell>
              <TableCell>
                {SPECIES_DISPLAY_NAME[isoform.species as keyof typeof SPECIES_DISPLAY_NAME] ?? 'Unknown'}
              </TableCell>
              <TableCell className="font-mono">{isoform.enst}</TableCell>
              <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="hover:text-muted-foreground inline-flex items-center gap-1.5 hover:underline"
                      onClick={() => handleCopy(isoform.codingSequence, `cds-${isoform.id}`)}
                      aria-label="Copy coding sequence"
                    >
                      {copiedId === `cds-${isoform.id}` ? (
                        <Check className="text-chart-2 size-3.5 animate-check-draw" />
                      ) : (
                        <>
                          <span className="hidden sm:inline">
                            {isoform.codingSequence.slice(0, 20)}...
                          </span>
                          <span className="sm:hidden">
                            {isoform.codingSequence.slice(0, 10)}...
                          </span>
                        </>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Click to copy</TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleCopy(isoform.proteinSequence, `prot-${isoform.id}`)}
                      className="hover:text-muted-foreground inline-flex items-center gap-1.5 hover:underline"
                      aria-label="Copy protein sequence"
                    >
                      {copiedId === `prot-${isoform.id}` ? (
                        <Check className="text-chart-2 size-3.5 animate-check-draw" />
                      ) : (
                        <>
                          <span className="hidden sm:inline">
                            {isoform.proteinSequence.slice(0, 20)}...
                          </span>
                          <span className="sm:hidden">
                            {isoform.proteinSequence.slice(0, 10)}...
                          </span>
                        </>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Click to copy</TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" asChild>
                  <Link href={`/design-tool?isoform=${isoform.id}`}>
                    <ExternalLink />
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell
              colSpan={6}
              className="text-muted-foreground text-center"
            >
              No isoforms found for the selected species.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}

export function IsoformTableLoading() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Length</TableHead>
          <TableHead>Species</TableHead>
          <TableHead>
            <span className="hidden sm:inline">Ensembl Transcript ID</span>
            <span className="sm:hidden">ENST</span>
          </TableHead>
          <TableHead>Coding Sequence</TableHead>
          <TableHead>Protein Sequence</TableHead>
          <TableHead className="text-right">Customize</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(3)].map((_, index) => (
          <TableRow key={index}>
            <TableCell>
              <Skeleton className="h-4 w-8 rounded" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-8 rounded" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-24 rounded" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-24 rounded" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-24 rounded" />
            </TableCell>
            <TableCell className="text-right">
              <Skeleton className="inline-block h-8 w-8 rounded-full" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
