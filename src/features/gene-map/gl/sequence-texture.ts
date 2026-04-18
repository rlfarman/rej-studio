/**
 * Encode a coding sequence into a 1D texture.
 *
 * Each texel is one base. The R channel carries the base index (A=0, C=1,
 * G=2, T=3, N=4) as a normalized uint8 (base_idx / 255). G channel carries
 * codon phase (0, 1, 2). B carries exon rank parity (0 or 1). A is reserved
 * for future per-base annotation flags.
 *
 * WebGL2 RGBA8 texture, LINEAR filtering OFF (nearest) — we want crisp
 * per-base sampling even when stretched.
 */

export const BASE_INDEX: Record<string, number> = {
  A: 0,
  C: 1,
  G: 2,
  T: 3,
  U: 3,
  N: 4,
}

export interface SequenceTextureData {
  width: number
  height: 1
  data: Uint8Array
}

export interface BuildOptions {
  /** Exon rank parity per base (0 or 1). If omitted, derived from codon phase. */
  exonParity?: Uint8Array
}

export function buildSequenceTextureData(
  sequence: string,
  opts: BuildOptions = {},
): SequenceTextureData {
  const upper = sequence.toUpperCase()
  const n = upper.length
  const data = new Uint8Array(n * 4)
  for (let i = 0; i < n; i++) {
    const c = upper[i]
    const idx = BASE_INDEX[c] ?? 4
    const phase = i % 3
    const parity = opts.exonParity?.[i] ?? 0
    data[i * 4 + 0] = idx
    data[i * 4 + 1] = phase
    data[i * 4 + 2] = parity
    data[i * 4 + 3] = 255
  }
  return { width: n, height: 1, data }
}

/** Build exonParity from an exon structure's CDS-length layout. */
export function buildExonParity(
  cdsLength: number,
  cdsExonLengths: number[] | null,
): Uint8Array | undefined {
  if (!cdsExonLengths?.length) return undefined
  const out = new Uint8Array(cdsLength)
  let cursor = 0
  let parity = 0
  for (const len of cdsExonLengths) {
    const end = Math.min(cdsLength, cursor + len)
    for (let i = cursor; i < end; i++) out[i] = parity
    cursor = end
    parity ^= 1
    if (cursor >= cdsLength) break
  }
  return out
}
