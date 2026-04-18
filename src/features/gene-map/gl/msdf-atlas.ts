/**
 * Build a tiny SDF-ish glyph atlas for A, C, G, T at runtime using a 2D
 * canvas. Not a true MSDF (which would need a font-parsing pipeline), but a
 * cheap signed-distance-from-edge approximation that gives crisp letters at
 * any zoom via the same `fwidth()` smoothing trick.
 *
 * Layout: 4 glyphs side-by-side, each 128x128 → atlas 512x128.
 */

const GLYPHS = ['A', 'C', 'G', 'T']
const CELL = 128
const ATLAS_W = CELL * 4
const ATLAS_H = CELL
const PAD = 10

export function buildMsdfAtlas(): Uint8Array {
  if (typeof document === 'undefined')
    return new Uint8Array(ATLAS_W * ATLAS_H * 4)
  const cv = document.createElement('canvas')
  cv.width = ATLAS_W
  cv.height = ATLAS_H
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  if (!ctx) return new Uint8Array(ATLAS_W * ATLAS_H * 4)
  // 1) Render each glyph as solid white on black
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, ATLAS_W, ATLAS_H)
  ctx.fillStyle = '#fff'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.font = `900 ${CELL - 2 * PAD}px ui-monospace, SFMono-Regular, Menlo, monospace`
  for (let i = 0; i < 4; i++) {
    ctx.fillText(GLYPHS[i], i * CELL + CELL / 2, CELL / 2 + 2)
  }

  // 2) Read pixels and compute a cheap distance field. For each pixel:
  //    d = distance to nearest edge (sign positive inside, negative outside).
  //    We approximate via a two-pass chamfer distance transform.
  const img = ctx.getImageData(0, 0, ATLAS_W, ATLAS_H).data
  const inside = new Uint8Array(ATLAS_W * ATLAS_H)
  for (let i = 0; i < inside.length; i++) inside[i] = img[i * 4] > 127 ? 1 : 0

  const W = ATLAS_W
  const H = ATLAS_H
  const INF = 1e6
  const dIn = new Float32Array(W * H)
  const dOut = new Float32Array(W * H)
  for (let i = 0; i < dIn.length; i++) {
    dIn[i] = inside[i] ? INF : 0
    dOut[i] = inside[i] ? 0 : INF
  }

  const step1 = (d: Float32Array) => {
    // Forward pass
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x
        let m = d[i]
        if (x > 0) m = Math.min(m, d[i - 1] + 1)
        if (y > 0) m = Math.min(m, d[i - W] + 1)
        if (x > 0 && y > 0) m = Math.min(m, d[i - W - 1] + 1.4142)
        if (x < W - 1 && y > 0) m = Math.min(m, d[i - W + 1] + 1.4142)
        d[i] = m
      }
    }
    // Backward pass
    for (let y = H - 1; y >= 0; y--) {
      for (let x = W - 1; x >= 0; x--) {
        const i = y * W + x
        let m = d[i]
        if (x < W - 1) m = Math.min(m, d[i + 1] + 1)
        if (y < H - 1) m = Math.min(m, d[i + W] + 1)
        if (x > 0 && y < H - 1) m = Math.min(m, d[i + W - 1] + 1.4142)
        if (x < W - 1 && y < H - 1) m = Math.min(m, d[i + W + 1] + 1.4142)
        d[i] = m
      }
    }
  }
  step1(dIn)
  step1(dOut)

  // Signed distance, remapped 0..1 with edge at 0.5.
  const RANGE = 10
  const out = new Uint8Array(W * H * 4)
  for (let i = 0; i < W * H; i++) {
    const d = inside[i] ? dIn[i] : -dOut[i]
    const v = Math.max(0, Math.min(1, 0.5 + d / (2 * RANGE)))
    const b = Math.round(v * 255)
    out[i * 4 + 0] = b
    out[i * 4 + 1] = b
    out[i * 4 + 2] = b
    out[i * 4 + 3] = 255
  }
  return out
}

export const MSDF_ATLAS_SIZE = { width: ATLAS_W, height: ATLAS_H }
