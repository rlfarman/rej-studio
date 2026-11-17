// Pre-renders the Salk logo at the sizes the sidebar shows it, in AVIF,
// WebP and PNG, into public/branding/. next/image used to do this per
// request; the static app has no image service, so the variants are
// generated here and committed (like the optimizer .wasm).
//
// The sidebar draws the logo 16 CSS px wide, so 1x/2x/3x are 16/32/48 px.
// Rerun after changing a source in assets/branding/ or the widths below,
// and keep LOGO_WIDTHS in src/routes/-components/layout/salk-logo.tsx in step.
//
//   pnpm images:build

import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = path.join(root, 'assets/branding')
const outDir = path.join(root, 'public/branding')

// Black-on-transparent for the light theme, white for the dark one.
const LOGOS = {
  'salk-logo-dark-ink': 'SalkLogo-WCB-K.png',
  'salk-logo-light-ink': 'SalkLogo-WCB-W.png',
}
const WIDTHS = [16, 32, 48]

await mkdir(outDir, { recursive: true })
for (const [name, file] of Object.entries(LOGOS)) {
  for (const width of WIDTHS) {
    const resized = sharp(path.join(sourceDir, file)).resize({ width })
    const base = path.join(outDir, `${name}-${width}`)
    await Promise.all([
      resized.clone().avif({ quality: 70, effort: 9 }).toFile(`${base}.avif`),
      resized.clone().webp({ quality: 85, effort: 6 }).toFile(`${base}.webp`),
      resized
        .clone()
        .png({ compressionLevel: 9, palette: true })
        .toFile(`${base}.png`),
    ])
  }
  const { width, height } = await sharp(
    path.join(outDir, `${name}-16.png`),
  ).metadata()
  console.log(`[branding] ${name}: 16px is ${width}x${height}`)
}
