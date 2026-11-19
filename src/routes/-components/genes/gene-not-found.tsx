import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { SearchIcon } from 'lucide-react'

import { SpeciesIcon } from '@/components/bio/species-icon'
import { StatusPage } from '@/components/status-page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { appCopy } from '@/copy/app'
import { usesSampleCorpus } from '@/features/gene-search/corpus/gene-data-url'
import { similarGenesQuery } from '@/features/gene-search/corpus/queries'
import { geneLink } from '@/features/gene-search/utils/search-href'

const copy = appCopy.geneNotFound

/**
 * A gene URL that matches nothing in the corpus, with "did you mean?"
 * suggestions when the symbol looks close to genes that exist.
 */
export function GeneNotFound({ symbol }: { symbol: string }) {
  const { data: suggestions = [] } = useQuery(similarGenesQuery(symbol))

  return (
    <StatusPage
      eyebrow={copy.eyebrow}
      title={symbol ? copy.title(symbol) : copy.titleUnknown}
      description={usesSampleCorpus() ? copy.detailSample : copy.detail}
      actions={
        <>
          <Button size="lg" nativeButton={false} render={<Link to="/genes" />}>
            <SearchIcon />
            {copy.searchGenes}
          </Button>
          <Button
            size="lg"
            variant="outline"
            nativeButton={false}
            render={<Link to="/design-tool" />}
          >
            {copy.customSequence}
          </Button>
        </>
      }
    >
      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground">
            {copy.didYouMean}
          </p>
          <ul className="flex flex-wrap gap-2">
            {suggestions.map((gene) => (
              <li key={`${gene.symbol}-${gene.species}`}>
                <Badge
                  variant="outline"
                  className="gap-1.5 px-2.5 py-1 text-sm hover:bg-accent hover:text-accent-foreground"
                  render={<Link {...geneLink(gene.symbol, gene.species)} />}
                >
                  <SpeciesIcon species={gene.species} className="size-3.5" />
                  {gene.symbol}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </StatusPage>
  )
}
