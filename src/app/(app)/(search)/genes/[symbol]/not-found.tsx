import Link from 'next/link'
import { SearchIcon } from 'lucide-react'
import { StatusPage } from '@/components/status-page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SpeciesIcon } from '@/components/bio/species-icon'
import { appCopy } from '@/copy/app'
import { findSimilarGenes } from '@/features/gene-search/api/genes'

const copy = appCopy.geneNotFound

/**
 * Gene not-found page. Renders fuzzy "did you mean?" suggestions when the
 * symbol looks close to existing genes in the database.
 */
export default async function GeneNotFound() {
  // notFound() pages don't receive route params, but we can extract the
  // symbol from the request path. src/proxy.ts sets x-pathname on every
  // request; the other two are older Next.js internals kept as fallbacks.
  const { headers } = await import('next/headers')
  const hdrs = await headers()
  const url =
    hdrs.get('x-pathname') ??
    hdrs.get('x-next-url') ??
    hdrs.get('x-invoke-path') ??
    ''
  const symbolMatch = url.match(/\/genes\/([^/?]+)/)
  const symbol = symbolMatch ? decodeURIComponent(symbolMatch[1]) : null

  const suggestions = symbol ? await findSimilarGenes(symbol) : []

  return (
    <StatusPage
      eyebrow={copy.eyebrow}
      title={symbol ? copy.title(symbol) : copy.titleUnknown}
      description={copy.detail}
      actions={
        <>
          <Button asChild>
            <Link href="/genes">
              <SearchIcon />
              {copy.searchGenes}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/design-tool">{copy.customSequence}</Link>
          </Button>
        </>
      }
    >
      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm font-medium">
            {copy.didYouMean}
          </p>
          <ul className="flex flex-wrap gap-2">
            {suggestions.map((gene) => (
              <li key={`${gene.symbol}-${gene.species}`}>
                <Badge
                  asChild
                  variant="outline"
                  className="hover:bg-accent hover:text-accent-foreground gap-1.5 px-2.5 py-1 text-sm"
                >
                  <Link href={`/genes/${gene.symbol}?species=${gene.species}`}>
                    <SpeciesIcon species={gene.species} className="size-3.5" />
                    {gene.symbol}
                  </Link>
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </StatusPage>
  )
}
