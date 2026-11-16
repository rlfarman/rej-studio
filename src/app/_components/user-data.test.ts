import { beforeEach, describe, expect, it } from 'vitest'
import { useFavoriteGenes } from '@/features/gene-search/stores/favorite-genes-store'
import { useRecentGenes } from '@/features/gene-search/stores/recent-genes-store'
import {
  useJobHistory,
  type JobHistoryEntry,
} from '@/features/design-tool/hooks/use-job-history'
import type { SavedGene } from '@/features/gene-search/types/domain-types'
import { buildBackup, importUserData } from './user-data'

const gene = (id: string, extra: Partial<SavedGene> = {}): SavedGene => ({
  id,
  symbol: id.toUpperCase(),
  name: `Gene ${id}`,
  species: 'human',
  ...extra,
})

const job = (
  id: string,
  createdAt: string,
  extra: Partial<JobHistoryEntry> = {},
): JobHistoryEntry => ({
  id,
  name: `Job ${id}`,
  sequenceLength: 300,
  createdAt,
  status: 'completed',
  result: {
    name: `Job ${id}`,
    original_sequence: 'ATG',
    optimized_sequence: 'ATG',
  } as JobHistoryEntry['result'],
  error: null,
  ...extra,
})

function backupFile(payload: unknown, name = 'backup.json') {
  return new File([JSON.stringify(payload)], name, {
    type: 'application/json',
  })
}

function resetStores() {
  useFavoriteGenes.setState({ favoriteGenes: [] })
  useRecentGenes.setState({ recentGenes: [] })
  useJobHistory.setState({ entries: [] })
  window.localStorage.clear()
}

