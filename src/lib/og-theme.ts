// Shared palette for OG images, favicons, and other server-rendered static
// images. These must be resolved at render time — Satori can't read CSS
// variables from globals.css.
// Keep the hex values roughly in sync with the light-theme helix palette
// in src/styles/globals.css (the oklch() originals are noted inline).
// The OG fonts live with the routes that use them (src/app/api/og/_lib).

export const OG_BG = '#f3f4f7' //             oklch(0.97 0.005 265) — app background
export const OG_FG = '#1f2130' //             oklch(0.18 0.02 265) — foreground
export const OG_MUTED = '#6a6d7a' //          oklch(0.45 0.02 265) — muted text
export const OG_BORDER = '#d8d9de' //         oklch(0.88 0.01 265) — hairlines
export const OG_PRIMARY = '#3e41a5' //        oklch(0.42 0.15 265) — deep indigo
export const OG_ACCENT = '#d8ecb4' //         oklch(0.93 0.08 125) — soft lime
