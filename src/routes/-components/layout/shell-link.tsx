import { Link, type LinkComponentProps } from '@tanstack/react-router'

import { useHydrated } from '@/hooks/use-hydrated'

/**
 * A sidebar link that carries no active state until the page has hydrated.
 *
 * `Link` marks itself active from the router's location, writing
 * `data-status="active"` and `aria-current="page"` onto the anchor. Neither
 * can be overridden by a prop, and in prerendered HTML both are decided by
 * the path the *build* rendered at, not the path the visitor asked for:
 *
 * - `dist/client/_shell.html` is prerendered with the router at `/` (SPA
 *   mode's shell job owns that path), and the Worker serves that one file
 *   for every URL that is not a prerendered page. So the Home link arrived
 *   marked as the current page on `/genes/TP53`, on the design tool with a
 *   `?job=`, and on every unknown URL.
 * - The browser then rendered the same link inactive, the attributes
 *   disagreed, and React threw the hydrated tree away and rendered it again
 *   (#418) — the opposite of what prerendering the shell is for. A screen
 *   reader was also told "Home, current page" on every deep link.
 *
 * Rendering a plain anchor until hydration fixes both halves at once,
 * because `useHydrated`'s server snapshot is used for the hydrating render
 * too: the prerendered HTML and the browser's first render both have no
 * active state, whatever URL they are for, and the real one appears in the
 * next commit. Same element, same href, same classes — only attributes
 * change, so nothing moves.
 *
 * Before hydration the anchor is a real navigation rather than a routed
 * one, which is what a click did at that point anyway.
 */
/**
 * Deliberately an anchor's props plus `to`, not all of `Link`'s: the two
 * branches have to render the same element, so the router-only options
 * (`replace`, `resetScroll`, a render-prop `children`) have no home in the
 * pre-hydration anchor and are not accepted here.
 */
type ShellLinkProps = React.ComponentProps<'a'> & {
  to: LinkComponentProps<'a'>['to']
}

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
