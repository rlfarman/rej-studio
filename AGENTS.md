# AGENTS.md

## Project Overview

REJ Studio is a bioinformatics web app for RNA End-Joining sequence design. Users search genes, view isoforms, and submit coding sequences for optimization via a Python/FastAPI backend that uses the dnachisel library.

## Architecture

- **Next.js 16 (App Router)** — Frontend and server actions. Route groups: `(search)` for gene browsing, `(design-tool)` for the optimization form. Frontend source lives under `src/`.
- **Bulletproof-react structure** — Code is organized into `src/features/<feature>/` (self-contained: `api/`, `components/`, `hooks/`, `stores/`, `types/`, `utils/`) plus shared layers (`src/components/`, `src/lib/`, `src/hooks/`, `src/stores/`). Cross-feature imports and shared→feature imports are forbidden by ESLint (`import/no-restricted-paths`).
- **FastAPI (Python)** — Runs the DNA optimization algorithm. Single endpoint: `POST /api/py/process`. In development, Next.js proxies `/api/py/*` to `localhost:8000`.
- **SQLite (better-sqlite3) + Drizzle ORM** — Read-only gene/isoform/sequence data. Database file is built from source data via `pnpm db:build` and checked in as `data/rej-studio.db.gz`. Schema in `src/drizzle/schema.ts`.
- **shadcn/ui + Radix UI** — Component library. UI primitives live in `src/components/ui/`. Config in `components.json`.
- **Zustand** — Global client state (favorites, recent genes, species filter) lives in `src/stores/` (shared) or `src/features/<feature>/stores/` (feature-owned).

## Key Directories

| Path                  | Purpose                                                                            |
| --------------------- | ---------------------------------------------------------------------------------- |
| `src/app/`            | Next.js pages, layouts, and route-specific `_components/` (App Router)             |
| `src/features/`       | Self-contained feature modules (`gene-search`, `design-tool`); server actions here |
| `src/components/ui/`  | shadcn/ui primitives                                                               |
| `src/components/bio/` | Bio-domain widgets (species select, diagnostic badges, DNA icon)                   |
| `src/components/`     | Generic shared widgets (top-level)                                                 |
| `src/lib/bio/`        | Bio-domain utilities (species types, FASTA, sequence utils, design suitability)    |
| `src/lib/`            | Generic shared utilities (`cn`, motion, file download) at the top level            |
| `src/hooks/`          | Generic shared React hooks                                                         |
| `src/stores/`         | Shared Zustand stores (e.g. species filter)                                        |
| `src/drizzle/`        | DB schema and client (`schema.ts`, `db.ts`)                                        |
| `api/`                | FastAPI Python backend (`index.py`, `algorithm.py`) at repo root                   |
| `public/data/`        | Static gene data and coding sequence files                                         |

## Development Commands

```bash
pnpm dev          # Start Next.js + FastAPI concurrently
pnpm build        # Production build
pnpm lint         # ESLint
pnpm lint:fix     # Auto-fix lint
pnpm format       # Prettier
pnpm type-check   # TypeScript check
pnpm db:build     # Rebuild SQLite database from source data
pnpm db:studio    # Browse the DB in Drizzle Studio (local.drizzle.studio)
```

## Code Conventions

- TypeScript throughout the frontend. Strict mode.
- Server Components by default; `"use client"` only when needed.
- Server actions co-located with the feature that owns them (e.g. `src/features/gene-search/api/genes.ts`).
- Form validation with Zod schemas (see `src/features/design-tool/types/form-schema.ts`).
- Tailwind CSS for styling. No CSS modules.
- ESLint + Prettier for formatting (config in `eslint.config.mjs`, `prettier.config.mjs`).
- ESLint enforces feature boundaries: features cannot import from each other, and shared layers (`src/components`, `src/lib`, `src/hooks`, `src/stores`) cannot import from features or app. Features auto-discovered from `src/features/` at config load.

## Database

Read-only SQLite database (`data/rej-studio.db`, decompressed from `data/rej-studio.db.gz` at build time). Schema is in `src/drizzle/schema.ts`; tables: `genes`, `isoforms`.

Rebuild from source data with `pnpm db:build` (runs `scripts/build-db.py`).

## Environment Variables

Defined in `.env.example`. Required: `SESSION_SECRET`.

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

## Common Tasks

- **Adding a new UI primitive**: Use `npx shadcn@latest add <component>`. Components go in `src/components/ui/`.
- **Adding a server action**: Place it in the owning feature's `api/` folder (e.g. `src/features/gene-search/api/`). Import `db` from `@/drizzle/db`.
- **Adding a new feature**: Create `src/features/<name>/` with the standard subfolders. ESLint boundary rules apply automatically (no config changes needed).
- **Adding shared code**: If used by ≥2 features, decide by domain: bio-specific → `src/lib/bio/` or `src/components/bio/`; generic → `src/lib/` or `src/components/`.
- **Modifying the optimization algorithm**: Edit `api/algorithm.py`. The FastAPI endpoint is in `api/index.py`.
- **Database schema changes**: Edit `src/drizzle/schema.ts` and update `scripts/build-db.py` so the generated SQLite file matches. Then run `pnpm db:build` and commit the updated `data/rej-studio.db.gz`.
