import { createFileRoute } from '@tanstack/react-router'

import { PageTitle } from '@/components/page-title'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { appCopy } from '@/copy/app'
import { commonCopy } from '@/copy/common'

export const Route = createFileRoute('/architecture')({
  // Internal page: kept out of search engines, as before.
  head: () => ({
    meta: [
      { title: appCopy.metadata.title(commonCopy.pageContext.architecture) },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: ArchitecturePage,
})

// ── Shared primitives ───────────────────────────────────────────────────────

function Arrow({
  direction = 'down',
  label,
}: {
  direction?: 'down' | 'right' | 'left' | 'bidirectional'
  label?: string
}) {
  if (direction === 'right') {
    return (
      <div className="flex flex-col items-center justify-center gap-0.5 px-2">
        {label && (
          <span className="type-micro whitespace-nowrap text-muted-foreground">
            {label}
          </span>
        )}
        <div className="text-lg leading-none text-muted-foreground">→</div>
      </div>
    )
  }
  if (direction === 'left') {
    return (
      <div className="flex flex-col items-center justify-center gap-0.5 px-2">
        {label && (
          <span className="type-micro whitespace-nowrap text-muted-foreground">
            {label}
          </span>
        )}
        <div className="text-lg leading-none text-muted-foreground">←</div>
      </div>
    )
  }
  if (direction === 'bidirectional') {
    return (
      <div className="flex flex-col items-center justify-center gap-0.5 px-2">
        {label && (
          <span className="type-micro whitespace-nowrap text-muted-foreground">
            {label}
          </span>
        )}
        <div className="text-lg leading-none text-muted-foreground">↔</div>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center gap-0.5 py-1">
      {label && (
        <span className="type-micro whitespace-nowrap text-muted-foreground">
          {label}
        </span>
      )}
      <div className="text-lg leading-none text-muted-foreground">↓</div>
    </div>
  )
}

function ServiceBox({
  name,
  tech,
  details,
  variant = 'default',
}: {
  name: string
  tech: string
  details?: string[]
  variant?: 'default' | 'primary' | 'accent' | 'muted'
}) {
  const bg = {
    default: 'bg-card border',
    primary: 'bg-primary/5 border border-primary/20',
    accent: 'bg-chart-1/5 border border-chart-1/20',
    muted: 'bg-muted border border-border',
  }[variant]

  return (
    <div className={`rounded-2xl p-3 ${bg}`}>
      <div className="mb-0.5 text-sm font-semibold">{name}</div>
      <div className="font-mono type-nano text-muted-foreground">{tech}</div>
      {details && (
        <div className="mt-1.5 space-y-0.5 type-micro text-muted-foreground">
          {details.map((d) => (
            <div key={d}>• {d}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main diagram ────────────────────────────────────────────────────────────

function ArchitecturePage() {
  return (
    // Focusable region: this page has no links or controls, so without it
    // keyboard users couldn't scroll the main content (axe
    // scrollable-region-focusable).
    <div
      role="region"
      tabIndex={0}
      aria-labelledby="architecture-title"
      className="mx-auto max-w-5xl space-y-6 rounded-2xl p-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div>
        <PageTitle id="architecture-title">REJ Studio — Architecture</PageTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          System overview: everything runs in the browser, from static files.
        </p>
      </div>

      {/* ── Layer 1: Client ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Badge variant="outline" className="font-mono text-xs">
              Client
            </Badge>
            Browser — TanStack Start (SPA)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <ServiceBox
              name="Gene Search"
              tech="TanStack Query + static index"
              details={[
                'Index fetched once per load',
                'MiniSearch: prefix + typo matching',
                'Favorites & recents (localStorage)',
              ]}
            />
            <ServiceBox
              name="Design Tool"
              tech="React Hook Form + Zod + Web Worker"
              details={[
                'CDS validation',
                'Optimizer in a worker (WebAssembly)',
                'History in IndexedDB',
              ]}
            />
            <ServiceBox
              name="Shared UI"
              tech="shadcn/ui + Base UI + cmdk"
              details={[
                'Dark/light theme',
                'Command palette (⌘K)',
                'Responsive layout',
              ]}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2 type-micro text-muted-foreground">
            <Badge variant="secondary" className="type-micro">
              Source Sans/Serif/Mono
            </Badge>
            <Badge variant="secondary" className="type-micro">
              Tailwind v4
            </Badge>
            <Badge variant="secondary" className="type-micro">
              TanStack Router (typed search params)
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Arrow label="Static files over HTTPS" />

      {/* ── Layer 2: Cloudflare ──────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Badge variant="outline" className="font-mono text-xs">
              Edge
            </Badge>
            Cloudflare Worker (wrangler.jsonc)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <ServiceBox
              name="Static assets"
              tech="Prerendered pages + SPA shell"
              details={[
                'Static pages arrive as HTML; the rest get the shell',
                'Hashed /assets/* cached a year',
                'Optimizer .wasm, ?v=<sha256>',
              ]}
              variant="muted"
            />
            <ServiceBox
              name="Passcode gate"
              tech="In the Worker, signed cookie"
              details={['One shared passcode', 'MCP keeps its own tokens']}
              variant="muted"
            />
            <ServiceBox
              name="Worker"
              tech="TanStack Start server entry"
              details={[
                'Renders the shell for unmatched requests',
                'Server routes arrive in slice 4',
              ]}
              variant="muted"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Layer 3: What the browser loads ──────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Arrow label="fetch, one version" />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Badge className="border border-chart-2/20 bg-chart-2/10 font-mono type-micro text-foreground">
                  Data
                </Badge>
                Gene corpus (R2 at cutover)
              </CardTitle>
            </CardHeader>
            <CardContent className="type-nano">
              <div className="space-y-1">
                <div className="font-mono text-muted-foreground">
                  VITE_GENE_DATA_URL
                </div>
                <div>
                  • <span className="font-mono">index.json</span> — searchable
                  fields, columnar
                </div>
                <div>
                  • <span className="font-mono">genes/&lt;id&gt;.json</span> — a
                  gene and its isoforms
                </div>
                <div>
                  • <span className="font-mono">transcripts/</span>,{' '}
                  <span className="font-mono">symbols/</span> — lookups
                </div>
                <div className="mt-1.5 text-muted-foreground">
                  Immutable versions; unset reads the 24-gene sample
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-2">
          <Arrow label="Web Worker" />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Badge className="border border-chart-1/20 bg-chart-1/10 font-mono type-micro text-foreground">
                  Compute
                </Badge>
                Optimizer (Rust → WebAssembly)
              </CardTitle>
            </CardHeader>
            <CardContent className="type-nano">
              <div className="space-y-1">
                <div className="font-mono text-muted-foreground">
                  rust/optimizer
                </div>
                <div>• The six DNAChisel objectives, ported</div>
                <div>• WGGW recoding and the 5′/3′ split</div>
                <div>• Seeded runs are reproducible</div>
                <div className="mt-1.5 text-muted-foreground">
                  Checked against frozen DNAChisel 3.2.16 fixtures
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Layer 4: Build and deploy ────────────────────────────────── */}
      <Separator className="my-2" />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Badge variant="outline" className="font-mono text-xs">
              Deploy
            </Badge>
            Build and Deploy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 rounded-xl bg-muted/50 p-3 type-nano">
              <div className="mb-1 text-sm font-semibold">App</div>
              <div>1. pnpm build (Vite+): client bundle, Worker, SPA shell</div>
              <div>2. pnpm cf:deploy → wrangler deploy</div>
            </div>
            <div className="space-y-1 rounded-xl bg-muted/50 p-3 type-nano">
              <div className="mb-1 text-sm font-semibold">Gene data</div>
              <div>1. Source CSV → pnpm data:genes → JSONL seed</div>
              <div>2. pnpm corpus:build → one corpus version</div>
              <div>3. Upload to R2; point VITE_GENE_DATA_URL at it</div>
            </div>
          </div>

          <Separator className="my-3" />

          <div>
            <div className="mb-2 type-overline">Observability</div>
            <div className="flex flex-wrap gap-2">
              <Badge className="border border-chart-4/20 bg-chart-4/10 type-micro text-foreground">
                Console logger — error boundaries
              </Badge>
              <Badge className="border border-chart-5/20 bg-chart-5/10 type-micro text-foreground">
                Sentry for Start — at cutover
              </Badge>
              <Badge className="border border-chart-3/20 bg-chart-3/10 type-micro text-foreground">
                Cloudflare Web Analytics — at cutover
              </Badge>
              <Badge className="border border-chart-2/20 bg-chart-2/10 type-micro text-foreground">
                Workers observability
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Data flow legend ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Data Flow</CardTitle>
        </CardHeader>
        <CardContent className="type-nano">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            <div>
              <div className="mb-1 font-semibold">Gene Search</div>
              <div className="space-y-0.5 text-muted-foreground">
                <div>1. Route loader fetches index.json once</div>
                <div>
                  2. Queries rank in the browser (full text + substring)
                </div>
                <div>3. A gene page reads one genes/&lt;id&gt;.json</div>
                <div>4. TanStack Query caches both for the session</div>
              </div>
            </div>
            <div>
              <div className="mb-1 font-semibold">Design Tool</div>
              <div className="space-y-0.5 text-muted-foreground">
                <div>1. Form validated (Zod); the worker warms on mount</div>
                <div>2. The .wasm designs the sequence, reporting progress</div>
                <div>3. The result is saved to this browser&apos;s history</div>
                <div>
                  4. A Web Lock and unload guard keep the run until it settles
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="pb-8 text-center text-xs text-muted-foreground">
        Generated from the codebase design system — shadcn/ui, Tailwind v4,
        Source typeface family (Sans, Serif, Mono).
      </p>
    </div>
  )
}
