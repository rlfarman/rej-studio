# REJ Studio

A web application for RNA End-Joining sequence design and optimization. Scientists can search human and mouse gene databases, browse isoforms, and run codon-optimized sequence designs through an interactive design tool.

## Features

- **Gene Search** — Full-text search across human and mouse genes by symbol, name, Ensembl ID (ENSG/ENST), or disease association. Backed by a tsvector GIN index for fast ranked results with LIKE fallback for substring matches.
- **Gene Detail & Isoforms** — View gene metadata, browse transcript isoforms with length distribution charts, sequence identity matrices, and downloadable coding/protein sequences.
- **Design Tool** — Submit coding sequences for DNAChisel optimization with configurable parameters:
  - Codon optimization
  - Cryptic splice site removal
  - CpG minimization
  - K-mer complexity reduction
  - GC content enforcement
  - WGGW motif insertion
  - Stimulatory intron options
- **User Features** — Favorite genes, search history, dark/light theme, keyboard shortcuts (Cmd+K search).

## Tech Stack

| Layer         | Technology                                                         |
| ------------- | ------------------------------------------------------------------ |
| Frontend      | Next.js 16 (App Router), React 19, TypeScript 6, Tailwind CSS 4    |
| UI            | shadcn/ui, Radix UI, cmdk (command palette)                        |
| State         | React Query (server state), Zustand (client state)                 |
| Backend       | FastAPI (Python) with DNAChisel, deployed on Modal                 |
| Database      | Neon (Postgres) via HTTP driver, Drizzle ORM                       |
| Cache/Infra   | Upstash Redis (rate limiting, circuit breaker, idempotency, DLQ)   |
| Hosting       | Vercel or Cloudflare Workers (Next.js) + Modal (Python)            |
| Observability | Sentry (errors), OpenTelemetry (traces), Google Analytics (vitals) |

## Getting Started

### Prerequisites

- Node.js 24+
- Python 3.11+
- pnpm (any recent version — `packageManager` field handles the rest)

### Setup

