import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'

import type { WggwSiteCandidate } from '@/features/design-tool/components/splice-slider/types'
import { listWggwSites, pickDefaultWggwSite } from './default-wggw-site'

function siteAt(position: number): WggwSiteCandidate {
  return {
    position,
    motifStart: position - 1,
    motif: 'TGGA',
    hexamerStart: position - 2,
    originalHexamer: 'ACGTGG',
    newHexamer: 'ACTGGA',
    originalCodons: ['ACG', 'TGG'],
    newCodons: ['ACT', 'GGA'],
    alreadyPresent: false,
    baseChanges: 2,
    distanceFromCenter: 0,
    fivePrimeLength: position,
    threePrimeLength: position,
    rewriteOptions: [],
  }
}

describe('pickDefaultWggwSite', () => {
  it('returns null when the sequence has no WGGW sites', () => {
    expect(pickDefaultWggwSite([], 500)).toBeNull()
  })

  it('picks the site nearest the split point', () => {
    const sites = [siteAt(100), siteAt(600), siteAt(1200)]
    expect(pickDefaultWggwSite(sites, 591)?.position).toBe(600)
    expect(pickDefaultWggwSite(sites, 120)?.position).toBe(100)
    expect(pickDefaultWggwSite(sites, 5000)?.position).toBe(1200)
  })

  it('prefers the earlier site when two are equidistant', () => {
    const sites = [siteAt(400), siteAt(600)]
    expect(pickDefaultWggwSite(sites, 500)?.position).toBe(400)
  })
})

describe('listWggwSites', () => {
  // A real CDS from the committed sample seed, so the enumeration path is
  // exercised against sequence data rather than a synthetic poly-A string.
  const codingSequence: string = JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'data/sample-isoforms.jsonl'),
      'utf8',
    ).split('\n')[0],
  ).codingSequence

  it('finds sites in a real coding sequence', () => {
    const sites = listWggwSites(codingSequence)
    expect(sites.length).toBeGreaterThan(0)
    for (const site of sites) {
      expect(site.position).toBeGreaterThanOrEqual(1)
      expect(site.position).toBeLessThan(codingSequence.length)
    }
  })

  it('preselects a site near the midpoint of a real sequence', () => {
    const sites = listWggwSites(codingSequence)
    const midpoint = Math.floor(codingSequence.length / 2)
    const chosen = pickDefaultWggwSite(sites, midpoint)
    expect(chosen).not.toBeNull()
    const closest = Math.min(
      ...sites.map((site) => Math.abs(site.position - midpoint)),
    )
    expect(Math.abs(chosen!.position - midpoint)).toBe(closest)
  })

  it('returns no sites for a sequence too short to hold a motif', () => {
    expect(listWggwSites('ATG')).toEqual([])
  })
})
