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
import { SPECIES_DISPLAY_NAME } from '@/lib/species'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { AnimatePresence, motion } from 'motion/react'

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

function CopyableSequence({
  sequence,
  id,
  label,
  copy,
  isCopied,
}: {
  sequence: string
  id: string
  label: string
  copy: (text: string, id: string) => void
  isCopied: (id: string) => boolean
}) {
  const copied = isCopied(id)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className="hover:text-muted-foreground inline-flex items-center gap-1.5 hover:underline"
          onClick={() => copy(sequence, id)}
          aria-label={label}
        >
          <AnimatePresence mode="wait" initial={false}>
            {copied ? (
              <motion.span
                key="check"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.15 }}
              >
                <Check className="text-chart-2 size-3.5" />
              </motion.span>
            ) : (
              <motion.span
                key="text"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <span className="hidden sm:inline">
                  {sequence.slice(0, 20)}...
                </span>
                <span className="sm:hidden">
                  {sequence.slice(0, 10)}...
                </span>
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </TooltipTrigger>
      <TooltipContent>Click to copy</TooltipContent>
    </Tooltip>
  )
}

export default function IsoformTable({ isoforms }: IsoformListProps) {
  const { species } = useSpeciesContext()
  const { copy, isCopied } = useCopyToClipboard({
    successMessage: 'Sequence copied to clipboard!',
  })

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
                <CopyableSequence
                  sequence={isoform.codingSequence}
                  id={`cds-${isoform.id}`}
                  label="Copy coding sequence"
                  copy={copy}
                  isCopied={isCopied}
                />
              </TableCell>
              <TableCell>
                <CopyableSequence
                  sequence={isoform.proteinSequence}
                  id={`prot-${isoform.id}`}
                  label="Copy protein sequence"
                  copy={copy}
                  isCopied={isCopied}
                />
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
