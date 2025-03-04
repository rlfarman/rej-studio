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
            <TableCell className="font-medium">{isoform.length}</TableCell>
            <TableCell>{isoform.species}</TableCell>
            <TableCell>{isoform.enst}</TableCell>
            <TableCell className="text-right">
              <button className="text-green-500 hover:text-green-700">
                <Download />
              </button>
            </TableCell>
            <TableCell className="text-right">
              <button className="mr-2">
                <ExternalLink />
              </button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
