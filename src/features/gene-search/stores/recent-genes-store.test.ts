import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeSavedGene } from '@/test/fixtures'
import { useRecentGenes } from './recent-genes-store'

describe('useRecentGenes', () => {
  beforeEach(() => {
    localStorage.clear()
    useRecentGenes.setState({ recentGenes: [] })
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('starts empty', () => {
    expect(useRecentGenes.getState().recentGenes).toEqual([])
  })

  it('adds gene to front', () => {
    const g1 = makeSavedGene({ id: 'g1' })
    const g2 = makeSavedGene({ id: 'g2' })
    useRecentGenes.getState().addRecentGene(g1)
    useRecentGenes.getState().addRecentGene(g2)
    const { recentGenes } = useRecentGenes.getState()
    expect(recentGenes[0].id).toBe('g2')
    expect(recentGenes[1].id).toBe('g1')
  })

  it('caps at 10 entries', () => {
    for (let i = 0; i < 12; i++) {
      useRecentGenes.getState().addRecentGene(makeSavedGene({ id: `g${i}` }))
    }
    expect(useRecentGenes.getState().recentGenes).toHaveLength(10)
  })

  it('deduplicates on re-add (moves to front)', () => {
    const g1 = makeSavedGene({ id: 'g1' })
    const g2 = makeSavedGene({ id: 'g2' })
    useRecentGenes.getState().addRecentGene(g1)
    useRecentGenes.getState().addRecentGene(g2)
    useRecentGenes.getState().addRecentGene(g1)
    const { recentGenes } = useRecentGenes.getState()
    expect(recentGenes).toHaveLength(2)
    expect(recentGenes[0].id).toBe('g1')
  })

  it('removes a gene', () => {
    useRecentGenes.getState().addRecentGene(makeSavedGene({ id: 'g1' }))
    useRecentGenes.getState().removeRecentGene('g1')
    expect(useRecentGenes.getState().recentGenes).toHaveLength(0)
  })

  it('clears history', () => {
    useRecentGenes.getState().addRecentGene(makeSavedGene({ id: 'g1' }))
    useRecentGenes.getState().addRecentGene(makeSavedGene({ id: 'g2' }))
    useRecentGenes.getState().clearRecentGenes()
    expect(useRecentGenes.getState().recentGenes).toEqual([])
  })
})
