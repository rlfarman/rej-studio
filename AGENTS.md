# AGENTS.md

## Project Overview

REJ Studio is a bioinformatics web app for RNA End-Joining sequence design. Users search genes, view isoforms, and submit coding sequences (DNA or protein) for optimization via a Python/FastAPI backend that uses the dnachisel library. Protein sequences are reverse-translated to DNA on the frontend using species-preferred codons before optimization.

## Architecture

- **Next.js 16 (App Router)** — Frontend and server actions. All user-facing routes live under the `(app)` group, which contains `(search)` for gene browsing, `(design-tool)` for the optimization form, and `(internal)` for non-indexed pages (e.g. `/architecture`). Fumadocs powers `/docs`. Frontend source lives under `src/`.
- **Bulletproof-react structure** — Code is organized into `src/features/<feature>/` (self-contained: `api/`, `components/`, `hooks/`, `stores/`, `types/`, `utils/`) plus shared layers (`src/components/`, `src/lib/`, `src/hooks/`, `src/stores/`). Cross-feature imports and shared→feature imports are forbidden by ESLint (`import/no-restricted-paths`).
- **FastAPI (Python)** — Runs the DNA optimization algorithm. Canonical code lives in `python/`. Single endpoint: `POST /api/py/process`. In development, Next.js proxies `/api/py/*` to a local uvicorn at `localhost:8000`. In production Python does NOT run on Vercel or Cloudflare — it's deployed to Modal and called directly from server actions. `COMPUTE_BACKEND=modal` is required in prod on every host; the local backend is dev-only.
- **Postgres + Drizzle ORM** — Authoring source for gene/isoform metadata; not read at runtime. The runtime gene-search read path is fully static (see _Static gene/isoform content_ below). Production uses Neon over HTTP via `@neondatabase/serverless` for `pnpm db:push`/`db:upload`/`content:emit` and for any future read paths. Local dev and CI fall back to PGlite when `DATABASE_URL` is empty, `file:`, or `memory://`. Driver selection is in `src/drizzle/db.ts`; schema is in `src/drizzle/schema.ts`.
- **Static gene/isoform content** — `pnpm content:emit` (run as a `prebuild` hook) reads Postgres once and writes to `public/data/`: a per-gene JSON file under `genes/<symbol>.json` (full gene + isoform payload), `manifest.json` (the `{id, symbol, species}` list that drives `generateStaticParams` and the sitemap), `isoform-index.json` (`{[isoformId]: {symbol, species}}` for the design-tool prefill and ENST search routing), and `search-index-{human,mouse}.json` (species-sharded MiniSearch indexes). The emit step is skipped when `DATABASE_URL` is missing AND the artifacts already exist, so CI builds work without a live DB once cached. Loaders live in `src/lib/content/server.ts`; client search lives in `src/features/gene-search/utils/client-search.ts`.
- **shadcn/ui + Radix UI** — Component library. UI primitives live in `src/components/ui/`. Config in `components.json`.
- **Zustand** — Global client state (favorites, recent genes, species filter) lives in `src/stores/` (shared) or `src/features/<feature>/stores/` (feature-owned).
- **Auth** — Basic-auth guard on the landing page via middleware (`src/proxy.ts`). Engages only when both `BASIC_AUTH_USER` and `BASIC_AUTH_PASSWORD` are set; skip locally with `BYPASS_AUTH=true`. The `/api/health` endpoint optionally gates detailed diagnostics behind `HEALTH_AUTH_TOKEN`.
- **Observability** — Sentry (`sentry.*.config.ts`), OpenTelemetry (`src/instrumentation.ts`, vendor-neutral OTLP), and Google Tag Manager (`NEXT_PUBLIC_GTM_ID`) ship Web Vitals to the dataLayer. Upstash Redis powers distributed rate limiting (`src/lib/rate-limit.ts`), falling back to in-memory when unconfigured.

## Key Directories

| Path                     | Purpose                                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `src/app/`               | Next.js pages, layouts, and route-specific `_components/` (App Router). User-facing routes nest under `(app)/`. |
| `src/features/`          | Self-contained feature modules (`gene-search`, `design-tool`, `onboarding`); server actions here                |
| `src/components/ui/`     | shadcn/ui primitives                                                                                            |
| `src/components/bio/`    | Bio-domain widgets (species select, diagnostic badges, DNA icon)                                                |
| `src/components/`        | Generic shared widgets (top-level)                                                                              |
| `src/lib/bio/`           | Bio-domain utilities (species types, FASTA, sequence utils, reverse translation, design suitability)            |
| `src/lib/analytics/`     | GTM / Web Vitals helpers                                                                                        |
| `src/lib/`               | Generic shared utilities (`cn`, motion, file download, rate-limit, env, logger, retry) at the top level         |
| `src/hooks/`             | Generic shared React hooks                                                                                      |
| `src/stores/`            | Shared Zustand stores (e.g. species filter)                                                                     |
| `src/copy/`              | Shared user-facing copy (`errors.ts`, `common.ts`, `app.ts`). Feature copy lives in `src/features/<f>/copy.ts`  |
| `src/drizzle/`           | DB schema, client, migrations (`schema.ts`, `db.ts`, `migrations/`)                                             |
| `src/proxy.ts`           | Next.js middleware — basic-auth guard and request proxying                                                      |
| `src/instrumentation.ts` | OpenTelemetry bootstrap + Sentry server/edge init                                                               |
| `python/`                | FastAPI Python backend (`index.py`, `algorithm.py`, `requirements.txt`)                                         |
| `modal/`                 | Modal deployment for the Python backend (production compute)                                                    |
| `scripts/`               | Dev tooling — worktree bootstrap, DB build/load, bundle-size checks, schema verify, type generation             |
| `.github/workflows/`     | CI — lint/type-check/test, Python CI, DB CI, Lighthouse, Modal deploy, release-please, security, uptime         |

