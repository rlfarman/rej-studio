import { ImageResponse } from 'next/og'
import { source } from '@/lib/source'
import {
  OG_ACCENT,
  OG_BG,
  OG_BORDER,
  OG_FG,
  OG_MUTED,
  OG_PRIMARY,
  loadDisplayFont,
  loadSansFont,
} from '@/lib/og-theme'

/**
 * Per-page OpenGraph image for /docs pages.
 *
 * This lives as a route handler (not a colocated `opengraph-image.tsx` next
 * to the page) because Next.js forbids sub-segments under an optional
 * catch-all route — the docs page itself is at `[[...slug]]`, so the image
 * can't be colocated. `generateMetadata` in the docs page points at this
 * route instead.
 */
export const size = { width: 1200, height: 630 }

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug?: string[] }> },
) {
  const { slug } = await context.params
  const page = source.getPage(slug)

  const title = page?.data.title ?? 'REJ Studio Docs'
  const description =
    page?.data.description ??
    'Search genes, browse isoforms, and design optimized RNA End-Joining sequences.'
  const urlPath = page?.url ?? '/docs'
  const [displayFont, sansFont] = await Promise.all([
    loadDisplayFont(),
    loadSansFont(),
  ])

  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 80px',
        width: '100%',
        height: '100%',
        backgroundColor: OG_BG,
        color: OG_FG,
        fontFamily: '"Source Sans 3", system-ui, sans-serif',
        backgroundImage: `radial-gradient(circle at 85% 10%, ${OG_ACCENT}99 0%, transparent 55%), radial-gradient(circle at 10% 95%, ${OG_PRIMARY}26 0%, transparent 60%)`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontFamily: '"Source Sans 3", system-ui, sans-serif',
            fontWeight: 600,
            letterSpacing: '0.12em',
            color: OG_MUTED,
            textTransform: 'uppercase',
          }}
        >
          REJ Studio
        </span>
        <span style={{ color: OG_BORDER, fontSize: 22 }}>/</span>
        <span
          style={{
            fontSize: 22,
            color: OG_PRIMARY,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Docs
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        <div
          style={{
            fontSize: 76,
            fontFamily: '"Source Serif 4", serif',
            fontWeight: 700,
            letterSpacing: '-0.025em',
            lineHeight: 1.05,
            color: OG_FG,
            maxWidth: '100%',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 28,
            color: OG_MUTED,
            lineHeight: 1.35,
            maxWidth: '90%',
          }}
        >
          {description}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: `1px solid ${OG_BORDER}`,
          paddingTop: 24,
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontFamily: '"Source Sans 3", system-ui, sans-serif',
            fontWeight: 600,
            color: OG_MUTED,
          }}
        >
          rejstudio.com{urlPath}
        </span>
        <span
          style={{
            fontSize: 22,
            fontFamily: 'monospace',
            color: OG_PRIMARY,
            letterSpacing: '0.1em',
          }}
        >
          ATG · · · TAA
        </span>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: 'Source Serif 4',
          data: displayFont,
          weight: 700,
          style: 'normal',
        },
        {
          name: 'Source Sans 3',
          data: sansFont,
          weight: 600,
          style: 'normal',
        },
      ],
      headers: {
        // Long-lived CDN cache: scrapers and feed readers shouldn't touch
        // the renderer more than once per hour per slug. SWR lets stale
        // assets keep serving while the edge refreshes in the background.
        'Cache-Control':
          'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      },
    },
  )
}
