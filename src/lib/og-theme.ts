// Shared palette + font loader for OG images, favicons, and other
// server-rendered static images. These must be resolved at render time —
// Satori can't read CSS variables from globals.css.
// Keep the hex values roughly in sync with the light-theme helix palette
// in src/styles/globals.css (the oklch() originals are noted inline).

export const OG_BG = '#f3f4f7' //             oklch(0.97 0.005 265) — app background
export const OG_CARD = '#fbfbfc' //           oklch(0.995 0.003 265) — card surface
export const OG_FG = '#1f2130' //             oklch(0.18 0.02 265) — foreground
export const OG_MUTED = '#6a6d7a' //          oklch(0.45 0.02 265) — muted text
export const OG_BORDER = '#d8d9de' //         oklch(0.88 0.01 265) — hairlines
export const OG_PRIMARY = '#3e41a5' //        oklch(0.42 0.15 265) — deep indigo
export const OG_ACCENT = '#d8ecb4' //         oklch(0.93 0.08 125) — soft lime
export const OG_ACCENT_FG = '#3b5a2e' //      oklch(0.28 0.1 140) — accent ink
// Legacy alias retained so anything still importing OG_BRAND compiles.
export const OG_BRAND = OG_FG

// Source Serif 4 Bold — matches --font-display (globals.css) so OG titles
// share the display face used by h1/h2 in the app.
// jsdelivr mirror of Adobe's release branch; Satori wants TTF/OTF (not woff2).
const SERIF_BOLD_URL =
  'https://cdn.jsdelivr.net/gh/adobe-fonts/source-serif@release/TTF/SourceSerif4-Bold.ttf'

let cachedDisplayFont: ArrayBuffer | null = null

export async function loadDisplayFont(): Promise<ArrayBuffer> {
  if (cachedDisplayFont) return cachedDisplayFont
  const res = await fetch(SERIF_BOLD_URL)
  if (!res.ok) {
    throw new Error(`Failed to load OG display font: ${res.status}`)
  }
  cachedDisplayFont = await res.arrayBuffer()
  return cachedDisplayFont
}
