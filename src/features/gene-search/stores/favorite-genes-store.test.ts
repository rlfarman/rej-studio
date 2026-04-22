import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeSavedGene } from '@/test/fixtures'
import { useFavoriteGenes } from './favorite-genes-store'

describe('useFavoriteGenes', () => {
  beforeEach(() => {
    localStorage.clear()
    useFavoriteGenes.setState({ favoriteGenes: [] })
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('starts empty', () => {
    expect(useFavoriteGenes.getState().favoriteGenes).toEqual([])
  })

  it('adds a gene', () => {
    const gene = makeSavedGene({ id: 'g1' })
    useFavoriteGenes.getState().addFavoriteGene(gene)
    expect(useFavoriteGenes.getState().favoriteGenes).toHaveLength(1)
    expect(useFavoriteGenes.getState().isFavoriteGene('g1')).toBe(true)
  })

  it('deduplicates on re-add (moves to front)', () => {
    const g1 = makeSavedGene({ id: 'g1' })
    const g2 = makeSavedGene({ id: 'g2' })
    const store = useFavoriteGenes.getState()
    store.addFavoriteGene(g1)
    store.addFavoriteGene(g2)
    store.addFavoriteGene(g1) // re-add g1
    const { favoriteGenes } = useFavoriteGenes.getState()
    expect(favoriteGenes).toHaveLength(2)
    expect(favoriteGenes[0].id).toBe('g1') // moved to front
  })

  it('removes a gene', () => {
    const gene = makeSavedGene({ id: 'g1' })
    useFavoriteGenes.getState().addFavoriteGene(gene)
    useFavoriteGenes.getState().removeFavoriteGene('g1')
    expect(useFavoriteGenes.getState().favoriteGenes).toHaveLength(0)
    expect(useFavoriteGenes.getState().isFavoriteGene('g1')).toBe(false)
  })

  it('removing non-existent gene is a no-op', () => {
    useFavoriteGenes.getState().removeFavoriteGene('missing')
    expect(useFavoriteGenes.getState().favoriteGenes).toHaveLength(0)
  })
})
