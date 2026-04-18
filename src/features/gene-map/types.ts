export interface Viewport {
  /** Center of the viewport in base-pair coordinates (0-based, fractional). */
  centerBp: number
  /** Base pairs per CSS pixel. Smaller = more zoomed in. */
  bpPerPixel: number
}

export interface LayerFlags {
  aaClass: boolean
  cpg: boolean
  restriction: boolean
  gcHeatmap: boolean
}

export const DEFAULT_LAYERS: LayerFlags = {
  aaClass: true,
  cpg: false,
  restriction: false,
  gcHeatmap: false,
}

export interface GeneMapIsoform {
  id: string
  codingSequence: string
  codingSequenceLength: number
  proteinSequenceLength: number
}

/** Encoded per-position data uploaded to the GPU as a single RGBA8 data texture. */
export interface LayerData {
  length: number
  /** RGBA8 texture data. R = aa-class idx, G = cpg|restrictionBits, B = rollingGC (0-255), A = base (0=A,1=C,2=G,3=T,4=N). */
  texture: Uint8Array
  textureWidth: number
  textureHeight: number
}
