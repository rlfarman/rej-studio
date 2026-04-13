import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { IsoformTableLoading } from '@/features/gene-search/components/isoform-table'

export default function Loading() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-28" />
        </div>
        <Skeleton className="h-4 w-64" />
        <div className="mt-1">
          <Skeleton className="h-3.5 w-44" />
        </div>
      </CardHeader>
      <CardContent>
        <Separator className="my-4" />
        <h2 className="mb-2 text-lg font-semibold tracking-tight">Isoforms</h2>
        <IsoformTableLoading />
      </CardContent>
    </Card>
  )
}
