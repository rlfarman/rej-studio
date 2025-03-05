import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Download, ExternalLink } from 'lucide-react'
import { getIsoformsByGene } from '@/actions'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface IsoformListProps {
  geneId: string
}

export default async function IsoformTable({ geneId }: IsoformListProps) {
  const isoforms = await getIsoformsByGene(geneId)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">Length</TableHead>
          <TableHead>Species</TableHead>
          <TableHead>ENST</TableHead>
          <TableHead className="text-right">Download</TableHead>
          <TableHead className="text-right">Customize</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isoforms?.map((isoform) => (
          <TableRow key={isoform.enst}>
            <TableCell className="font-mono">{isoform.length}</TableCell>
            <TableCell>{isoform.species}</TableCell>
            <TableCell className="font-mono">{isoform.enst}</TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="icon">
                <Download />
              </Button>
            </TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/design-tool?isoform=${isoform.id}`}>
                  <ExternalLink />
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function IsoformTableLoading() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">Length</TableHead>
          <TableHead>Species</TableHead>
          <TableHead>ENST</TableHead>
          <TableHead className="text-right">Download</TableHead>
          <TableHead className="text-right">Customize</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(5)].map((_, index) => (
          <TableRow key={index}>
            <TableCell>
              <Skeleton className="h-4 w-16 rounded" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-16 rounded" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-6 w-48 rounded" />
            </TableCell>
            <TableCell className="text-right">
              <Skeleton className="size-8 inline-block" />
            </TableCell>
            <TableCell className="text-right">
              <Skeleton className="size-8 inline-block" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
