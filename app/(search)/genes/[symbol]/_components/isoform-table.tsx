'use client'
import { useEffect, useState } from 'react'
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
import { useSpecies } from '../../../../_hooks/use-species'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner' // Import the toast function

const SPECIES_DISPLAY_NAME: Record<string, string> = {
  human: 'Human',
  mouse: 'Mouse',
}

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
  const species = useSpecies()
  const [filteredIsoforms, setFilteredIsoforms] = useState<Isoform[]>([])

  useEffect(() => {
    // Filter isoforms based on the selected species
    const filtered = isoforms.filter((isoform) => {
      if (species === 'both') return true
      return isoform.species.toLowerCase() === species
    })
    setFilteredIsoforms(filtered)
  }, [species, isoforms])

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Sequence copied to clipboard!') // Show success toast
  }

  if (!species) {
    return <IsoformTableLoading />
  }

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
          {/* <TableHead className="text-right">Download</TableHead> */}
          <TableHead className="text-right">Customize</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredIsoforms.length > 0 ? (
          filteredIsoforms.map((isoform) => (
            <TableRow key={isoform.enst}>
              <TableCell className="font-mono">
                {isoform.codingSequenceLength}
              </TableCell>
              <TableCell>
                {SPECIES_DISPLAY_NAME[isoform.species] ?? 'Unknown'}
              </TableCell>
              <TableCell className="font-mono">{isoform.enst}</TableCell>
              <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="hover:text-muted-foreground hover:underline"
                      onClick={() => handleCopy(isoform.codingSequence)}
                    >
                      <span className="hidden sm:inline">
                        {isoform.codingSequence.slice(0, 20)}...
                      </span>
                      <span className="sm:hidden">
                        {isoform.codingSequence.slice(0, 10)}...
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Click to copy</TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleCopy(isoform.proteinSequence)}
                      className="hover:text-muted-foreground hover:underline"
                    >
                      <span className="hidden sm:inline">
                        {isoform.proteinSequence.slice(0, 20)}...
                      </span>
                      <span className="sm:hidden">
                        {isoform.proteinSequence.slice(0, 10)}...
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Click to copy</TooltipContent>
                </Tooltip>
              </TableCell>
              {/* <TableCell className="text-right">
                  <Button variant="ghost" size="icon">
                    <Download />
                  </Button>
                </TableCell> */}
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
              colSpan={7}
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
          <TableHead className="text-right">Download</TableHead>
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
            {/* <TableCell className="text-right">
              <Skeleton className="inline-block h-8 w-8 rounded-full" />
            </TableCell> */}
            <TableCell className="text-right">
              <Skeleton className="inline-block h-8 w-8 rounded-full" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
