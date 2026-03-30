import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export default function Loading() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground font-mono text-2xl font-bold">
          Loading...
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <div className="text-muted-foreground text-sm font-semibold">
              Gene name
            </div>
            <div className="text-muted-foreground/60 text-sm">&mdash;</div>
          </div>
          <div>
            <div className="text-muted-foreground text-sm font-semibold">
              Ensembl Gene ID
            </div>
            <div className="text-muted-foreground/60 font-mono text-sm">&mdash;</div>
          </div>
          <div>
            <div className="text-muted-foreground text-sm font-semibold">
              Chromosome
            </div>
            <div className="text-muted-foreground/60 font-mono text-sm">&mdash;</div>
          </div>
        </div>
        <Separator className="my-4" />
        <h2 className="font-bold">Isoforms</h2>
        <p className="text-muted-foreground text-sm">Loading...</p>
      </CardContent>
    </Card>
  )
}
