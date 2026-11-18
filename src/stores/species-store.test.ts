import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'
import { act, renderHook } from '@testing-library/react'

import { useSpeciesContext, useSpeciesStore } from './species-store'

describe('useSpeciesStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useSpeciesStore.setState({ species: 'both' })
  })

  afterEach(() => {
    localStorage.clear()
    window.history.replaceState(null, '', '/')
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

  it('persists an explicit choice', () => {
    useSpeciesStore.getState().handleSpeciesChange('mouse')
    expect(JSON.parse(localStorage.getItem('species')!).state.species).toBe(
      'mouse',
    )
  })

  it("leaves the page URL alone (a gene page's ?species= belongs to the page)", () => {
    window.history.replaceState(null, '', '/genes/TP53?species=human')
    useSpeciesStore.getState().handleSpeciesChange('mouse')
    expect(window.location.search).toBe('?species=human')
  })

  it("doesn't adopt a ?species= from the URL on rehydrate", async () => {
    window.history.replaceState(null, '', '/genes/Trp53?species=mouse')
    await useSpeciesStore.persist.rehydrate()
    expect(useSpeciesStore.getState().species).toBe('both')
  })
})

describe('useSpeciesStore migration', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('resets a v0 value, which page visits could have written', async () => {
    localStorage.setItem(
      'species',
      JSON.stringify({ state: { species: 'mouse' }, version: 0 }),
    )
    await useSpeciesStore.persist.rehydrate()
    expect(useSpeciesStore.getState().species).toBe('both')
  })

  it('keeps a v1 choice', async () => {
    localStorage.setItem(
      'species',
      JSON.stringify({ state: { species: 'mouse' }, version: 1 }),
    )
    await useSpeciesStore.persist.rehydrate()
    expect(useSpeciesStore.getState().species).toBe('mouse')
  })

  it('starts a visitor with a v0 value at both', async () => {
    // v0 saved every visited gene page's species, not only choices.
    localStorage.setItem(
      'species',
      JSON.stringify({ state: { species: 'mouse' }, version: 0 }),
    )
    await useSpeciesStore.persist.rehydrate()
    expect(useSpeciesStore.getState().species).toBe('both')
  })

  it('useSpeciesContext reads and changes the choice', () => {
    const { result } = renderHook(() => useSpeciesContext())
    expect(result.current.species).toBe('both')
    act(() => result.current.handleSpeciesChange('human'))
    expect(result.current.species).toBe('human')
  })
})
