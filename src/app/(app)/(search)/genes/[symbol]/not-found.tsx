import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SearchIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { SpeciesIcon } from '@/components/bio/species-icon'
import { findSimilarSymbols } from '@/lib/content/server'

/**
 * Gene not-found page. Renders fuzzy "did you mean?" suggestions when the
 * symbol looks close to existing genes in the database.
 */
export default async function GeneNotFound() {
  // notFound() pages don't receive route params, but we can extract the
  // symbol from the request URL via headers.
  const { headers } = await import('next/headers')
  const hdrs = await headers()
  const url = hdrs.get('x-next-url') ?? hdrs.get('x-invoke-path') ?? ''
  const symbolMatch = url.match(/\/genes\/([^/?]+)/)
  const symbol = symbolMatch ? decodeURIComponent(symbolMatch[1]) : null

  const suggestions = symbol
    ? await findSimilarSymbols(symbol.trim().toUpperCase().slice(0, 20))
    : []

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
            {symbol ? (
              <>
                Gene &ldquo;
                <span className="font-mono font-semibold">{symbol}</span>&rdquo;
                not found.
              </>
            ) : (
              'Gene not found in our database.'
            )}
          </p>
          <p className="text-muted-foreground mb-6 text-sm">
            The symbol may be misspelled, or it hasn&apos;t been indexed yet.
          </p>

          {suggestions.length > 0 && (
            <div className="mb-6">
              <p className="text-muted-foreground mb-2 text-sm font-medium">
                Did you mean?
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((gene) => (
                  <Link
                    key={`${gene.symbol}-${gene.species}`}
                    href={`/genes/${gene.symbol}?species=${gene.species}`}
                  >
                    <Badge
                      variant="secondary"
                      className="hover:bg-accent cursor-pointer gap-1.5 px-3 py-1.5 text-sm"
                    >
                      <SpeciesIcon
                        species={gene.species}
                        className="h-3.5 w-3.5"
                      />
                      {gene.symbol}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}

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
