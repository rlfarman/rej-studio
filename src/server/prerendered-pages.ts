/**
 * The pages the build prerenders as real HTML, shared by vite.config.ts
 * (which writes them) and the Worker (which serves them).
 *
 * Everything else, and most of these with a query string, gets the SPA shell
 * (`SHELL_PATH`): an empty frame the client fills in. A prerendered page
 * puts its content in the first response, so it paints before any
 * JavaScript runs (TanStack Start recommends prerendering as much as an SPA
 * can). It must render the same way for everyone, which these do: what
 * depends on the visitor (history, favorites, the sidebar's state) renders
 * after hydration, as it does in the shell.
 *
 * Where a query string changes what a page shows (`?job=`, `?isoform=`),
 * HTML rendered for the bare path would hydrate as the wrong page, so those
 * requests get the shell; `QUERY_INDEPENDENT_PAGES` below are the ones whose
 * HTML is the same either way, and are served as themselves.
 */
export const PRERENDERED_PAGES = [
  '/',
  '/design-tool',
  '/architecture',
  '/login',
] as const

/**
 * The prerendered pages that render the same HTML whatever the query string,
 * so the Worker serves the page itself rather than the shell.
 *
 * `/login` is the one: it reads `?error=` and `?return_to=` only after
 * hydration (src/routes/login.tsx), precisely so its first paint is the same
 * for every /login URL. Serving the page is what puts the form, and its
 * `<noscript>` note, in front of a visitor whose JavaScript never runs —
 * which is the only way a refused passcode (`/login?error=passcode`, where
 * /api/login sends it) shows up at all without JavaScript.
 */
const QUERY_INDEPENDENT_PAGES: readonly string[] = ['/login']

/** Where the shell is written; the Worker serves it by this path. */
export const SHELL_FILE = '/_shell.html'
export const SHELL_PATH = '/_shell'

/**
 * A prerendered page's file. `/x.html` rather than `/x/index.html`: the
 * asset layer serves `x.html` at `/x`, where `x/index.html` would redirect
 * `/x` to `/x/`.
 */
export function prerenderedFile(path: string): string {
  return path === '/' ? '/index.html' : `${path}.html`
}

/**
 * The URL the build fetches a page from. The prerenderer keeps one job per
 * path, and SPA mode's shell job is `/`, so the home page is fetched as
 * `/?prerender` (a query string the Worker answers with a render, there
 * being no files yet at build time) and written to /index.html all the same.
 */
export function prerenderJobPath(path: string): string {
  return path === '/' ? '/?prerender' : path
}

export function isPrerenderedPage(pathname: string): boolean {
  return (PRERENDERED_PAGES as readonly string[]).includes(pathname)
}

/**
 * Whether a navigation has to be answered with the shell rather than a file:
 * a prerendered page carrying a query string its content depends on. Every
 * other request looks for its own file first (worker-entry.ts).
 *
 * @param search the URL's query string, `''` when there is none.
 */
export function needsShell(pathname: string, search: string): boolean {
  return (
    search !== '' &&
    isPrerenderedPage(pathname) &&
    !QUERY_INDEPENDENT_PAGES.includes(pathname)
  )
}
