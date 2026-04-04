'use client'
import { Button } from '@/components/ui/button'
import { Star } from 'lucide-react'
import { useFavoriteGenes } from '@/features/gene-search/stores/favorite-genes-context'
import { AnimatePresence, m } from 'motion/react'
import { popSpring } from '@/lib/motion'
import type { SavedGene } from '@/features/gene-search/types/domain-types'

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
  }

  return (
    <Button
      onClick={handleFavoriteClick}
      variant="ghost"
      size="icon"
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={isFavorite ? 'filled' : 'empty'}
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={popSpring}
        >
          <Star
            className={`size-5 transition-colors duration-200 ${
              isFavorite
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-muted-foreground'
            }`}
          />
        </m.div>
      </AnimatePresence>
    </Button>
  )
}
