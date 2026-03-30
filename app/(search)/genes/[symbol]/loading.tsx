import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-mono text-2xl font-bold">
          <Skeleton className="h-8 w-24" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <div className="text-muted-foreground text-sm font-semibold">
              Gene name
            </div>
            <div>
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-sm font-semibold">
              Ensembl Gene ID
            </div>
            <div className="font-mono">
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-sm font-semibold">
              Chromosome
            </div>
            <div className="font-mono">
              <Skeleton className="h-4 w-8" />
            </div>
          </div>
        </div>
        <Separator className="my-4" />
        <h2 className="font-bold">Isoforms</h2>
        <Skeleton className="h-8 w-24" />
      </CardContent>
    </Card>
  )
}
