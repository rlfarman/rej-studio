// The variants scripts/build-branding-images.mjs writes to public/branding/:
// the logo at 16 CSS px wide, for 1x, 2x and 3x screens.
const LOGO_WIDTHS = [16, 32, 48] as const
// Intrinsic size at 1x, so the box is reserved before the image loads.
const WIDTH = 16
const HEIGHT = 10

function srcSet(name: string, format: 'avif' | 'webp' | 'png') {
  return LOGO_WIDTHS.map(
    (width) => `/branding/${name}-${width}.${format} ${width / WIDTH}x`,
  ).join(', ')
}

/**
 * One theme's Salk logo, AVIF or WebP where supported with a PNG fallback.
 * `ink` is the logo's colour: dark ink for the light theme, light ink for
 * the dark one.
 */
function LogoPicture({
  ink,
  alt,
  className,
}: {
  ink: 'dark' | 'light'
  alt: string
  className: string
}) {
  const name = `salk-logo-${ink}-ink`
  return (
    <picture className={className}>
      <source type="image/avif" srcSet={srcSet(name, 'avif')} />
      <source type="image/webp" srcSet={srcSet(name, 'webp')} />
      <img
        src={`/branding/${name}-${WIDTH}.png`}
        srcSet={srcSet(name, 'png')}
        alt={alt}
        width={WIDTH}
        height={HEIGHT}
        // Lazy: the theme hides one of the two pictures, and a hidden lazy
        // image is never fetched.
        loading="lazy"
        decoding="async"
        className="block h-auto w-4"
      />
    </picture>
  )
}

/** The Salk logo in the current theme's ink. */
export function SalkLogo({ alt }: { alt: string }) {
  return (
    <>
      <LogoPicture
        ink="dark"
        alt={alt}
        className="block shrink-0 dark:hidden"
      />
      <LogoPicture
        ink="light"
        alt={alt}
        className="hidden shrink-0 dark:block"
      />
    </>
  )
}
