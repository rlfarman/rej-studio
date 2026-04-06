import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SearchIcon } from 'lucide-react'

export default function GeneNotFound() {
  return (
    <div className="flex items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center font-mono text-4xl font-bold tracking-tight">
            404
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground mb-1 text-base">
            Gene not found in our database.
          </p>
          <p className="text-muted-foreground mb-6 text-sm">
            The symbol may be misspelled, or it hasn&apos;t been indexed yet.
          </p>
          <div className="flex justify-center gap-2">
            <Link href="/genes">
              <Button>
                <SearchIcon className="size-4" />
                Search Genes
              </Button>
            </Link>
            <Link href="/design-tool">
              <Button variant="outline">Enter Custom Sequence</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
