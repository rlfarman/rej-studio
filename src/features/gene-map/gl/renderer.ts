import { Renderer, Program, Mesh, Triangle, Texture } from 'ogl'
import { ribbonVert, ribbonFrag, overlayVert, overlayFrag } from './shaders'
import { buildSequenceTextureData, buildExonParity } from './sequence-texture'
import { buildMsdfAtlas, MSDF_ATLAS_SIZE } from './msdf-atlas'
import type { GeneMapPayload } from '../api/types'

export interface RendererHandle {
  canvas: HTMLCanvasElement
  resize: (w: number, h: number) => void
  render: (state: RenderState) => void
  dispose: () => void
  supported: true
}

export interface RenderState {
  offset: number
  visibleBases: number
  bpp: number
  time: number
  layers: { cpg: boolean; suit: boolean; gc: boolean; restriction: boolean }
}

function encodeFloatTrack(values: number[]): {
  data: Uint8Array
  width: number
} {
  const width = values.length
  const data = new Uint8Array(width * 4)
  for (let i = 0; i < width; i++) {
    const v = Math.max(0, Math.min(1, values[i]))
    const b = Math.round(v * 255)
    data[i * 4 + 0] = b
    data[i * 4 + 1] = b
    data[i * 4 + 2] = b
    data[i * 4 + 3] = 255
  }
  return { data, width }
}

export function createRenderer(
  container: HTMLElement,
  payload: GeneMapPayload,
): RendererHandle | null {
  // Feature-detect WebGL2 first.
  const probe = document.createElement('canvas').getContext('webgl2')
  if (!probe) return null

  const renderer = new Renderer({
    dpr: Math.min(window.devicePixelRatio || 1, 2),
    antialias: false,
    webgl: 2,
    alpha: false,
  })
  const gl = renderer.gl
  const canvas = gl.canvas as HTMLCanvasElement
  canvas.style.display = 'block'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  container.appendChild(canvas)

  const cds = payload.isoform.codingSequence
  const exonParity = buildExonParity(
    cds.length,
    payload.exonStructure?.cdsExonLengths ?? null,
  )
  const seqData = buildSequenceTextureData(cds, { exonParity })

  const seqTex = new Texture(gl, {
    image: seqData.data,
    width: seqData.width,
    height: 1,
    generateMipmaps: false,
    minFilter: gl.NEAREST,
    magFilter: gl.NEAREST,
    wrapS: gl.CLAMP_TO_EDGE,
    wrapT: gl.CLAMP_TO_EDGE,
  })

  const gcEnc = encodeFloatTrack(payload.tracks.gc)
  const suitEnc = encodeFloatTrack(payload.tracks.suitability)

  const gcTex = new Texture(gl, {
    image: gcEnc.data,
    width: gcEnc.width,
    height: 1,
    generateMipmaps: false,
    minFilter: gl.LINEAR,
    magFilter: gl.LINEAR,
    wrapS: gl.CLAMP_TO_EDGE,
    wrapT: gl.CLAMP_TO_EDGE,
  })
  const suitTex = new Texture(gl, {
    image: suitEnc.data,
    width: suitEnc.width,
    height: 1,
    generateMipmaps: false,
    minFilter: gl.LINEAR,
    magFilter: gl.LINEAR,
    wrapS: gl.CLAMP_TO_EDGE,
    wrapT: gl.CLAMP_TO_EDGE,
  })

  const msdfData = buildMsdfAtlas()
  const msdfTex = new Texture(gl, {
    image: msdfData,
    width: MSDF_ATLAS_SIZE.width,
    height: MSDF_ATLAS_SIZE.height,
    generateMipmaps: false,
    minFilter: gl.LINEAR,
    magFilter: gl.LINEAR,
    wrapS: gl.CLAMP_TO_EDGE,
    wrapT: gl.CLAMP_TO_EDGE,
  })

  const geometry = new Triangle(gl)

  // Pack CpG islands as vec4s (x=start y=end).
  const MAX_CPG = 16
  const cpgUniform = Array.from({ length: MAX_CPG }, () => ({
    value: new Float32Array(4),
  }))
  payload.cpgIslands.slice(0, MAX_CPG).forEach((island, i) => {
    cpgUniform[i].value[0] = island.start
    cpgUniform[i].value[1] = island.end
  })

  const MAX_RESTR = 128
  const restrictionUniform = Array.from({ length: MAX_RESTR }, () => ({
    value: new Float32Array(2),
  }))
  payload.restrictionSites.slice(0, MAX_RESTR).forEach((site, i) => {
    restrictionUniform[i].value[0] = site.position - 1
  })

  const ribbonProgram = new Program(gl, {
    vertex: ribbonVert,
    fragment: ribbonFrag,
    uniforms: {
      uSequence: { value: seqTex },
      uTrackGc: { value: gcTex },
      uTrackSuit: { value: suitTex },
      uMsdf: { value: msdfTex },
      uSeqLength: { value: cds.length },
      uOffset: { value: 0 },
      uVisibleBases: { value: cds.length },
      uBpp: { value: 1 },
      uResolution: { value: [1, 1] },
      uTime: { value: 0 },
      uLayersEnabled: { value: [0, 0, 0, 0] },
      uHasExons: { value: exonParity ? 1 : 0 },
    },
  })

  const overlayProgram = new Program(gl, {
    vertex: overlayVert,
    fragment: overlayFrag,
    transparent: true,
    uniforms: {
      uCpgCount: { value: Math.min(MAX_CPG, payload.cpgIslands.length) },
      uCpg: { value: cpgUniform.map((u) => u.value) },
      uRestrictionCount: {
        value: Math.min(MAX_RESTR, payload.restrictionSites.length),
      },
      uRestriction: { value: restrictionUniform.map((u) => u.value) },
      uOffset: { value: 0 },
      uVisibleBases: { value: cds.length },
      uSeqLength: { value: cds.length },
      uTime: { value: 0 },
      uLayersEnabled: { value: [0, 0, 0, 0] },
    },
  })

  const ribbonMesh = new Mesh(gl, { geometry, program: ribbonProgram })
  const overlayMesh = new Mesh(gl, { geometry, program: overlayProgram })

  function resize(w: number, h: number) {
    renderer.setSize(w, h)
    ribbonProgram.uniforms.uResolution.value = [w, h]
  }

  function render(state: RenderState) {
    ribbonProgram.uniforms.uOffset.value = state.offset
    ribbonProgram.uniforms.uVisibleBases.value = state.visibleBases
    ribbonProgram.uniforms.uBpp.value = state.bpp
    ribbonProgram.uniforms.uTime.value = state.time
    ribbonProgram.uniforms.uLayersEnabled.value = [
      state.layers.cpg ? 1 : 0,
      state.layers.suit ? 1 : 0,
      state.layers.gc ? 1 : 0,
      state.layers.restriction ? 1 : 0,
    ]

    overlayProgram.uniforms.uOffset.value = state.offset
    overlayProgram.uniforms.uVisibleBases.value = state.visibleBases
    overlayProgram.uniforms.uTime.value = state.time
    overlayProgram.uniforms.uLayersEnabled.value =
      ribbonProgram.uniforms.uLayersEnabled.value

    renderer.render({ scene: ribbonMesh })
    // Overlay pass — alpha-blended
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    renderer.render({ scene: overlayMesh, clear: false })
    gl.disable(gl.BLEND)
  }

  function dispose() {
    canvas.remove()
  }

  return { canvas, resize, render, dispose, supported: true }
}
