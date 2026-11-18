/**
 * Sentry for the browser half of the app.
 *
 * Loaded lazily, on purpose. `@sentry/react` is a large dependency, and the
 * shared client shell has a 340 KB gzip budget it already spends ~264 KB of
 * (scripts/bundle-size.mjs), with CI failing any route that grows more than
 * BUNDLE_MAX_GROWTH_KB (10 KB) against `main`. A static import would blow
 * that cap on every route at once, so the SDK is a dynamic import: the shell
 * grows by the few hundred bytes of this module and Sentry arrives in its own
 * async chunk just after hydration. The cost is a short window at startup
 * where an error only reaches the console — `reportError` queues anything
 * raised in it and flushes once the SDK is up.
 *
 * Everything the SDK provides is pulled in by name rather than as a namespace
 * object, because a namespace keeps the whole barrel alive and that barrel
 * includes Session Replay, user feedback and five router integrations this
 * app has no use for.
 *
 * The DSN is build-time (`VITE_SENTRY_DSN`, inlined by Vite). With it unset —
 * local dev, CI, Storybook — the import is unreachable, so the bundler drops
 * it and the chunk is never even emitted.
 */

type SentryApi = typeof import('@sentry/react')
type CaptureException = SentryApi['captureException']

/** Inlined at build time; a DSN is public, so this is safe in the bundle. */
const DSN = import.meta.env.VITE_SENTRY_DSN

/**
 * The router instance Start hydrated, published by `src/router.tsx`.
 *
 * `tanstackRouterBrowserTracingIntegration` needs the live router to name
 * spans after route patterns (`/genes/$symbol`) instead of URLs, and
 * `<StartClient />` builds the router itself rather than handing it back. The
 * promise is resolved from the router factory, which runs before hydration
 * finishes, and is simply never resolved on the Worker — nothing there calls
 * `initBrowserSentry`.
 */
let resolveRouter!: (router: unknown) => void
const routerReady = new Promise<unknown>((resolve) => {
  resolveRouter = resolve
})

/** Called by `getRouter()` once the browser's router exists. */
export function publishRouterToSentry(router: unknown): void {
  resolveRouter(router)
}

/** The one function kept from the SDK, once it is up. */
let captureException: CaptureException | undefined
let loading: Promise<void> | undefined

interface QueuedError {
  error: unknown
  boundary?: string
}

/**
 * Errors raised before the SDK finished loading. Bounded: a boundary that
 * re-throws in a loop must not grow this without end.
 */
const queued: QueuedError[] = []
const MAX_QUEUED = 10

function capture(
  send: CaptureException,
  { error, boundary }: QueuedError,
): void {
  send(error, boundary ? { tags: { boundary } } : undefined)
}

function load(): Promise<void> {
  if (!DSN) return Promise.resolve()
  loading ??= (async () => {
    const {
      init,
      captureException: send,
      tanstackRouterBrowserTracingIntegration,
    } = await import('@sentry/react')
    const router = await routerReady
    init({
      dsn: DSN,
      environment: import.meta.env.MODE,
      // Modest and deliberate: every error is sent (there are few, and a lab
      // of a handful of people would make a sampled error rate meaningless),
      // while only a tenth of page loads and navigations are traced — enough
      // to see how the corpus fetches and the wasm optimizer behave in the
      // field without paying for a span on every click.
      tracesSampleRate: 0.1,
      // Designs are the user's unpublished research. Nothing that could carry
      // a sequence may leave the browser:
      dataCollection: {
        // No request or response bodies — a cloud design POSTs the sequence.
        httpBodies: [],
        // No user identity: the passcode gate has no per-person identity to
        // report anyway.
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        // `?q=` is only a gene query, but an allowlist of nothing is cheaper
        // to reason about than a denylist.
        urlQueryParams: false,
        // Locals in a stack frame of the design form would hold the sequence
        // being edited.
        stackFrameVariables: false,
      },
      integrations: (defaults) => [
        // Console breadcrumbs would re-send whatever `src/lib/logger.ts`
        // printed, and the optimizer logs design details.
        ...defaults.filter((integration) => integration.name !== 'Console'),
        // Route patterns rather than URLs, so `/genes/BRCA1` and
        // `/genes/TP53` are one transaction.
        tanstackRouterBrowserTracingIntegration(router),
      ],
    })
    captureException = send
    for (const entry of queued.splice(0)) capture(send, entry)
  })()
  return loading
}

/**
 * Starts Sentry, or does nothing at all when `VITE_SENTRY_DSN` is unset.
 * Called once, from the client entry (`src/client.tsx`).
 */
export function initBrowserSentry(): void {
  if (!DSN) return
  void load()
}

/**
 * Reports an error caught by an error boundary. A no-op without a DSN, and
 * queued while the SDK is still loading.
 */
export function reportError(
  error: unknown,
  context?: { boundary?: string },
): void {
  if (!DSN) return
  const entry: QueuedError = { error, ...context }
  if (captureException) {
    capture(captureException, entry)
    return
  }
  if (queued.length < MAX_QUEUED) queued.push(entry)
  void load()
}
