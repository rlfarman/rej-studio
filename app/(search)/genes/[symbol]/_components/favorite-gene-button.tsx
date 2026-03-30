'use client'
import { Button } from '@/components/ui/button'
import { Heart } from 'lucide-react'
import { useFavoriteGenes } from '@/context/favorite-genes-context'

interface FavoriteButtonProps {
  gene: {
    id: string
    name: string
    symbol: string
  }
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
  }

  return (
    <Button
      onClick={handleFavoriteClick}
      variant="ghost"
      size="icon"
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Heart
        className={`size-5 ${
          isFavorite ? 'text-destructive' : 'text-muted-foreground'
        }`}
      />
    </Button>
  )
}
