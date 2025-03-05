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
            <TableCell>
              <div className="flex justify-end">
                <button className="text-green-500 hover:text-green-700">
                  <Download />
                </button>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex justify-end">
                <Link href="/design-tool" className="mr-2">
                  <ExternalLink />
                </Link>
              </div>
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
        {[1, 2, 3, 4, 5].map((index) => (
          <TableRow key={index}>
            <TableCell>
              <Skeleton className="h-4 w-16 rounded" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-16 rounded" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-48 rounded" />
            </TableCell>
            <TableCell>
              <div className="flex justify-end">
                <Skeleton className="h-4 w-16 rounded" />
              </div>
            </TableCell>
            <TableCell>
              <div className="flex justify-end">
                <Skeleton className="h-4 w-16 rounded" />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
