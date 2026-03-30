'use client'
import { useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ExternalLink } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useSpeciesContext } from '@/context/species-context'
import { SPECIES_DISPLAY_NAME } from '@/lib/species'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { CopyableText } from '@/components/copyable-text'

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
  const { copy, isCopied } = useCopyToClipboard({ showToast: false })

  const filteredIsoforms = useMemo(
    () =>
      isoforms.filter((isoform) => {
        if (!species || species === 'both') return true
        return isoform.species.toLowerCase() === species
      }),
    [species, isoforms],
  )

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
          filteredIsoforms.map((isoform) => {
            const cdsId = `cds-${isoform.id}`
            const protId = `prot-${isoform.id}`
            return (
              <TableRow key={isoform.id}>
                <TableCell className="font-mono">
                  {isoform.codingSequenceLength}
                </TableCell>
                <TableCell>
                  {SPECIES_DISPLAY_NAME[isoform.species as keyof typeof SPECIES_DISPLAY_NAME] ?? 'Unknown'}
                </TableCell>
                <TableCell className="font-mono">{isoform.enst}</TableCell>
                <TableCell>
                  <CopyableText
                    label="Copy coding sequence"
                    copied={isCopied(cdsId)}
                    onCopy={() => copy(isoform.codingSequence, cdsId)}
                  >
                    <span className="hidden sm:inline">
                      {isoform.codingSequence.slice(0, 20)}...
                    </span>
                    <span className="sm:hidden">
                      {isoform.codingSequence.slice(0, 10)}...
                    </span>
                  </CopyableText>
                </TableCell>
                <TableCell>
                  <CopyableText
                    label="Copy protein sequence"
                    copied={isCopied(protId)}
                    onCopy={() => copy(isoform.proteinSequence, protId)}
                  >
                    <span className="hidden sm:inline">
                      {isoform.proteinSequence.slice(0, 20)}...
                    </span>
                    <span className="sm:hidden">
                      {isoform.proteinSequence.slice(0, 10)}...
                    </span>
                  </CopyableText>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/design-tool?isoform=${isoform.id}`}>
                      <ExternalLink />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            )
          })
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
