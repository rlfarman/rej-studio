import type { CorpusIsoform, StoredIsoformIdentity } from './format'

/**
 * Most isoforms the identity matrix compares. Pairs grow quadratically, both
 * in the grid and in what the corpus build aligns and stores per gene.
 */
export const MAX_IDENTITY_ISOFORMS = 16

type Selectable = Pick<CorpusIsoform, 'id' | 'proteinSequenceLength'>

/**
 * The isoforms the identity matrix shows, in display order: longest protein
 * first (usually the canonical isoform, so it lands top-left), ties by
 * transcript id so the order never depends on input order. The corpus build
 * aligns exactly these and the page shows exactly these; both call this, and
 * `parseIsoformIdentity` refuses stored values for any other list.
 */
export function selectIdentityIsoforms<T extends Selectable>(
  isoforms: readonly T[],
): T[] {
  return [...isoforms]
    .sort(
      (a, b) =>
        b.proteinSequenceLength - a.proteinSequenceLength ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
    .slice(0, MAX_IDENTITY_ISOFORMS)
}

/** Entries in the upper triangle of an n × n matrix (diagonal excluded). */
export function triangleSize(n: number): number {
  // The guard keeps n = 0 from giving -0.
  return n < 2 ? 0 : (n * (n - 1)) / 2
}

/** Identities ready to draw: `percent[i][j]`, symmetric, 100 on the diagonal. */
export interface IsoformIdentityMatrix {
  ids: string[]
  percent: number[][]
}

const isPermille = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 1000

/**
 * Check a gene file's stored identities against its isoforms and expand them
 * for display. Null when the file has none (a corpus built before they were
 * stored) or they don't fit: wrong shape, out of range, or for a different
 * isoform list than `selectIdentityIsoforms` picks now. The page then says
 * identities are unavailable rather than showing numbers for the wrong
 * pairs.
 */
export function parseIsoformIdentity(
  stored: unknown,
  isoforms: readonly Selectable[],
): IsoformIdentityMatrix | null {
  if (typeof stored !== 'object' || stored === null) return null
  const { isoforms: ids, permille } = stored as Partial<StoredIsoformIdentity>
  if (!Array.isArray(ids) || !Array.isArray(permille)) return null

  const expected = selectIdentityIsoforms(isoforms).map(({ id }) => id)
  const n = expected.length
  if (ids.length !== n || ids.some((id, i) => id !== expected[i])) return null
  if (permille.length !== triangleSize(n) || !permille.every(isPermille)) {
    return null
  }

  const percent = expected.map(() => Array.from({ length: n }, () => 100))
  let k = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      percent[i][j] = percent[j][i] = permille[k++] / 10
    }
  }
  return { ids: expected, percent }
}