describe('user data backup', () => {
  beforeEach(resetStores)

  it('round-trips favorites, recents and jobs through a file', async () => {
    useFavoriteGenes.setState({ favoriteGenes: [gene('tp53')] })
    useRecentGenes.setState({ recentGenes: [gene('kras'), gene('myc')] })
    useJobHistory.setState({
      entries: [job('j1', '2026-11-01T00:00:00.000Z')],
    })
    const file = backupFile(buildBackup())

    resetStores()
    const result = await importUserData(file)

    expect(result).toEqual({
      ok: true,
      added: { favorites: 1, recents: 2, jobs: 1 },
    })
    expect(useFavoriteGenes.getState().favoriteGenes.map((g) => g.id)).toEqual([
      'tp53',
    ])
    expect(useRecentGenes.getState().recentGenes.map((g) => g.id)).toEqual([
      'kras',
      'myc',
    ])
    expect(useJobHistory.getState().entries.map((e) => e.id)).toEqual(['j1'])
  })

  it('persists the import, so the next store write keeps it', async () => {
    const file = backupFile(
      (() => {
        useFavoriteGenes.setState({ favoriteGenes: [gene('tp53')] })
        const backup = buildBackup()
        resetStores()
        return backup
      })(),
    )
    await importUserData(file)

    // The old import wrote localStorage behind the hydrated store's back,
    // so the next change from the app overwrote it.
    useFavoriteGenes.getState().addFavoriteGene(gene('brca1'))
    const stored = JSON.parse(window.localStorage.getItem('favoriteGenes')!)
    expect(
      stored.state.favoriteGenes.map((g: SavedGene) => g.id).sort(),
    ).toEqual(['brca1', 'tp53'])
  })

  it('merges without overwriting what is already on this device', async () => {
    useFavoriteGenes.setState({
      favoriteGenes: [gene('tp53', { name: 'Local name' })],
    })
    useRecentGenes.setState({ recentGenes: [gene('egfr')] })
    useJobHistory.setState({
      entries: [job('local', '2026-11-10T00:00:00.000Z')],
    })

    const result = await importUserData(
      backupFile({
        version: 1,
        data: {
          favoriteGenes: {
            state: {
              favoriteGenes: [gene('tp53', { name: 'Old name' }), gene('kras')],
            },
            version: 0,
          },
          recentGenes: {
            state: { recentGenes: [gene('egfr'), gene('myc')] },
            version: 0,
          },
          'rej-studio:job-history': {
            state: {
              entries: [
                job('older', '2026-11-01T00:00:00.000Z'),
                job('newer', '2026-11-12T00:00:00.000Z'),
              ],
            },
            version: 0,
          },
        },
      }),
    )

    expect(result).toEqual({
      ok: true,
      added: { favorites: 1, recents: 1, jobs: 2 },
    })
    const favorites = useFavoriteGenes.getState().favoriteGenes
    expect(favorites.map((g) => g.id)).toEqual(['tp53', 'kras'])
    expect(favorites[0].name).toBe('Local name')
    // This device's recents stay on top.
    expect(useRecentGenes.getState().recentGenes.map((g) => g.id)).toEqual([
      'egfr',
      'myc',
    ])
    // Jobs are ordered newest first.
    expect(useJobHistory.getState().entries.map((e) => e.id)).toEqual([
      'newer',
      'local',
      'older',
    ])
  })

  it('keeps recents within the store cap, dropping imported ones first', async () => {
    const local = Array.from({ length: 8 }, (_, i) => gene(`local${i}`))
    useRecentGenes.setState({ recentGenes: local })
    const imported = Array.from({ length: 8 }, (_, i) => gene(`old${i}`))

    const result = await importUserData(
      backupFile({
        version: 1,
        data: { recentGenes: { state: { recentGenes: imported } } },
      }),
    )

    const ids = useRecentGenes.getState().recentGenes.map((g) => g.id)
    expect(ids).toHaveLength(10)
    expect(ids.slice(0, 8)).toEqual(local.map((g) => g.id))
    expect(ids.slice(8)).toEqual(['old0', 'old1'])
    expect(result.ok && result.added.recents).toBe(2)
  })

  it('leaves demo (seed) entries out of exports and imports', async () => {
    useFavoriteGenes.setState({
      favoriteGenes: [gene('seeded', { isSeed: true }), gene('real')],
    })
    useJobHistory.setState({
      entries: [
        job('seed-1', '2026-11-01T00:00:00.000Z', { isSeed: true }),
        job('real-job', '2026-11-01T00:00:00.000Z'),
      ],
    })
    const backup = buildBackup()
    expect(
      backup.data.favoriteGenes?.state.favoriteGenes.map((g) => g.id),
    ).toEqual(['real'])
    expect(
      backup.data['rej-studio:job-history']?.state.entries.map((e) => e.id),
    ).toEqual(['real-job'])

    resetStores()
    await importUserData(
      backupFile({
        version: 1,
        data: {
          favoriteGenes: {
            state: { favoriteGenes: [gene('seeded', { isSeed: true })] },
          },
        },
      }),
    )
    expect(useFavoriteGenes.getState().favoriteGenes).toEqual([])
  })

  it('reports nothing added when the backup is already present', async () => {
    useFavoriteGenes.setState({ favoriteGenes: [gene('tp53')] })
    const result = await importUserData(backupFile(buildBackup()))
    expect(result).toEqual({
      ok: true,
      added: { favorites: 0, recents: 0, jobs: 0 },
    })
  })

  describe('rejects files that are not backups', () => {
    it.each([
      ['not JSON', 'not json at all', 'unreadable'],
      ['the wrong version', { version: 2, data: {} }, 'invalid'],
      ['a missing data block', { version: 1 }, 'invalid'],
      [
        'a gene without an id',
        {
          version: 1,
          data: {
            favoriteGenes: { state: { favoriteGenes: [{ symbol: 'TP53' }] } },
          },
        },
        'invalid',
      ],
      [
        'a job with an unknown status',
        {
          version: 1,
          data: {
            'rej-studio:job-history': {
              state: {
                entries: [
                  job('x', '2026-11-01T00:00:00.000Z', {
                    status: 'exploded' as JobHistoryEntry['status'],
                  }),
                ],
              },
            },
          },
        },
        'invalid',
      ],
      [
        'a job whose result is not a result',
        {
          version: 1,
          data: {
            'rej-studio:job-history': {
              state: {
                entries: [
                  job('x', '2026-11-01T00:00:00.000Z', {
                    result: 'boom' as unknown as JobHistoryEntry['result'],
                  }),
                ],
              },
            },
          },
        },
        'invalid',
      ],
    ])('%s', async (_label, payload, reason) => {
      const file =
        typeof payload === 'string'
          ? new File([payload], 'x.json')
          : backupFile(payload)
      useFavoriteGenes.setState({ favoriteGenes: [gene('keep')] })

      expect(await importUserData(file)).toEqual({ ok: false, reason })
      // Nothing changed.
      expect(
        useFavoriteGenes.getState().favoriteGenes.map((g) => g.id),
      ).toEqual(['keep'])
    })

    it('refuses oversized files without reading them', async () => {
      const big = new File(['x'], 'big.json')
      Object.defineProperty(big, 'size', { value: 50 * 1024 * 1024 })
      expect(await importUserData(big)).toEqual({
        ok: false,
        reason: 'too-large',
      })
    })
  })
})
