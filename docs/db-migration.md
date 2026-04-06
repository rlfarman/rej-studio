# Switching databases

This app has migrated between database backends several times (Vercel Postgres →
git-lfs SQLite → embedded SQLite → Turso → Neon). The code is arranged so that
swapping backends is a localized change, not a codebase-wide rewrite.

## The five touchpoints

When switching DBs, you only need to update these files:

| #   | File                        | What changes                              |
| --- | --------------------------- | ----------------------------------------- |
| 1   | `src/drizzle/db.ts`         | Driver import + client construction       |
| 2   | `src/drizzle/schema.ts`     | Dialect (`pgTable` vs `sqliteTable`, etc) |
| 3   | `drizzle.config.ts`         | `dialect:` field + credentials            |
| 4   | `.env.example` + deploy env | Connection-string variable name(s)        |
| 5   | `package.json` deps         | Swap driver package                       |

**Everything else stays put.** In particular:

- **App code** (`src/features/*/api/`) uses Drizzle's query builder and neutral
  SQL helpers (`LOWER(col) LIKE '%x%'`, plain `eq/or/and`). No ILIKE, no
  `unnest`, no `json_each`, no dialect-specific operators.
- **Seed data** (`data/genes.jsonl`, `data/isoforms.jsonl`) is emitted by
  `scripts/build-db.py` in a neutral JSONL format. The loader
  (`scripts/load-db.ts`) uses Drizzle for INSERTs, so it works against
  whatever `db.ts` points at.
- **`alternateSymbols`** is stored as a pipe-delimited string
  (`|Abca1|Cerp|Tgd|`), not as a Postgres `text[]` or SQLite JSON — so the
  column type is portable and search uses the same `LIKE` pattern everywhere.
  Parse for display with `parseAlternateSymbols()` from `@/lib/bio/gene-symbols`.

## Checklist for a new backend

1. Pick the Drizzle dialect (`postgresql` / `sqlite` / `mysql` / `singlestore`).
2. Update `src/drizzle/schema.ts` — change the import (`pg-core` → `sqlite-core`
   etc.) and the table constructor. Column types (`text`, `integer`) are
   mostly the same across dialects.
3. Update `src/drizzle/db.ts` — swap driver imports and client construction.
   Keep the exported `db` symbol stable.
4. Update `drizzle.config.ts` — change `dialect` and `dbCredentials`.
5. Update `package.json` dependencies and connection env vars.
6. Run `pnpm db:push` (drizzle-kit creates tables) then `pnpm db:upload`
   (loads JSONL via Drizzle).
7. `pnpm type-check && pnpm build` — if this passes, app code didn't need
   to change.

If app code DOES need to change during a migration, that's a smell — either
a new dialect-specific operator has crept in, or the abstraction needs
tightening. Note it here and fix it.

## Local development with PGlite

For offline development without a Neon connection, the app uses
[PGlite](https://pglite.dev/) — embedded PostgreSQL compiled to WASM. Since
PGlite **is** Postgres, the schema, queries (including tsvector full-text search
and GIN indexes), and seed scripts all work unchanged.

To use PGlite, either leave `DATABASE_URL` empty or set it to a file path:

```bash
DATABASE_URL=                       # defaults to ./data/local.db
DATABASE_URL=file:./data/local.db   # explicit path
DATABASE_URL=memory://              # in-memory (lost on restart)
```

Then seed the local database:

```bash
pnpm db:push      # create tables
pnpm db:upload    # load JSONL seed data
```

The local database file (`data/local.db/`) is gitignored. To reset, delete it
and re-seed.

## What's intentionally NOT abstracted

- **No repository pattern / interfaces.** DB access is already concentrated
  in `src/features/*/api/` (~5 functions total). Adding interfaces would be
  more indirection than the churn saves.
- **No dialect-branching helpers.** We standardize on the dialect-neutral
  subset of SQL instead of writing `caseInsensitiveMatch(col, pattern)`
  adapters. Simpler to audit.
