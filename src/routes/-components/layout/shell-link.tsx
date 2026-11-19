import {
  Link,
  useHydrated,
  type LinkComponentProps,
} from '@tanstack/react-router'

/**
 * Anchor props plus `to`: both branches below render the same element, so
 * the router-only options (`replace`, `resetScroll`, a render-prop
 * `children`) have no home in the pre-hydration anchor.
 */
type ShellLinkProps = React.ComponentProps<'a'> & {
  to: LinkComponentProps<'a'>['to']
}

/**
 * A sidebar link that carries no active state until the page has hydrated.
 *
 * `Link` writes `data-status="active"` and `aria-current="page"` from the
 * router's location, and in prerendered HTML that is the path the *build*
 * rendered at, not the one the visitor asked for. `_shell.html` is
 * prerendered at `/` and then served for every URL that is not a prerendered
 * page, so Home arrived marked as the current page on `/genes/TP53`, on a
 * `?job=` link, and on every unknown URL. The browser rendered it inactive,
 * and React threw the hydrated tree away (#418) — the opposite of what
 * prerendering is for. A screen reader was also told "Home, current page" on
 * every deep link.
 *
 * `useHydrated`'s server snapshot is used for the hydrating render too, so
 * the prerendered HTML and the browser's first render agree on "nothing
 * active" whatever URL they are for, and the real state arrives in the next
 * commit. Same element, same href, same classes — only attributes change.
 * Before hydration the anchor is a full navigation, which is what a click
 * did at that point anyway.
 *
 * Why not the documented knob: SPA mode's `spa.maskPath` moves the path the
 * shell is prerendered at, but the prerenderer *fetches* it, so a synthetic
 * path fails the build ("Failed to fetch /_shell: Not Found"). A real page
 * outside the nav would work by accident — adding it to the nav later would
 * quietly bring the bug back — and it would still leave a prerendered page
 * reached with a query string (`/design-tool?job=…`) hydrating against a
 * shell that disagrees with it.
 */
export function ShellLink({ to, children, ...props }: ShellLinkProps) {
  const hydrated = useHydrated()
  if (!hydrated) {
    return (
      <a href={to} {...props}>
        {children}
      </a>
    )
  }
  return (
    <Link to={to} {...props}>
      {children}
    </Link>
  )
}
