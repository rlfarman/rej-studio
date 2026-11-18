import { describe, expect, it } from 'vite-plus/test'

import type { WggwSiteCandidate } from '@/features/design-tool/components/splice-slider/types'
import {
  resolveWggwPicks,
  selectedWggwSitesFor,
  wggwSitesIn,
} from './wggw-selection'

function rewrite(newHexamer: string) {
  return {
    newCodons: [newHexamer.slice(0, 3), newHexamer.slice(3)] as [
      string,
      string,
    ],
    newHexamer,
  } as WggwSiteCandidate['rewriteOptions'][number]
}

function siteAt(position: number, rewrites = ['ACTGGA', 'ACAGGA']) {
  return {
    position,
    motifStart: position - 1,
    motif: 'TGGA',
    hexamerStart: position - 2,
    originalCodons: ['ACG', 'TGG'],
    rewriteOptions: rewrites.map(rewrite),
  } as WggwSiteCandidate
}

describe('resolveWggwPicks', () => {
  const sites = [siteAt(100), siteAt(600), siteAt(1200)]

  it('uses the site nearest the caret when none is picked', () => {
    const { sites: resolved } = resolveWggwPicks(sites, [590], 700, [], [])
    expect(resolved.map((s) => s?.position)).toEqual([600])
  })

  it('uses the picked site, or none when it is gone from the sequence', () => {
    expect(
      resolveWggwPicks(sites, [590], 700, [1200], []).sites[0]?.position,
    ).toBe(1200)
    expect(resolveWggwPicks(sites, [590], 700, [999], []).sites[0]).toBeNull()
  })

  it('applies a rewrite pick only to the site it was made for', () => {
    const forSite = resolveWggwPicks(
      sites,
      [590],
      700,
      [600],
      [{ position: 600, index: 1 }],
    )
    expect(forSite.rewrites[0]?.newHexamer).toBe('ACAGGA')
    const forOther = resolveWggwPicks(
      sites,
      [590],
      700,
      [1200],
      [{ position: 600, index: 1 }],
    )
    expect(forOther.rewrites[0]?.newHexamer).toBe('ACTGGA')
  })
})

describe('selectedWggwSitesFor', () => {
  it('is empty-handed for a sequence too short to have sites', () => {
    expect(wggwSitesIn('ATG')).toEqual([])
    expect(selectedWggwSitesFor('ATG', [1])).toEqual([null])
  })

  it('resolves what the editor shows for a real sequence', () => {
    const cds = 'ATG' + 'GCTGGAAAA'.repeat(20) + 'TAA'
    const sites = wggwSitesIn(cds)
    expect(sites.length).toBeGreaterThan(0)
    const [selected] = selectedWggwSitesFor(cds, [90])
    const { sites: shown, rewrites } = resolveWggwPicks(
      sites,
      [90],
      Math.floor(cds.length / 2),
      [],
      [],
    )
    expect(selected?.position).toBe(shown[0]?.position)
    expect(selected?.newHexamer).toBe(rewrites[0]?.newHexamer)
  })
})
