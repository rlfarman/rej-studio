import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useSpeciesStore } from './species-store'

describe('useSpeciesStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useSpeciesStore.setState({ species: 'both' })
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('defaults to both', () => {
    expect(useSpeciesStore.getState().species).toBe('both')
  })

  it('handleSpeciesChange updates state', () => {
    useSpeciesStore.getState().handleSpeciesChange('human')
    expect(useSpeciesStore.getState().species).toBe('human')
  })

  it('handleSpeciesChange from human to mouse', () => {
    useSpeciesStore.getState().handleSpeciesChange('human')
    useSpeciesStore.getState().handleSpeciesChange('mouse')
    expect(useSpeciesStore.getState().species).toBe('mouse')
  })

  it('handleSpeciesChange updates URL', () => {
    useSpeciesStore.getState().handleSpeciesChange('human')
    const url = new URL(window.location.href)
    expect(url.searchParams.get('species')).toBe('human')
  })
})
