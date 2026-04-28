# AGENTS.md

## Project Overview

REJ Studio is a bioinformatics web app for RNA End-Joining sequence design. Users search genes, view isoforms, and submit coding sequences (DNA or protein) for optimization via a Python/FastAPI backend that uses the dnachisel library. Protein sequences are reverse-translated to DNA on the frontend using species-preferred codons before optimization.

## Architecture

- **Next.js 16 (App Router)** — Frontend and server actions. All user-facing routes live under the `(app)` group, which contains `(search)` for gene browsing, `(design-tool)` for the optimization form, and `(internal)` for non-indexed pages (e.g. `/architecture`). Fumadocs powers `/docs`. Frontend source lives under `src/`.
- **Bulletproof-react structure** — Code is organized into `src/features/<feature>/` (self-contained: `api/`, `components/`, `hooks/`, `stores/`, `types/`, `utils/`) plus shared layers (`src/components/`, `src/lib/`, `src/hooks/`, `src/stores/`). Cross-feature imports and shared→feature imports are forbidden by ESLint (`import/no-restricted-paths`).
- **FastAPI (Python)** — Runs the DNA optimization algorithm. Canonical code lives in `python/`. Single endpoint: `POST /api/py/process`. In development, Next.js proxies `/api/py/*` to a local uvicorn at `localhost:8000`. In production Python does NOT run on Vercel or Cloudflare — it's deployed to Modal and called directly from server actions. `COMPUTE_BACKEND=modal` is required in prod on every host; the local backend is dev-only.
- **Postgres + Drizzle ORM** — Read-only gene/isoform/sequence data. Production uses Neon over HTTP via `@neondatabase/serverless`. Local dev and CI fall back to PGlite (embedded Postgres) when `DATABASE_URL` is empty, a `file:` path, or `memory://` — full Postgres compatibility including `tsvector` and GIN indexes. Driver selection is in `src/drizzle/db.ts`; schema is in `src/drizzle/schema.ts`. On first PGlite boot, `initPglite()` auto-applies `src/drizzle/migrations/0000_initial.sql` and loads the committed sample seed (`data/sample-genes.jsonl` + `data/sample-isoforms.jsonl`, 24 genes / 228 isoforms with real CDS) so gene search and the design-tool optimizer work end-to-end with zero setup. Run `pnpm db:fetch` to swap the sample seed for the full prebuilt corpus tarball pinned in `package.json` (downloaded from a GitHub Release, SHA-256 verified).
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

Primary store is a Neon (Postgres) database. The Next.js server connects via the Neon HTTP driver (`src/drizzle/db.ts`); every query is a serverless HTTP round-trip. Schema is in `src/drizzle/schema.ts`; tables: `genes`, `isoforms`.

App code uses dialect-neutral SQL (Drizzle query builder + `LOWER(col) LIKE '%x%'`) so the DB backend can be swapped without touching queries.

**Local dev (PGlite):** No setup needed. On first `getDb()` call, `initPglite()` checks for the `genes` table and, if missing, applies `src/drizzle/migrations/0000_initial.sql` and loads the committed sample seed at `data/sample-genes.jsonl` + `data/sample-isoforms.jsonl`. Delete `data/local.db/` to re-bootstrap. The sample covers 24 well-known genes (TP53, BRCA1/2, EGFR, KRAS, MYC, INS, etc.) with real CDS + protein sequences for all 228 isoforms — gene search and the design-tool optimizer both work end-to-end with no further setup.

**Full corpus locally (`pnpm db:fetch`):** Downloads the prebuilt PGlite tarball pinned in `package.json`'s `corpus` field from a GitHub Release via `gh release download` (rej-studio is a private repo, so auth flows through your existing `gh auth login`), verifies SHA-256, and extracts to `data/local.db/`. One command, no Python, no CSV. `initPglite()` reads the version from `data/local.db/.corpus-version` and logs `[pglite] Full corpus (vN, …)` on boot. Run `pnpm db:reset` to wipe `data/local.db/` and fall back to the sample seed.

**Maintainer-only — publishing a new corpus version:**

1. Build a fresh `data/local.db/` from Neon (e.g. via `pnpm db:build && pnpm db:push && pnpm db:upload` against `drizzle/transcript_metadata.csv`, or by snapshotting Neon directly).
2. `tar czf rej-corpus-vN.tar.gz -C data local.db && shasum -a 256 rej-corpus-vN.tar.gz`
3. `gh release create corpus-vN --title "Corpus vN" --notes "…"` (creates the release with no asset).
4. `gh release upload corpus-vN rej-corpus-vN.tar.gz` (upload separately — uploading at create time has hit `HTTP 400` for ~250 MB assets).
5. Bump `package.json`'s `corpus.{version,tag,asset,sha256}` and open a PR. Contributors pick up the new version on next `pnpm db:fetch`.

For seeding a Neon database (production), the same `db:build`/`db:push`/`db:upload` pipeline still works against `$DATABASE_URL`.

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
- **Database schema changes**: Edit `src/drizzle/schema.ts`, update `scripts/build-db.py` if the JSONL shape needs to change, then `pnpm db:build && pnpm db:push && pnpm db:upload`.
- **Switching DB backend**: Edit `src/drizzle/db.ts` and the connection driver — it's a 5-file change.
- **Switching deploy target (Vercel ↔ Cloudflare)**: Update `next.config.ts` and build scripts.
