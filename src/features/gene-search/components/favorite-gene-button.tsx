'use client'
import { Button } from '@/components/ui/button'
import { Star } from 'lucide-react'
import { useFavoriteGenes } from '@/features/gene-search/stores/favorite-genes-store'
import type { SavedGene } from '@/features/gene-search/types/domain-types'
import { geneSearchCopy } from '../copy'

interface FavoriteButtonProps {
  gene: SavedGene
}

export function FavoriteGeneButton({ gene }: FavoriteButtonProps) {
  const addFavoriteGene = useFavoriteGenes((s) => s.addFavoriteGene)
  const removeFavoriteGene = useFavoriteGenes((s) => s.removeFavoriteGene)
  // Select the boolean rather than calling a store getter during render: the
  // React Compiler memoizes `getter(id)` on the getter's identity, which never
  // changes, so the button never saw its own toggle.
  const isFavorite = useFavoriteGenes((s) =>
    s.favoriteGenes.some((fav) => fav.id === gene.id),
  )

  const handleFavoriteClick = () => {
    if (isFavorite) {
      removeFavoriteGene(gene.id)
    } else {
      addFavoriteGene(gene)
    }
  }

  // A toggle: the name stays put and aria-pressed carries the state, so a
  // screen reader hears "Favorite TP53, toggle button, pressed".
  return (
    <Button
      onClick={handleFavoriteClick}
      variant="ghost"
      size="icon"
      aria-pressed={isFavorite}
      aria-label={geneSearchCopy.favoriteButton.label(gene.symbol)}
      title={
        isFavorite
          ? geneSearchCopy.favoriteButton.remove
          : geneSearchCopy.favoriteButton.add
      }
    >
      <Star
        aria-hidden
        className={`size-5 transition-colors duration-200 ${
          isFavorite ? 'fill-warning text-warning' : 'text-muted-foreground'
        }`}
      />
    </Button>
  )
}
