# AGENTS.md

## Project Overview

REJ Studio is a bioinformatics web app for RNA End-Joining sequence design. Users search genes, view isoforms, and submit coding sequences for optimization via a Python/FastAPI backend that uses the dnachisel library.

## Architecture

- **Next.js 16 (App Router)** — Frontend and server actions. Route groups: `(search)` for gene browsing, `(design-tool)` for the optimization form.
- **FastAPI (Python)** — Runs the DNA optimization algorithm. Single endpoint: `POST /api/py/process`. In development, Next.js proxies `/api/py/*` to `localhost:8000`.
- **PostgreSQL + Drizzle ORM** — Stores genes, isoforms, sequences, users, jobs, sessions, searches, and favorites. Schema in `drizzle/schema.ts`.
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
npm run dev          # Start Next.js + FastAPI concurrently
npm run build        # Production build
npm run lint         # ESLint
npm run lint:fix     # Auto-fix lint
npm run format       # Prettier
npm run type-check   # TypeScript check
npm run db:seed      # Seed gene database
```

## Code Conventions

- TypeScript throughout the frontend. Strict mode.
- Server Components by default; `"use client"` only when needed.
- Server actions in `actions/` for all database mutations.
- Form validation with Zod schemas (see `app/(design-tool)/design-tool/_components/form-schema.ts`).
- Tailwind CSS for styling. No CSS modules.
- ESLint + Prettier for formatting (config in `eslint.config.mjs`, `prettier.config.mjs`).

## Database

Schema is in `drizzle/schema.ts`. Key tables: `genes`, `isoforms`, `sequences`, `users`, `jobs`, `sessions`, `searches`, `favorites`.

Migrations are in `drizzle/migrations/`. Seed data is in `drizzle/genes.json`.

## Environment Variables

Defined in `.env.example`. Required: `POSTGRES_URL`, `SESSION_SECRET`. The app uses Vercel Postgres (Neon) in production.

## Testing

No test suite is currently configured.

## Common Tasks

- **Adding a new UI component**: Use `npx shadcn@latest add <component>`. Components go in `components/ui/`.
- **Adding a server action**: Create or update a file in `actions/`. Import `db` from `drizzle/db.ts`.
- **Modifying the optimization algorithm**: Edit `api/algorithm.py`. The FastAPI endpoint is in `api/index.py`.
- **Database schema changes**: Edit `drizzle/schema.ts`, then generate and run migrations with Drizzle Kit.
