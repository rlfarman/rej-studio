// The sizes scripts/build-branding-images.mjs writes to public/branding/:
// the logo at 16 CSS px wide, for 1x, 2x and 3x screens.
const LOGO_WIDTHS = [16, 32, 48] as const
// Intrinsic size at 1x, so the box is reserved before the image loads.
const WIDTH = 16
const HEIGHT = 10
const NAME = 'salk-logo'

/**
 * The Salk logo, in the sidebar's one link that leaves the app.
 *
 * One image, drawn at 16 CSS px. It is not lazy: it is in the viewport on
 * every page, and a lazy image there arrives after layout and shifts it —
 * Lighthouse named this logo as a layout-shift culprit on /design-tool when
 * it was.
 *
 * The logo is monochrome, so dark mode inverts it rather than fetching a
 * second asset. Before, a white-ink copy was rendered beside this one and
 * hidden by the theme; both were in the DOM, and `loading="lazy"` was what
 * kept the hidden one from being fetched. Inverting drops the second copy,
 * the second set of files, and the reason to be lazy.
 */
export function SalkLogo({ alt }: { alt: string }) {
  return (
    <img
      src={`/branding/${NAME}-${WIDTH}.png`}
      srcSet={LOGO_WIDTHS.map(
        (width) => `/branding/${NAME}-${width}.png ${width / WIDTH}x`,
      ).join(', ')}
      alt={alt}
      width={WIDTH}
      height={HEIGHT}
      decoding="async"
      className="block h-auto w-4 shrink-0 dark:invert"
    />
  )
}
