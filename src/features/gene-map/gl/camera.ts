import { Spring } from './spring'
import { clampBpp, clampPan } from '../utils/lod'

/**
 * 1D pan/zoom camera for the gene ribbon. X axis is genomic position, Y is
 * fixed. offsetBases = leftmost visible base; bpp = bases per pixel.
 */
export class RibbonCamera {
  offset: Spring
  bpp: Spring
  totalBases: number
  viewportPx = 1
  reducedMotion = false

  constructor(totalBases: number, initialBpp: number) {
    this.offset = new Spring(0)
    this.bpp = new Spring(initialBpp)
    this.totalBases = totalBases
  }

  setViewport(widthPx: number) {
    this.viewportPx = Math.max(1, widthPx)
  }

  setReducedMotion(reduced: boolean) {
    this.reducedMotion = reduced
    this.offset.snap = reduced
    this.bpp.snap = reduced
  }

  /** Target (immediate — for pan on pointerdown). */
  panBy(dxPixels: number) {
    const dBases = dxPixels * this.bpp.target
    const next = clampPan(
      this.offset.target - dBases,
      this.visibleBases(this.bpp.target),
      this.totalBases,
    )
    this.offset.setTarget(next)
  }

  /** Zoom around a viewport-anchored pixel. */
  zoomAround(pixelX: number, factor: number) {
    const prevBpp = this.bpp.target
    const nextBpp = clampBpp(prevBpp * factor, this.viewportPx, this.totalBases)
    // Keep the base under `pixelX` fixed under the zoom.
    const baseUnderPixel = this.offset.target + pixelX * prevBpp
    const nextOffset = clampPan(
      baseUnderPixel - pixelX * nextBpp,
      this.visibleBases(nextBpp),
      this.totalBases,
    )
    this.bpp.setTarget(nextBpp)
    this.offset.setTarget(nextOffset)
  }

  fit() {
    const target = clampBpp(
      this.totalBases / this.viewportPx,
      this.viewportPx,
      this.totalBases,
    )
    this.bpp.setTarget(target)
    this.offset.setTarget(0)
  }

  jumpTo(basePosition: number, bpp: number) {
    this.bpp.jump(clampBpp(bpp, this.viewportPx, this.totalBases))
    this.offset.jump(
      clampPan(
        basePosition,
        this.visibleBases(this.bpp.value),
        this.totalBases,
      ),
    )
  }

  visibleBases(bpp = this.bpp.value): number {
    return this.viewportPx * bpp
  }

  /** Advance springs. Returns true if still animating. */
  step(dt: number): boolean {
    const a = this.offset.step(dt)
    const b = this.bpp.step(dt)
    return a || b
  }
}
