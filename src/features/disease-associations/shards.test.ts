// @vitest-environment node
import { describe, expect, it, vi } from 'vite-plus/test'

import table from './data/associations.json'
import {
  associationShardKey,
  buildAssociationShards,
  fetchAssociation,
  type AssociationShardManifest,
} from './shards'
import type { AssociationData, AssociationRow } from './types'

const data = table as AssociationData

function row(symbol: string): AssociationRow {
  return {
    symbol,
    name: `${symbol} gene`,
    ensemblGeneId: null,
    inheritance: [],
    phenotypes: [],
    largestCds: null,
  }
}

describe('associationShardKey', () => {
  it('is the first two characters, lowercased', () => {
    expect(associationShardKey('TP53')).toBe('tp')
    expect(associationShardKey('brca1')).toBe('br')
  })

  it('replaces characters that are not letters or digits', () => {
    expect(associationShardKey('H-2')).toBe('h_')
    expect(associationShardKey('A')).toBe('a')
  })
})

describe('buildAssociationShards', () => {
  const shards = buildAssociationShards(data)

  it('puts every row in exactly one shard, under its own key', () => {
    const rows = [...shards.values()].flatMap((shard) => shard.rows)
    expect(rows).toHaveLength(data.rows.length)
    for (const [key, shard] of shards) {
      for (const r of shard.rows)
        expect(associationShardKey(r.symbol)).toBe(key)
    }
  })

  it('keeps the committed table in small files', () => {
    // A gene page fetches one of these instead of the whole table; if the
    // data grows enough to fill them, split on a longer prefix.
    const largest = Math.max(
      ...[...shards.values()].map((shard) => JSON.stringify(shard).length),
    )
    expect(largest).toBeLessThan(32 * 1024)
    expect(shards.size).toBeGreaterThan(100)
  })
})

describe('fetchAssociation', () => {
  const manifest: AssociationShardManifest = {
    base: '/assets/disease-associations/abc',
    keys: ['tp', 'br'],
  }
  const respond = (body: AssociationData) =>
    vi.fn<typeof fetch>(async () => Response.json(body))

  it('reads the row from its shard, case-insensitively', async () => {
    const fetchFn = respond({ rows: [row('TPO'), row('TP53')] })
    await expect(fetchAssociation('tp53', manifest, fetchFn)).resolves.toEqual(
      row('TP53'),
    )
    expect(fetchFn).toHaveBeenCalledWith(
      '/assets/disease-associations/abc/tp.json',
    )
  })

  it('is null when the shard has no such gene', async () => {
    const fetchFn = respond({ rows: [row('BRCA2')] })
    await expect(
      fetchAssociation('BRAF', manifest, fetchFn),
    ).resolves.toBeNull()
  })

  it('makes no request when no symbol shares the prefix', async () => {
    const fetchFn = respond({ rows: [] })
    await expect(
      fetchAssociation('ZZZ3', manifest, fetchFn),
    ).resolves.toBeNull()
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('fails on an HTTP error, so the query can retry', async () => {
    const fetchFn = vi.fn<typeof fetch>(
      async () => new Response('', { status: 503 }),
    )
    await expect(fetchAssociation('TP53', manifest, fetchFn)).rejects.toThrow(
      /HTTP 503/,
    )
  })
})
