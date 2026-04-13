import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { IsoformTableLoading } from '@/features/gene-search/components/isoform-table'

export default function Loading() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4">
        <Skeleton className="h-8 w-28" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <div className="text-muted-foreground text-sm font-semibold">
              Gene name
            </div>
            <Skeleton className="mt-1 h-5 w-48" />
          </div>
          <div>
            <div className="text-muted-foreground text-sm font-semibold">
              Ensembl Gene ID
            </div>
            <Skeleton className="mt-1 h-5 w-40" />
          </div>
        </div>
        <Separator className="my-4" />
        <h2 className="mb-2 text-lg font-semibold tracking-tight">Isoforms</h2>
        <IsoformTableLoading />
      </CardContent>
    </Card>
  )
}
