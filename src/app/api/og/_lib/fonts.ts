import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ImageResponse } from 'next/og'

type OgFont = NonNullable<
  NonNullable<ConstructorParameters<typeof ImageResponse>[1]>['fonts']
>[number]

// Fonts for the OG images, committed to the repo (SIL OFL 1.1; the licenses
// sit beside them in ../_fonts) rather than fetched at request time from a
// CDN mirror of a mutable branch:
// - Source Serif 4 Bold, adobe-fonts/source-serif tag 4.005R — matches
//   --font-display, the face used by h1/h2 in the app.
// - Source Sans 3 Semibold, adobe-fonts/source-sans tag 3.052R — matches
//   --font-sans, the body face.
// TTF rather than WOFF: Satori parses it faster, and it can't read WOFF2.
//
// Read once at module scope (the Next.js ImageResponse docs pattern). The
// literal process.cwd()-relative paths let output file tracing ship the
// files with the route.
const [serifBold, sansSemibold] = await Promise.all([
  readFile(join(process.cwd(), 'src/app/api/og/_fonts/SourceSerif4-Bold.ttf')),
  readFile(
    join(process.cwd(), 'src/app/api/og/_fonts/SourceSans3-Semibold.ttf'),
  ),
])

export const OG_FONTS: OgFont[] = [
  { name: 'Source Serif 4', data: serifBold, weight: 700, style: 'normal' },
  { name: 'Source Sans 3', data: sansSemibold, weight: 600, style: 'normal' },
]
