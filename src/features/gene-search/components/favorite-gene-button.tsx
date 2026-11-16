'use client'
import { Button } from '@/components/ui/button'
import { Star } from 'lucide-react'
import { useFavoriteGenes } from '@/features/gene-search/stores/favorite-genes-store'
import type { SavedGene } from '@/features/gene-search/types/domain-types'
import { trackEvent } from '@/lib/analytics'
import { geneSearchCopy } from '../copy'

interface FavoriteButtonProps {
  gene: SavedGene
}

export function FavoriteGeneButton({ gene }: FavoriteButtonProps) {
  const { addFavoriteGene, removeFavoriteGene, isFavoriteGene } =
    useFavoriteGenes()
  const isFavorite = isFavoriteGene(gene.id)

  const handleFavoriteClick = () => {
    if (isFavorite) {
      removeFavoriteGene(gene.id)
    } else {
      addFavoriteGene(gene)
    }
    trackEvent({
      event: 'favorite_gene_toggle',
      gene_id: gene.id,
      symbol: gene.symbol,
      action: isFavorite ? 'remove' : 'add',
    })
  }

  return (
    <Button
      onClick={handleFavoriteClick}
      variant="ghost"
      size="icon"
      aria-label={
        isFavorite
          ? geneSearchCopy.favoriteButton.remove
          : geneSearchCopy.favoriteButton.add
      }
    >
      <Star
        className={`size-5 transition-colors duration-200 ${
          isFavorite ? 'fill-warning text-warning' : 'text-muted-foreground'
        }`}
      />
    </Button>
  )
}
