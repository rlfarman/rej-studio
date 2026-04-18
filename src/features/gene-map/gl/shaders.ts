/**
 * GLSL sources for the gene ribbon. Single draw call renders all three LODs
 * via a continuous cross-fade. Layer visuals (CpG / suitability / GC) blend
 * additively on top.
 */

export const ribbonVert = /* glsl */ `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`

export const ribbonFrag = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSequence;        // RGBA8: (baseIdx/255, phase, exonParity, 1)
uniform sampler2D uTrackGc;         // R32F-like, packed in R
uniform sampler2D uTrackSuit;       // R32F-like, packed in R
uniform sampler2D uMsdf;            // MSDF atlas for ACGT
uniform float uSeqLength;
uniform float uOffset;              // leftmost visible base
uniform float uVisibleBases;        // bases visible in viewport
uniform float uBpp;                 // bases per pixel
uniform vec2  uResolution;          // viewport px
uniform float uTime;                // seconds
uniform vec4  uLayersEnabled;       // x=cpg y=suit z=gc w=restriction
uniform int   uHasExons;

// Palettes
const vec3 BASE_A = vec3(0.36, 0.80, 0.56); // green
const vec3 BASE_C = vec3(0.32, 0.65, 0.96); // blue
const vec3 BASE_G = vec3(0.97, 0.78, 0.36); // amber
const vec3 BASE_T = vec3(0.95, 0.47, 0.55); // pink
const vec3 BASE_N = vec3(0.40, 0.40, 0.45);

// Amino acid class palette (6 classes)
const vec3 AA_PAL[6] = vec3[6](
  vec3(0.36, 0.64, 0.95),
  vec3(0.54, 0.84, 0.60),
  vec3(0.97, 0.47, 0.45),
  vec3(0.69, 0.53, 0.94),
  vec3(0.85, 0.82, 0.70),
  vec3(0.55, 0.55, 0.60)
);

vec3 baseColor(int idx) {
  if (idx == 0) return BASE_A;
  if (idx == 1) return BASE_C;
  if (idx == 2) return BASE_G;
  if (idx == 3) return BASE_T;
  return BASE_N;
}

// Classify triplet → class index 0..5 using a branchy but deterministic map.
// Indices: A=0 C=1 G=2 T=3.
int codonToClass(int a, int b, int c) {
  // Stop codons
  if (a == 3 && b == 0 && c == 0) return 5; // TAA
  if (a == 3 && b == 0 && c == 2) return 5; // TAG
  if (a == 3 && b == 2 && c == 0) return 5; // TGA

  // Acidic: D (GAT GAC) E (GAA GAG)
  if (a == 2 && b == 0 && (c == 3 || c == 1)) return 2;
  if (a == 2 && b == 0 && (c == 0 || c == 2)) return 2;

  // Basic: K (AAA AAG) R (CGN AGA AGG) H (CAT CAC)
  if (a == 0 && b == 0 && (c == 0 || c == 2)) return 3;
  if (a == 1 && b == 2) return 3;
  if (a == 0 && b == 2 && (c == 0 || c == 2)) return 3;
  if (a == 1 && b == 0 && (c == 3 || c == 1)) return 3;

  // Hydrophobic: A V L I M F W P
  if (a == 2 && b == 1) return 0;                     // A (GCN)
  if (a == 2 && b == 3) return 0;                     // V (GTN)
  if (a == 1 && b == 3) return 0;                     // L (CTN)
  if (a == 3 && b == 3 && (c == 0 || c == 2)) return 0; // L (TTA TTG)
  if (a == 0 && b == 3 && (c != 2)) return 0;         // I (ATT ATC ATA)
  if (a == 0 && b == 3 && c == 2) return 0;           // M (ATG)
  if (a == 3 && b == 3 && (c == 3 || c == 1)) return 0; // F (TTT TTC)
  if (a == 3 && b == 2 && c == 2) return 0;           // W
  if (a == 1 && b == 1) return 0;                     // P (CCN)

  // Everything else → polar (covers S T N Q G C Y)
  return 1;
}

// MSDF median helper
float median(vec3 v) { return max(min(v.r, v.g), min(max(v.r, v.g), v.b)); }

