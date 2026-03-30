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
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SpeciesSelect } from '@/components/header/species-select'
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

  if (filteredIsoforms.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <p className="text-muted-foreground max-w-lg text-sm">
          No isoforms available for this species. Try selecting a different
          species filter.
        </p>
        <SpeciesSelect alwaysShowLabel />
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-25">Length</TableHead>
          <TableHead className="hidden md:table-cell">Species</TableHead>
          <TableHead>
            <span className="hidden sm:inline">Ensembl Transcript ID</span>
            <span className="sm:hidden">ENST</span>
          </TableHead>
          <TableHead className="hidden sm:table-cell">
            Coding Sequence
          </TableHead>
          <TableHead className="hidden lg:table-cell">
            Protein Sequence
          </TableHead>
          <TableHead className="text-right">Customize</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredIsoforms.map((isoform) => {
          const cdsId = `cds-${isoform.id}`
          const protId = `prot-${isoform.id}`
          return (
            <TableRow key={isoform.id}>
              <TableCell className="font-mono tabular-nums">
                {isoform.codingSequenceLength}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {SPECIES_DISPLAY_NAME[
                  isoform.species as keyof typeof SPECIES_DISPLAY_NAME
                ] ?? 'Unknown'}
              </TableCell>
              <TableCell className="font-mono">{isoform.enst}</TableCell>
              <TableCell className="hidden sm:table-cell">
                <CopyableText
                  label="Copy coding sequence"
                  copied={isCopied(cdsId)}
                  onCopy={() => copy(isoform.codingSequence, cdsId)}
                >
                  {isoform.codingSequence.slice(0, 20)}...
                </CopyableText>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <CopyableText
                  label="Copy protein sequence"
                  copied={isCopied(protId)}
                  onCopy={() => copy(isoform.proteinSequence, protId)}
                >
                  {isoform.proteinSequence.slice(0, 20)}...
                </CopyableText>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" asChild>
                  <Link
                    href={`/design-tool?isoform=${isoform.id}`}
                    aria-label={`Customize ${isoform.enst}`}
                  >
                    <ExternalLink />
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          )
        })}
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
          <TableHead className="hidden md:table-cell">Species</TableHead>
          <TableHead>
            <span className="hidden sm:inline">Ensembl Transcript ID</span>
            <span className="sm:hidden">ENST</span>
          </TableHead>
          <TableHead className="hidden sm:table-cell">
            Coding Sequence
          </TableHead>
          <TableHead className="hidden lg:table-cell">
            Protein Sequence
          </TableHead>
          <TableHead className="text-right">Customize</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell colSpan={6} className="text-muted-foreground text-center">
            Loading isoforms...
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}
