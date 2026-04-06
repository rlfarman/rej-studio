#!/usr/bin/env node
/**
 * Generate PWA icons and Apple touch icon from logo.svg.
 *
 * Usage: node scripts/generate-icons.mjs
 *
 * Outputs:
 *   public/icon-192.png   — PWA manifest icon (192x192)
 *   public/icon-512.png   — PWA manifest icon (512x512)
 *   src/app/apple-icon.png — Apple touch icon (180x180)
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const svgBuffer = readFileSync(join(root, 'public', 'logo.svg'))

const sizes = [
  { name: 'icon-192.png', size: 192, dest: 'public' },
  { name: 'icon-512.png', size: 512, dest: 'public' },
  { name: 'apple-icon.png', size: 180, dest: 'src/app' },
]

for (const { name, size, dest } of sizes) {
  const buf = await sharp(svgBuffer)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()
  const outPath = join(root, dest, name)
  writeFileSync(outPath, buf)
  console.log(`  ✓ ${dest}/${name} (${size}x${size})`)
}

console.log('Done.')