// Atlas layout: 4 glyphs side-by-side, glyphIndex in [0..3]. Returns signed dist.
float msdfSample(int glyphIdx, vec2 glyphUv) {
  if (glyphUv.x < 0.0 || glyphUv.x > 1.0 || glyphUv.y < 0.0 || glyphUv.y > 1.0)
    return 0.0;
  float u = (float(glyphIdx) + glyphUv.x) * 0.25;
  float v = glyphUv.y;
  vec3 m = texture(uMsdf, vec2(u, v)).rgb;
  return median(m);
}

void main() {
  // Genomic position under this pixel
  float base = uOffset + vUv.x * uVisibleBases;
  if (base < 0.0 || base >= uSeqLength) {
    fragColor = vec4(0.03, 0.04, 0.06, 1.0);
    return;
  }
  float baseI = floor(base);
  float seqU = (baseI + 0.5) / uSeqLength;
  vec4 s = texture(uSequence, vec2(seqU, 0.5));
  int idx = int(floor(s.r * 255.0 + 0.5));
  int phase = int(floor(s.g * 255.0 + 0.5));
  float parity = s.b; // 0 or ~1

  // --- LOD weights ---
  float wFar = smoothstep(6.0, 16.0, uBpp);
  float wNear = 1.0 - smoothstep(0.8, 2.0, uBpp);
  float wMid = max(0.0, 1.0 - wFar - wNear);
  float wSum = max(wFar + wMid + wNear, 1e-4);

  // --- FAR: exon/phase ribbon ---
  vec3 cFar;
  if (uHasExons == 1) {
    // Alternating exon blocks
    vec3 exonA = vec3(0.30, 0.55, 0.85);
    vec3 exonB = vec3(0.85, 0.60, 0.30);
    cFar = mix(exonA, exonB, parity);
  } else {
    // Codon-phase stripes
    vec3 p0 = vec3(0.30, 0.55, 0.85);
    vec3 p1 = vec3(0.55, 0.45, 0.85);
    vec3 p2 = vec3(0.85, 0.55, 0.55);
    cFar = (phase == 0) ? p0 : (phase == 1) ? p1 : p2;
  }

  // Subtle "direction" gradient marching for strand feel
  float march = sin(baseI * 0.006 - uTime * 0.6) * 0.06;
  cFar += march;

  // --- MID: amino-acid class ---
  // Walk to codon start (baseI - phase), sample three bases.
  float codonStart = baseI - float(phase);
  int a0 = int(floor(texture(uSequence, vec2((codonStart + 0.5) / uSeqLength, 0.5)).r * 255.0 + 0.5));
  int a1 = int(floor(texture(uSequence, vec2((codonStart + 1.5) / uSeqLength, 0.5)).r * 255.0 + 0.5));
  int a2 = int(floor(texture(uSequence, vec2((codonStart + 2.5) / uSeqLength, 0.5)).r * 255.0 + 0.5));
  int cls = codonToClass(a0, a1, a2);
  vec3 cMid = AA_PAL[cls];

  // Codon divisions: darken edges of each codon
  float codonLocal = fract(base / 3.0);
  float codonEdge = smoothstep(0.0, 0.08, codonLocal) * smoothstep(0.0, 0.08, 1.0 - codonLocal);
  cMid *= mix(0.75, 1.0, codonEdge);

  // --- NEAR: base letters ---
  vec3 cNear = baseColor(idx);

  // Vertical ribbon shaping — soft round top/bottom
  float vShape = smoothstep(0.02, 0.15, vUv.y) * smoothstep(0.02, 0.15, 1.0 - vUv.y);
  cFar *= vShape;
  cMid *= vShape;
  cNear *= vShape;

  // Mix LODs
  vec3 color = (wFar * cFar + wMid * cMid + wNear * cNear) / wSum;

  // --- NEAR LOD: draw MSDF letter on top ---
  if (wNear > 0.01 && idx < 4) {
    // glyph footprint: 1 base wide, centered on base
    float basePixelWidth = 1.0 / uBpp;                   // px per base
    if (basePixelWidth > 6.0) {
      float glyphFrac = fract(base);                      // 0..1 within base
      float centerY = 0.5;
      float heightFrac = 0.55;                            // glyph vertical size
      float gu = glyphFrac;
      float gv = (vUv.y - (centerY - heightFrac / 2.0)) / heightFrac;
      float d = msdfSample(idx, vec2(gu, gv));
      // Use fwidth for crisp AA at any zoom
      float w = max(fwidth(d), 0.001);
      float letter = smoothstep(0.5 - w, 0.5 + w, d);
      vec3 letterColor = vec3(0.04, 0.05, 0.08);
      color = mix(color, letterColor, letter * wNear);
    }
  }

  // --- Highlight layers ---
  float gc = texture(uTrackGc, vec2(baseI / uSeqLength, 0.5)).r;
  float suit = texture(uTrackSuit, vec2(baseI / uSeqLength, 0.5)).r;

  // GC heatmap → blue (low) → white (mid) → red (high)
  if (uLayersEnabled.z > 0.5) {
    vec3 cold = vec3(0.20, 0.40, 0.95);
    vec3 warm = vec3(0.95, 0.35, 0.20);
    vec3 mid = vec3(0.95, 0.95, 0.95);
    vec3 gcC = gc < 0.5 ? mix(cold, mid, gc * 2.0) : mix(mid, warm, (gc - 0.5) * 2.0);
    color = mix(color, color * 0.4 + gcC * 0.8, 0.35 * uLayersEnabled.z);
  }

  // Suitability heatmap → ok (green) → caution (amber) → bad (red)
  if (uLayersEnabled.y > 0.5) {
    vec3 okC = vec3(0.30, 0.80, 0.45);
    vec3 medC = vec3(0.95, 0.75, 0.30);
    vec3 badC = vec3(0.95, 0.30, 0.25);
    vec3 suitC = suit < 0.5 ? mix(okC, medC, suit * 2.0) : mix(medC, badC, (suit - 0.5) * 2.0);
    color = mix(color, color * 0.3 + suitC * 0.9, 0.45 * uLayersEnabled.y);
  }

  // Edge vignette for polish
  float vignette = smoothstep(0.0, 0.02, vUv.x) * smoothstep(0.0, 0.02, 1.0 - vUv.x);
  color *= mix(0.85, 1.0, vignette);

  fragColor = vec4(color, 1.0);
}
`

export const overlayVert = /* glsl */ `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`

/** Renders CpG island rectangles + restriction marker triangles. */
export const overlayFrag = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

// CpG islands as up to 32 [start,end] pairs packed into a vec4 array (2 per slot)
uniform int uCpgCount;
uniform vec4 uCpg[32];     // .xy = island k's start/end, .zw = island k+1
uniform int uRestrictionCount;
uniform vec2 uRestriction[128]; // .x = position, .y = enzymeHash

uniform float uOffset;
uniform float uVisibleBases;
uniform float uSeqLength;
uniform float uTime;
uniform vec4  uLayersEnabled;     // x=cpg, w=restriction

void main() {
  float base = uOffset + vUv.x * uVisibleBases;
  vec3 accum = vec3(0.0);
  float alpha = 0.0;

  // CpG islands — glowing horizontal bands
  if (uLayersEnabled.x > 0.5) {
    for (int k = 0; k < 16; k++) {
      if (k >= uCpgCount) break;
      vec4 pair = uCpg[k];
      float s = pair.x, e = pair.y;
      float inside = step(s, base) * step(base, e);
      if (inside > 0.5) {
        float band = smoothstep(0.1, 0.35, vUv.y) * smoothstep(0.1, 0.35, 1.0 - vUv.y);
        float pulse = 0.85 + 0.15 * sin(uTime * 1.6);
        accum += vec3(0.35, 0.85, 0.95) * band * pulse;
        alpha = max(alpha, 0.55 * band);
      }
    }
  }

  // Restriction sites — vertical ticks
  if (uLayersEnabled.w > 0.5) {
    for (int k = 0; k < 128; k++) {
      if (k >= uRestrictionCount) break;
      float pos = uRestriction[k].x;
      float dBase = abs(base - pos);
      // Width of tick ~0.8 * bpp bases (2 px on screen)
      float bpp = uVisibleBases / 1000.0; // approximation; fine for tick
      float tickWidth = max(0.5, bpp * 0.6);
      float t = 1.0 - smoothstep(0.0, tickWidth, dBase);
      if (t > 0.0) {
        accum += vec3(0.98, 0.85, 0.25) * t;
        alpha = max(alpha, 0.85 * t);
      }
    }
  }

  fragColor = vec4(accum, alpha);
}
`
