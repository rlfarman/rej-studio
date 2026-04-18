import { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageTitle } from '@/components/page-title'
import { Separator } from '@/components/ui/separator'

export const metadata: Metadata = {
  title: 'Architecture',
  robots: { index: false, follow: false },
}

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
          <span className="text-muted-foreground text-[10px] whitespace-nowrap">
            {label}
          </span>
        )}
        <div className="text-muted-foreground text-lg leading-none">→</div>
      </div>
    )
  }
  if (direction === 'left') {
    return (
      <div className="flex flex-col items-center justify-center gap-0.5 px-2">
        {label && (
          <span className="text-muted-foreground text-[10px] whitespace-nowrap">
            {label}
          </span>
        )}
        <div className="text-muted-foreground text-lg leading-none">←</div>
      </div>
    )
  }
  if (direction === 'bidirectional') {
    return (
      <div className="flex flex-col items-center justify-center gap-0.5 px-2">
        {label && (
          <span className="text-muted-foreground text-[10px] whitespace-nowrap">
            {label}
          </span>
        )}
        <div className="text-muted-foreground text-lg leading-none">↔</div>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center gap-0.5 py-1">
      {label && (
        <span className="text-muted-foreground text-[10px] whitespace-nowrap">
          {label}
        </span>
      )}
      <div className="text-muted-foreground text-lg leading-none">↓</div>
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
    <div className={`rounded-lg p-3 ${bg}`}>
      <div className="mb-0.5 text-sm font-semibold">{name}</div>
      <div className="text-muted-foreground font-mono text-[11px]">{tech}</div>
      {details && (
        <div className="text-muted-foreground mt-1.5 space-y-0.5 text-[10px]">
          {details.map((d) => (
            <div key={d}>• {d}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main diagram ────────────────────────────────────────────────────────────

export default function ArchitecturePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <PageTitle>REJ Studio — Architecture</PageTitle>
        <p className="text-muted-foreground mt-1 text-sm">
          System overview of data flow, infrastructure, and deployment topology.
        </p>
      </div>

      {/* ── Layer 1: Client ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Badge variant="outline" className="font-mono text-xs">
              Client
            </Badge>
            Browser
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <ServiceBox
              name="Gene Search"
              tech="React Query + Zustand"
              details={[
                'Debounced search',
                'Favorites & recents',
                'Species filter',
              ]}
            />
            <ServiceBox
              name="Design Tool"
              tech="React Hook Form + Zod"
              details={['CDS validation', 'Option toggles', 'Job polling']}
            />
            <ServiceBox
              name="Shared UI"
              tech="shadcn/ui + Radix + cmdk"
              details={[
                'Dark/light theme',
                'Command palette (⌘K)',
                'Responsive layout',
              ]}
            />
          </div>
          <div className="text-muted-foreground mt-3 flex flex-wrap gap-2 text-[10px]">
            <Badge variant="secondary" className="text-[10px]">
              Source Sans/Serif/Mono
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              Tailwind v4
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              Web Vitals → GTM
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              Sentry (client)
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Arrow label="Server Actions / RSC streaming" />

      {/* ── Layer 2: Edge ────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Badge variant="outline" className="font-mono text-xs">
              Edge
            </Badge>
            Proxy (src/proxy.ts)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            <ServiceBox
              name="CSP"
              tech="Nonce-based"
              details={['strict-dynamic', 'report-to /api/csp-report']}
              variant="muted"
            />
            <ServiceBox
              name="CSRF"
              tech="Origin check"
              details={['Shared allowlist', 'Mutating reqs only']}
              variant="muted"
            />
            <ServiceBox
              name="Auth"
              tech="Basic auth"
              details={['Rate-limited 5/min', 'Timing-safe compare']}
              variant="muted"
            />
            <ServiceBox
              name="Body Cap"
              tech="256 KB limit"
              details={['POST/PUT/PATCH', 'Before server actions']}
              variant="muted"
            />
          </div>
        </CardContent>
      </Card>

      <Arrow label="Next.js App Router" />

      {/* ── Layer 3: Server ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Badge variant="outline" className="font-mono text-xs">
              Server
            </Badge>
            Next.js 16 (App Router)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Features */}
          <div>
            <div className="type-overline mb-2">Features</div>
            <div className="grid grid-cols-2 gap-3">
              <ServiceBox
                name="gene-search"
                tech="Server Actions + RSC"
                details={[
                  'Full-text + LIKE search',
                  'React cache() dedup',
                  'Rate limited (30/min)',
                  'Fuzzy 404 suggestions',
                ]}
                variant="primary"
              />
              <ServiceBox
                name="design-tool"
                tech="Server Actions + polling"
                details={[
                  'Job submit → Modal',
                  'Idempotency (SHA-256)',
                  'Circuit breaker',
                  'Dead letter queue',
                ]}
                variant="accent"
              />
            </div>
          </div>

          <Separator />

          {/* API Routes */}
          <div>
            <div className="type-overline mb-2">API Routes</div>
            <div className="grid grid-cols-4 gap-3">
              <ServiceBox
                name="/api/health"
                tech="GET"
                details={[
                  'DB ping + p50/p95/p99',
                  'Modal probe',
                  'Auth-gated details',
                ]}
                variant="muted"
              />
              <ServiceBox
                name="/api/version"
                tech="GET"
                details={['Build SHA', 'Timestamp', 'Package version']}
                variant="muted"
              />
              <ServiceBox
                name="/api/csp-report"
                tech="POST"
                details={['CSP violations', 'Structured logging']}
                variant="muted"
              />
              <ServiceBox
                name="/api/auth"
                tech="POST"
                details={['Basic auth', 'JSON response']}
                variant="muted"
              />
            </div>
          </div>

          <Separator />

          {/* Infrastructure */}
          <div>
            <div className="type-overline mb-2">Shared Infrastructure</div>
            <div className="grid grid-cols-3 gap-3">
              <ServiceBox
                name="Rate Limiting"
                tech="Upstash → in-memory"
                details={[
                  'Sliding window',
                  'Per-IP keyed',
                  'Retry-After headers',
                ]}
                variant="muted"
              />
              <ServiceBox
                name="Env Validation"
                tech="Zod schemas"
                details={[
                  'Server + client',
                  'Prod guardrails',
                  'Fail-fast boot',
                ]}
                variant="muted"
              />
              <ServiceBox
                name="Observability"
                tech="Logger + OTel + Sentry"
                details={[
                  'Structured JSON logs',
                  'Distributed traces',
                  'Error tracking',
                ]}
                variant="muted"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Layer 4: External services ───────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {/* Database */}
        <div className="space-y-2">
          <Arrow label="HTTP driver" />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Badge className="bg-chart-2/10 text-chart-2 border-chart-2/20 border font-mono text-[10px]">
                  DB
                </Badge>
                Neon (Postgres)
              </CardTitle>
            </CardHeader>
            <CardContent className="text-[11px]">
              <div className="space-y-1">
                <div className="text-muted-foreground font-mono">
                  Drizzle ORM
                </div>
                <div>
                  • <span className="font-semibold">genes</span> — symbol, name,
                  species, tsvector
                </div>
                <div>
                  • <span className="font-semibold">isoforms</span> — CDS,
                  protein, lengths
                </div>
                <div className="text-muted-foreground mt-1.5">
                  GIN index on search_vector
                </div>
                <div className="text-muted-foreground">
                  Indexes on species, CDS length
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Redis */}
        <div className="space-y-2">
          <Arrow label="REST API" />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Badge className="bg-chart-4/10 text-chart-4 border-chart-4/20 border font-mono text-[10px]">
                  Cache
                </Badge>
                Upstash Redis
              </CardTitle>
            </CardHeader>
            <CardContent className="text-[11px]">
              <div className="space-y-1">
                <div className="text-muted-foreground font-mono">
                  Free tier (10k req/day)
                </div>
                <div>
                  • <span className="font-mono">rl:*</span> — rate limits
                </div>
                <div>
                  • <span className="font-mono">inflight:*</span> — idempotency
                </div>
                <div>
                  • <span className="font-mono">circuit:modal</span> — breaker
                </div>
                <div>
                  • <span className="font-mono">dlq:jobs</span> — dead letters
                </div>
                <div>
                  • <span className="font-mono">health:db_latency</span> —
                  p50/p95/p99
                </div>
                <div className="text-muted-foreground mt-1.5">
                  Falls back to in-memory if unavailable
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Modal */}
        <div className="space-y-2">
          <Arrow label="HTTPS + JSON" />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Badge className="bg-chart-1/10 text-chart-1 border-chart-1/20 border font-mono text-[10px]">
                  Compute
                </Badge>
                Modal
              </CardTitle>
            </CardHeader>
            <CardContent className="text-[11px]">
              <div className="space-y-1">
                <div className="text-muted-foreground font-mono">
                  FastAPI + DNAChisel
                </div>
                <div>
                  • <span className="font-mono">POST /jobs</span> — submit
                </div>
                <div>
                  • <span className="font-mono">GET /jobs/:id</span> — poll
                  status
                </div>
                <div>
                  • <span className="font-mono">DELETE /jobs/:id</span> — cancel
                </div>
                <div className="text-muted-foreground mt-1.5">
                  Cold start → warm container
                </div>
                <div className="text-muted-foreground">
                  Structured JSON logs with timings
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Layer 5: Deployment topology ─────────────────────────────── */}
      <Separator className="my-2" />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Badge variant="outline" className="font-mono text-xs">
              Deploy
            </Badge>
            Deployment Topology
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            {/* Vercel path */}
            <div className="space-y-2">
              <div className="text-sm font-semibold">Vercel (default)</div>
              <div className="bg-muted/50 space-y-1 rounded-lg p-3 text-[11px]">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[9px]">
                    Edge
                  </Badge>
                  <span>proxy.ts → Edge Runtime</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[9px]">
                    Serverless
                  </Badge>
                  <span>Server Actions + API routes</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[9px]">
                    CDN
                  </Badge>
                  <span>Static assets + ISR</span>
                </div>
              </div>
            </div>

            {/* Cloudflare path */}
            <div className="space-y-2">
              <div className="text-sm font-semibold">
                Cloudflare Workers (alt)
              </div>
              <div className="bg-muted/50 space-y-1 rounded-lg p-3 text-[11px]">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[9px]">
                    Worker
                  </Badge>
                  <span>@opennextjs/cloudflare adapter</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[9px]">
                    R2/KV
                  </Badge>
                  <span>Static assets + cache</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[9px]">
                    Config
                  </Badge>
                  <span>DEPLOY_TARGET=cloudflare</span>
                </div>
              </div>
            </div>
          </div>

          <Separator className="my-3" />

          <div>
            <div className="type-overline mb-2">Observability Stack</div>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-chart-5/10 text-chart-5 border-chart-5/20 border text-[10px]">
                Sentry — errors
              </Badge>
              <Badge className="bg-chart-2/10 text-chart-2 border-chart-2/20 border text-[10px]">
                OpenTelemetry — traces
              </Badge>
              <Badge className="bg-chart-3/10 text-chart-3 border-chart-3/20 border text-[10px]">
                GTM + GA4 — analytics
              </Badge>
              <Badge className="bg-chart-4/10 text-chart-4 border-chart-4/20 border text-[10px]">
                Structured logs — stdout
              </Badge>
              <Badge className="bg-chart-1/10 text-chart-1 border-chart-1/20 border text-[10px]">
                CSP reports — /api/csp-report
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
        <CardContent className="text-[11px]">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            <div>
              <div className="mb-1 font-semibold">Gene Search</div>
              <div className="text-muted-foreground space-y-0.5">
                <div>1. User types query → 250ms debounce</div>
                <div>2. Server Action → Neon (FTS + LIKE)</div>
                <div>3. Results stream via RSC</div>
                <div>4. React Query caches 30s</div>
              </div>
            </div>
            <div>
              <div className="mb-1 font-semibold">Design Tool (Modal)</div>
              <div className="text-muted-foreground space-y-0.5">
                <div>1. Form validated (Zod) → Server Action</div>
                <div>2. Rate limit → circuit check → idempotency</div>
                <div>3. POST to Modal /jobs → call_id returned</div>
                <div>4. Client polls GET /jobs/:id until complete</div>
              </div>
            </div>
            <div>
              <div className="mt-2 mb-1 font-semibold">
                Design Tool (Local Dev)
              </div>
              <div className="text-muted-foreground space-y-0.5">
                <div>1. Form → Server Action</div>
                <div>2. Synchronous POST to FastAPI :8000</div>
                <div>3. Result returned inline (no polling)</div>
              </div>
            </div>
            <div>
              <div className="mt-2 mb-1 font-semibold">Resilience</div>
              <div className="text-muted-foreground space-y-0.5">
                <div>• Redis down → in-memory fallback</div>
                <div>• Modal down → circuit trips after 5 failures</div>
                <div>• Circuit resets after 30s half-open probe</div>
                <div>• Failed jobs → DLQ (capped at 50)</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-muted-foreground pb-8 text-center text-xs">
        Generated from the codebase design system — shadcn/ui, Tailwind v4,
        Source typeface family (Sans, Serif, Mono).
      </p>
    </div>
  )
}