1. **Install dependencies**

   ```bash
   pnpm install
   python3 -m venv venv
   source venv/bin/activate
   pip install -r python/requirements.txt
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   At minimum, set `DATABASE_URL` (Neon Postgres connection string). For production, also set `COMPUTE_BACKEND=modal`, `MODAL_API_URL`, and `NEXT_PUBLIC_SITE_URL`. Optionally add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for distributed rate limiting (falls back to in-memory without them). See `.env.example` for all available options.

3. **Populate the database** (first time only)

   ```bash
   pnpm db:build      # emit data/genes.jsonl + data/isoforms.jsonl from source CSV
   pnpm db:push       # create tables in $DATABASE_URL from schema.ts
   pnpm db:upload     # load JSONL via Drizzle
   ```

   After loading, run `scripts/populate-search-vector.sql` against your database to build the full-text search index.

### Development

```bash
pnpm dev
```

Starts both the Next.js dev server (port 3000) and the FastAPI server (port 8000) concurrently. API requests to `/api/py/*` are proxied to FastAPI in development.

To run them individually:

```bash
pnpm next-dev      # Next.js only
pnpm fastapi-dev   # FastAPI only
```

### Verify everything works

```bash
pnpm verify        # lint + format + type-check + knip + build
```

## Scripts

| Command             | Description                                  |
| ------------------- | -------------------------------------------- |
| `pnpm dev`          | Start Next.js + FastAPI concurrently         |
| `pnpm build`        | Production build (Vercel target)             |
| `pnpm build:cf`     | Production build (Cloudflare Workers target) |
| `pnpm start`        | Start production server                      |
| `pnpm lint`         | Run ESLint                                   |
| `pnpm lint:fix`     | Auto-fix lint issues                         |
| `pnpm format`       | Format with Prettier                         |
| `pnpm format:check` | Check formatting without writing             |
| `pnpm type-check`   | TypeScript type checking                     |
| `pnpm knip`         | Find unused exports, deps, and files         |
| `pnpm verify`       | Run all checks + build                       |
| `pnpm analyze`      | Build with bundle analyzer                   |
| `pnpm db:build`     | Emit JSONL seed from source CSV              |
| `pnpm db:push`      | Create/update tables from schema.ts          |
| `pnpm db:upload`    | Load JSONL into the DB via Drizzle           |
| `pnpm db:studio`    | Browse DB with Drizzle Studio                |
| `pnpm doctor`       | Check local dev environment health           |

## Project Structure

```
src/
├── app/                          # Next.js pages and layouts (App Router)
│   ├── (search)/                 # Gene search & detail pages
│   │   └── genes/[symbol]/       # Gene detail with isoforms, OG image
│   ├── (design-tool)/            # Sequence design tool
│   └── api/                      # API routes (health, version, auth)
├── features/                     # Self-contained feature modules
│   ├── gene-search/              # Search API, components, hooks, stores
│   └── design-tool/              # Job submission, form, results
├── components/                   # Shared UI components
│   ├── ui/                       # shadcn/ui primitives
│   └── bio/                      # Bio-domain widgets (species icon, DNA icon)
├── lib/                          # Shared utilities
│   ├── bio/                      # Bio-domain utils (species, FASTA, sequences)
│   └── analytics/                # Typed event tracking and consent
├── hooks/                        # Shared React hooks
├── stores/                       # Shared Zustand stores
└── drizzle/                      # DB schema and client

python/                           # FastAPI backend
├── index.py                      # POST /api/py/process endpoint
└── algorithm.py                  # DNAChisel optimization algorithms

modal/                            # Modal deployment (production compute)
```

Features are self-contained modules (`api/`, `components/`, `hooks/`, `stores/`, `types/`, `utils/`). Cross-feature imports are forbidden by ESLint boundary rules.

## API

### Next.js API Routes

- **`GET /api/health`** — System health check (DB latency, Modal status). Rate-limited; set `HEALTH_AUTH_TOKEN` for detailed output.
- **`GET /api/version`** — Build SHA, timestamp, package version.
- **`POST /api/auth`** — Basic auth endpoint (when `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` are set).

### FastAPI Backend

- **`POST /api/py/process`** — Accepts a coding sequence and optimization options, returns a ZIP containing a report and optimized sequences.

Swagger docs are available at `/docs` in development.

In production, Python runs on [Modal](https://modal.com) and is called from Next.js server actions — not served alongside the frontend. Set `COMPUTE_BACKEND=modal` and `MODAL_API_URL` in production.

## Deployment

The frontend deploys to **Vercel** (default) or **Cloudflare Workers**:

```bash
pnpm build         # Vercel
pnpm build:cf      # Cloudflare
pnpm deploy:cf     # Deploy to Cloudflare Workers
```

The Python backend deploys separately to **Modal**. See `modal/` and the CI workflows in `.github/workflows/modal-deploy.yml`.

## Infrastructure

### Rate Limiting & Distributed State

All rate limiting, idempotency, circuit breaker, dead letter queue, and latency tracking are backed by **Upstash Redis** in production, with automatic in-memory fallback when Redis is unavailable. The free tier (10k requests/day) is sufficient for normal traffic.

| Concern           | Redis key pattern   | Fallback                  |
| ----------------- | ------------------- | ------------------------- |
| Rate limiting     | `rl:<prefix>:*`     | In-memory sliding window  |
| Idempotency       | `inflight:<hash>`   | In-memory Map (10m TTL)   |
| Circuit breaker   | `circuit:modal`     | In-memory object          |
| Dead letter queue | `dlq:jobs`          | In-memory array (cap 50)  |
| DB latency        | `health:db_latency` | In-memory array (cap 100) |

Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to enable. Without them, everything falls back to per-instance in-memory state (fine for single-instance dev/preview).

### Security

- **HSTS** — `Strict-Transport-Security` with preload directive via `next.config.ts` headers.
- **CSRF** — Origin validation in `src/proxy.ts` against a shared allowlist (`src/lib/allowed-origins.ts`).
- **Rate-limited auth** — Basic auth login attempts capped at 5/min per IP (inline in proxy).
- **Request size cap** — 256 KB body limit for mutating requests (proxy).
- **Input validation** — Zod schemas at every server action boundary.

### Health & Version Endpoints

- **`GET /api/health`** — DB ping with latency percentiles (p50/p95/p99), Modal connectivity check. Supports `Authorization: Bearer <token>` for detailed output.
- **`GET /api/version`** — Build SHA, timestamp, and package version.

## Observability

- **Sentry** — Client and server error tracking. Set `NEXT_PUBLIC_SENTRY_DSN` to enable.
- **OpenTelemetry** — Vendor-neutral distributed tracing. Set `OTEL_EXPORTER_OTLP_ENDPOINT` to ship traces (e.g. to Axiom).
- **Google Analytics** — Web Vitals (LCP, CLS, INP) reporting via GTM. Set `NEXT_PUBLIC_GTM_ID`.
- **Structured logging** — JSON output in production (stdout/stderr), human-readable in dev. See `src/lib/logger.ts`.

## CI

GitHub Actions runs on every PR and push to `main`:

- **Lint**, **Format**, **Type Check**, **Knip** (unused code)
- **Build** with bundle-size budget enforcement and PR comments
- **Lighthouse CI** — Performance, accessibility, and SEO audits
- **Dependency Review** — License and vulnerability checks on PRs
- **Python CI** — Lint and type-check the FastAPI backend

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for commit conventions, branch naming, and PR guidelines.

## License

Private.
