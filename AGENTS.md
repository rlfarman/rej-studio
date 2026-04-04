# AGENTS.md

## Project Overview

REJ Studio is a bioinformatics web app for RNA End-Joining sequence design. Users search genes, view isoforms, and submit coding sequences for optimization via a Python/FastAPI backend that uses the dnachisel library.

## Architecture

- **Next.js 16 (App Router)** — Frontend and server actions. Route groups: `(search)` for gene browsing, `(design-tool)` for the optimization form.
- **FastAPI (Python)** — Runs the DNA optimization algorithm. Single endpoint: `POST /api/py/process`. In development, Next.js proxies `/api/py/*` to `localhost:8000`.
- **SQLite (better-sqlite3) + Drizzle ORM** — Read-only gene/isoform/sequence data. Database file is built from source data via `pnpm db:build` and checked in as `data/rej-studio.db.gz`. Schema in `drizzle/schema.ts`.
- **shadcn/ui + Radix UI** — Component library. UI components live in `components/ui/`. Config in `components.json`.

## Key Directories

| Path           | Purpose                                                                      |
| -------------- | ---------------------------------------------------------------------------- |
| `app/`         | Next.js pages and layouts (App Router)                                       |
| `api/`         | FastAPI Python backend (`index.py`, `algorithm.py`)                          |
| `actions/`     | Next.js server actions (genes, isoforms, jobs, favorites, searches, session) |
| `components/`  | React components; `components/ui/` is shadcn/ui                              |
| `context/`     | React context providers (favorites, recent genes, species)                   |
| `drizzle/`     | DB schema, migrations, seed script, gene data                                |
| `hooks/`       | Custom React hooks                                                           |
| `lib/`         | Shared utilities (species types, regex, localStorage hook)                   |
| `public/data/` | Static gene data and coding sequence files                                   |

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
- Server actions in `actions/` for all database mutations.
- Form validation with Zod schemas (see `app/(design-tool)/design-tool/_components/form-schema.ts`).
- Tailwind CSS for styling. No CSS modules.
- ESLint + Prettier for formatting (config in `eslint.config.mjs`, `prettier.config.mjs`).

## Database

Read-only SQLite database (`data/rej-studio.db`, decompressed from `data/rej-studio.db.gz` at build time). Schema is in `drizzle/schema.ts`; tables: `genes`, `isoforms`.

Rebuild from source data with `pnpm db:build` (runs `scripts/build-db.py`).

## Environment Variables

Defined in `.env.example`. Required: `SESSION_SECRET`.

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

- **Adding a new UI component**: Use `npx shadcn@latest add <component>`. Components go in `components/ui/`.
- **Adding a server action**: Create or update a file in `actions/`. Import `db` from `drizzle/db.ts`.
- **Modifying the optimization algorithm**: Edit `api/algorithm.py`. The FastAPI endpoint is in `api/index.py`.
- **Database schema changes**: Edit `drizzle/schema.ts` and update `scripts/build-db.py` so the generated SQLite file matches. Then run `pnpm db:build` and commit the updated `data/rej-studio.db.gz`.
