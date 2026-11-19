// Pre-renders the Salk logo at the sizes the sidebar shows it, into
// public/branding/. next/image used to do this per request; the static app
// has no image service, so the variants are generated here and committed
// (like the optimizer .wasm).
//
// The sidebar draws the logo 16 CSS px wide, so 1x/2x/3x are 16/32/48 px.
// Rerun after changing the source in assets/branding/ or the widths below,
// and keep LOGO_WIDTHS in src/routes/-components/layout/salk-logo.tsx in step.
//
// One ink and one format, on purpose. The logo is monochrome, so dark mode
// inverts this one in CSS rather than loading a white copy. At 16 px the
// PNG is under a kilobyte, which AVIF and WebP were saving a few hundred
// bytes on in exchange for two more files per size and a <picture> around
// every use.
//
//   pnpm images:build

import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = path.join(root, 'assets/branding')
const outDir = path.join(root, 'public/branding')

// Black on transparent; `dark:invert` makes it white for the dark theme.
const LOGOS = { 'salk-logo': 'SalkLogo-WCB-K.png' }
const WIDTHS = [16, 32, 48]

await mkdir(outDir, { recursive: true })
for (const [name, file] of Object.entries(LOGOS)) {
  for (const width of WIDTHS) {
    await sharp(path.join(sourceDir, file))
      .resize({ width })
      .png({ compressionLevel: 9, palette: true })
      .toFile(path.join(outDir, `${name}-${width}.png`))
  }
  const { width, height } = await sharp(
    path.join(outDir, `${name}-16.png`),
  ).metadata()
  console.log(`[branding] ${name}: 16px is ${width}x${height}`)
}
