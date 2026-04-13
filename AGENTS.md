# AGENTS.md

## Project Overview

REJ Studio is a bioinformatics web app for RNA End-Joining sequence design. Users search genes, view isoforms, and submit coding sequences (DNA or protein) for optimization via a Python/FastAPI backend that uses the dnachisel library. Protein sequences are reverse-translated to DNA on the frontend using species-preferred codons before optimization.

## Architecture

- **Next.js 16 (App Router)** — Frontend and server actions. Route groups: `(search)` for gene browsing, `(design-tool)` for the optimization form. Frontend source lives under `src/`.
- **Bulletproof-react structure** — Code is organized into `src/features/<feature>/` (self-contained: `api/`, `components/`, `hooks/`, `stores/`, `types/`, `utils/`) plus shared layers (`src/components/`, `src/lib/`, `src/hooks/`, `src/stores/`). Cross-feature imports and shared→feature imports are forbidden by ESLint (`import/no-restricted-paths`).
- **FastAPI (Python)** — Runs the DNA optimization algorithm. Canonical code lives in `python/`. Single endpoint: `POST /api/py/process`. In development, Next.js proxies `/api/py/*` to a local uvicorn at `localhost:8000`. In production Python does NOT run on Vercel or Cloudflare — it's deployed to Modal and called directly from server actions. `COMPUTE_BACKEND=modal` is required in prod on every host; the local backend is dev-only.
- **Neon (Postgres) + Drizzle ORM** — Read-only gene/isoform/sequence data. The app connects to Neon over HTTP via `@neondatabase/serverless`. Seed Neon with `pnpm db:build` + `pnpm db:upload`. Schema in `src/drizzle/schema.ts`.
- **shadcn/ui + Radix UI** — Component library. UI primitives live in `src/components/ui/`. Config in `components.json`.
- **Zustand** — Global client state (favorites, recent genes, species filter) lives in `src/stores/` (shared) or `src/features/<feature>/stores/` (feature-owned).

## Key Directories

| Path                  | Purpose                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/app/`            | Next.js pages, layouts, and route-specific `_components/` (App Router)                               |
| `src/features/`       | Self-contained feature modules (`gene-search`, `design-tool`); server actions here                   |
| `src/components/ui/`  | shadcn/ui primitives                                                                                 |
| `src/components/bio/` | Bio-domain widgets (species select, diagnostic badges, DNA icon)                                     |
| `src/components/`     | Generic shared widgets (top-level)                                                                   |
| `src/lib/bio/`        | Bio-domain utilities (species types, FASTA, sequence utils, reverse translation, design suitability) |
| `src/lib/`            | Generic shared utilities (`cn`, motion, file download) at the top level                              |
| `src/hooks/`          | Generic shared React hooks                                                                           |
| `src/stores/`         | Shared Zustand stores (e.g. species filter)                                                          |
| `src/drizzle/`        | DB schema and client (`schema.ts`, `db.ts`)                                                          |
| `python/`             | FastAPI Python backend (`index.py`, `algorithm.py`, `requirements.txt`)                              |
| `modal/`              | Modal deployment for the Python backend (production compute)                                         |

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
pnpm db:build     # Emit neutral JSONL seed from source CSV (data/*.jsonl)
pnpm db:push      # Create/update tables in $DATABASE_URL from schema.ts
pnpm db:upload    # Load JSONL into $DATABASE_URL via Drizzle (dialect-neutral)
pnpm db:studio    # Browse DB in Drizzle Studio (local.drizzle.studio)
```

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

To seed / refresh:

1. `pnpm db:build` — emit `data/genes.jsonl` + `data/isoforms.jsonl` from `drizzle/transcript_metadata.csv`.
2. `pnpm db:push` — create tables in `$DATABASE_URL` from `schema.ts`.
3. `pnpm db:upload` — load JSONL via Drizzle INSERTs.

## Environment Variables

Defined in `.env.example`. Required: `DATABASE_URL`.

## Commits & Branches

This repo enforces [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) and [Conventional Branch](https://conventional-branch.github.io/) naming via husky hooks and CI. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the allowed types, examples, and bypass instructions.

## Testing

No test suite is currently configured.

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