## Development Commands

```bash
pnpm dev          # Start Next.js + FastAPI concurrently
pnpm build        # Production build (Vercel target)
pnpm build:cf     # Production build (Cloudflare target via @opennextjs/cloudflare)
pnpm preview:cf   # Preview Cloudflare build locally
pnpm deploy:cf    # Deploy to Cloudflare Workers
pnpm lint         # ESLint
pnpm lint:fix     # Auto-fix lint
pnpm format       # Prettier
pnpm type-check   # TypeScript check
pnpm test         # Run vitest (one-shot)
pnpm test:watch   # Run vitest in watch mode
pnpm test:coverage # Run vitest with coverage
pnpm verify       # lint + type-check + test (pre-push gate)
pnpm storybook    # Storybook dev server on :6006
pnpm db:build     # Emit neutral JSONL seed from source CSV (data/*.jsonl)
pnpm db:push      # Create/update tables in $DATABASE_URL from schema.ts
pnpm db:upload    # Load JSONL into $DATABASE_URL via Drizzle (dialect-neutral)
pnpm db:studio    # Browse DB in Drizzle Studio (local.drizzle.studio)
pnpm content:emit # Emit static gene content from Postgres to public/data/
```

## User-Facing Copy

User-facing strings (headings, descriptions, toasts, validation messages, tour content, error pages, button labels, aria-labels with real text) are centralized in typed objects rather than inlined in JSX:

- **Feature-owned copy** lives in `src/features/<feature>/copy.ts` and is consumed only from within that feature.
- **Shared copy** lives in `src/copy/` (`errors.ts`, `common.ts`, `app.ts`) for strings used by ≥2 features or by app chrome.
- **Bio widget copy** for shared bio components lives in `src/components/bio/copy.ts`.
- **Zod validation messages** are pulled from the feature's `copy.ts` — don't inline them in schemas.
- **Interpolation** uses functions on the copy object, not template literals at the call site: `copy.recent.cancelAria(name)` rather than `` `Cancel ${name}` ``.
- **Don't move** tightly-coupled domain vocabulary (e.g. table headers like "Score", "GC", "CpG", "Identity") — those are terminology, not copy.
- **Don't move** strings from shared UI primitives in `src/components/ui/` — callers pass text in; primitives stay reusable.

## Code Conventions

- TypeScript throughout the frontend. Strict mode.
- Server Components by default; `"use client"` only when needed.
- Server actions co-located with the feature that owns them (e.g. `src/features/gene-search/api/genes.ts`).
- Form validation with Zod schemas (see `src/features/design-tool/types/form-schema.ts`). The design tool form supports both DNA and protein input; `sequenceType` controls conditional validation.
- Tailwind CSS for styling. No CSS modules.
- ESLint + Prettier for formatting (config in `eslint.config.mjs`, `prettier.config.mjs`).
- ESLint enforces feature boundaries: features cannot import from each other, and shared layers (`src/components`, `src/lib`, `src/hooks`, `src/stores`) cannot import from features or app. Features auto-discovered from `src/features/` at config load.

## Database

Postgres is the **authoring source** for gene/isoform metadata; it is **not** read at runtime by the gene-search or design-tool flows. Schema is in `src/drizzle/schema.ts`; tables: `genes`, `isoforms`. The Next.js server still talks to Neon via the Neon HTTP driver (`src/drizzle/db.ts`) for tooling (`db:push`, `db:upload`, `content:emit`); local dev and CI fall back to PGlite.

To seed / refresh and republish gene data:

1. `pnpm db:build` — emit `data/genes.jsonl` + `data/isoforms.jsonl` from `drizzle/transcript_metadata.csv`.
2. `pnpm db:push` — create tables in `$DATABASE_URL` from `schema.ts`.
3. `pnpm db:upload` — load JSONL via Drizzle INSERTs.
4. `pnpm content:emit` — read Postgres once and write the static content to `public/data/`.
5. Deploy. Vercel / Cloudflare will run `content:emit` automatically as the `prebuild` hook, but committing or caching the artifacts is fine too.

## Environment Variables

