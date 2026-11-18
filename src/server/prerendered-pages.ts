/**
 * The pages the build prerenders as real HTML, shared by vite.config.ts
 * (which writes them) and the Worker (which serves them).
 *
 * Everything else, and any of these with a query string, gets the SPA shell
 * (`SHELL_PATH`): an empty frame the client fills in. A prerendered page
 * puts its content in the first response, so it paints before any
 * JavaScript runs (TanStack Start recommends prerendering as much as an SPA
 * can). It must render the same way for everyone, which these do: what
 * depends on the visitor (history, favorites, the sidebar's state) renders
 * after hydration, as it does in the shell.
 *
 * A query string changes what a page shows (`?job=`, `?isoform=`), and HTML
 * rendered for the bare path would hydrate as the wrong page, so those
 * requests get the shell.
 */
export const PRERENDERED_PAGES = [
  '/',
  '/design-tool',
  '/architecture',
  '/login',
] as const

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