`.env.example` is the source of truth — consult it when adding new config. Variables group by purpose:

- **Core** — `DATABASE_URL` (omit for PGlite dev), `COMPUTE_BACKEND`, `MODAL_API_URL`, `LOCAL_API_URL`, `DEPLOY_TARGET`.
- **Auth** — `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD`, `BYPASS_AUTH`.
- **Public / client** — `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GTM_ID`.
- **Observability** — `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_*`, `OTEL_EXPORTER_OTLP_*`, `OTEL_SERVICE_NAME`.
- **Optional features** — `HEALTH_AUTH_TOKEN`, `MAINTENANCE_MESSAGE`, `UPSTASH_REDIS_REST_*`, `BLOB_READ_WRITE_TOKEN`.
- **Build-time** — `GIT_COMMIT_SHA`, `NEXT_PUBLIC_GITHUB_{OWNER,REPO,BRANCH}`.

Local dev needs nothing to boot (PGlite + in-memory rate limit fill in). Production requires at minimum a Neon `DATABASE_URL` and `COMPUTE_BACKEND=modal` with `MODAL_API_URL`.

## Commits & Branches

This repo enforces [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) and [Conventional Branch](https://conventional-branch.github.io/) naming via husky hooks and CI. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the allowed types, examples, and bypass instructions.

## Testing

[Vitest](https://vitest.dev) is configured (`vitest.config.ts`). Tests are co-located with the code they cover (`*.test.ts` / `*.test.tsx`) across features, lib, stores, and components. Run `pnpm test` (one-shot), `pnpm test:watch`, or `pnpm test:coverage`. The `pnpm verify` script chains lint + type-check + test and is the standard pre-push gate.

Drizzle has an integration test at `src/drizzle/queries.integration.test.ts` that runs against PGlite — it needs no real DB.

## Working in Git Worktrees

Claude agents often run in git worktrees at `.claude/worktrees/<name>/`. A fresh worktree contains only tracked files — it has no `node_modules/`, no `venv/`, and no `.env` (all gitignored), so the app cannot start until it's bootstrapped.

**Before running or building the app in a worktree, run:**

```bash
./scripts/bootstrap-worktree.sh
```

This symlinks `.env` and `venv/` from the main repo and runs `pnpm install` in the worktree.

**Always use absolute paths or paths relative to the worktree root** — do not assume the working directory is the main repo. When in doubt, `pwd` first. Edits, commits, and commands must happen inside the worktree (`.claude/worktrees/<name>/`), not the main repo at the project root.

## Claude Code Settings

Shared Claude Code permissions, deny rules, and sandbox config live in `.agents/settings.json` (symlinked as `.claude/settings.json`). These apply to every worktree and are checked into git.

`autoMode.environment` cannot live in shared project settings (Claude Code ignores it there for safety). To enable [auto permission mode](https://code.claude.com/docs/en/permission-modes), add this to `~/.claude/settings.json` or `.claude/settings.local.json`:

```json
{
  "autoMode": {
    "environment": [
      "Organization: REJ Studio. Primary use: bioinformatics web app (Next.js + FastAPI)",
      "Source control: github.com/rlfarman/rej-studio",
      "Trusted internal services: Turso database at *.turso.io, Vercel deployments at *.vercel.app"
    ]
  }
}
```

## Common Tasks

- **Adding a new UI primitive**: Use `npx shadcn@latest add <component>`. Components go in `src/components/ui/`.
- **Adding a server action**: Place it in the owning feature's `api/` folder (e.g. `src/features/gene-search/api/`). Import `db` from `@/drizzle/db`.
- **Adding a new feature**: Create `src/features/<name>/` with the standard subfolders. ESLint boundary rules apply automatically (no config changes needed).
- **Adding shared code**: If used by ≥2 features, decide by domain: bio-specific → `src/lib/bio/` or `src/components/bio/`; generic → `src/lib/` or `src/components/`.
- **Modifying the optimization algorithm**: Edit `python/algorithm.py`. The FastAPI endpoint is in `python/index.py`. In production this runs on Modal (see `modal/app.py`), so redeploy Modal after changes.
- **Database schema changes**: Edit `src/drizzle/schema.ts`, update `scripts/build-db.py` if the JSONL shape needs to change, then `pnpm db:build && pnpm db:push && pnpm db:upload`. If the change affects what's emitted to `public/data/`, also update `scripts/emit-content.ts` and re-run `pnpm content:emit`.
- **Modifying gene data (reseed)**: `pnpm db:build` (CSV → JSONL) → `pnpm db:push` (sync schema) → `pnpm db:upload` (load JSONL into Postgres) → `pnpm content:emit` (write static JSON to `public/data/`) → deploy. The `prebuild` hook runs `content:emit` automatically, but a manual run is still needed if you're inspecting the output before deploy.
- **Switching DB backend**: Edit `src/drizzle/db.ts` and the connection driver — it's a 5-file change.
- **Switching deploy target (Vercel ↔ Cloudflare)**: Update `next.config.ts` and build scripts.
