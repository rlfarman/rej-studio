# AGENTS.md

## Project Overview

REJ Studio is a bioinformatics web app for RNA End-Joining sequence design. Users search genes, view isoforms, and submit coding sequences (DNA or protein) for optimization via a Python/FastAPI backend that uses the dnachisel library. Protein sequences are reverse-translated to DNA on the frontend using species-preferred codons before optimization.

## Architecture

- **Next.js 16 (App Router)** — Frontend and server actions. All user-facing routes live under the `(app)` group, which contains `(search)` for gene browsing, `(design-tool)` for the optimization form, and `(internal)` for non-indexed pages (e.g. `/architecture`). Frontend source lives under `src/`.
- **Bulletproof-react structure** — Code is organized into `src/features/<feature>/` (self-contained: `api/`, `components/`, `hooks/`, `stores/`, `types/`, `utils/`) plus shared layers (`src/components/`, `src/lib/`, `src/hooks/`, `src/stores/`). Cross-feature imports and shared→feature imports are forbidden by ESLint (`import/no-restricted-paths`).
- **FastAPI (Python)** — Runs the DNA optimization algorithm. Canonical code lives in `python/`. Single endpoint: `POST /api/py/process`. In development, Next.js proxies `/api/py/*` to a local uvicorn at `localhost:8000`. In production Python does NOT run on Vercel — it's deployed to Modal and called directly from server actions. `COMPUTE_BACKEND=modal` is required in prod on every host; the local backend is dev-only.
- **Postgres + Drizzle ORM** — Read-only gene/isoform/sequence data. Production uses Neon over HTTP via `@neondatabase/serverless`. Local dev and CI fall back to PGlite (embedded Postgres) when `DATABASE_URL` is empty, a `file:` path, or `memory://` — full Postgres compatibility including `tsvector` and GIN indexes. Driver selection is in `src/drizzle/client.ts`; app code imports it through `src/drizzle/db.ts`, which adds `import 'server-only'` (CLI scripts import `client.ts` directly). Schema is in `src/drizzle/schema.ts`. On first PGlite boot, `initPglite()` loads the `pg_trgm` extension, applies the committed migrations in `src/drizzle/migrations/`, and loads the committed sample seed (`data/sample-genes.jsonl` + `data/sample-isoforms.jsonl`, 24 genes / 228 isoforms with real CDS) so gene search and the design-tool optimizer work end-to-end with zero setup. Run `pnpm db:fetch` to swap the sample seed for the full prebuilt corpus tarball pinned in `package.json` (downloaded from a GitHub Release, SHA-256 verified).
- **shadcn/ui on Base UI** — Component library: shadcn's `base-rhea` style, built on Base UI (`@base-ui/react`), with lucide icons. UI primitives live in `src/components/ui/`. Config in `components.json`.
- **Zustand** — Global client state (favorites, recent genes, species filter) lives in `src/stores/` (shared) or `src/features/<feature>/stores/` (feature-owned).
- **Auth** — Shared-password session gate enforced in the proxy (`src/proxy.ts`). Engages when `BASIC_AUTH_PASSWORD` is set (with `SESSION_SECRET`); skip locally with `BYPASS_AUTH=true` (dev only). Without a session, page loads redirect to `/login?return_to=…` and API calls and server actions get 401; the paths that stay public are `PUBLIC_PATHS` plus the matcher exclusions. Client-invoked server actions also call `requireSession()` (`src/lib/auth/require-session.ts`), since actions are public endpoints. The proxy is the only page gate; the app shell renders static sidebar/header Suspense boundaries. Sessions are bound to the password, so changing `BASIC_AUTH_PASSWORD` signs everyone out. `/api/health` is public but runs DB/Modal checks only with `HEALTH_AUTH_TOKEN`.
- **MCP (agent access)** — `/api/mcp` serves four tools (`search_genes`, `get_gene`, `submit_design`, `get_design`) to a visitor's own AI assistant, defined in `src/app/api/mcp/server.ts`. They do only what the browser can: `submit_design` runs the form's own Zod schema (`design-tool/types/form-schema.ts`) and `buildJobParams`, so validation and the options mapping have one definition. Access is by named bearer token (`MCP_TOKENS`, parsed in `app/api/mcp/tokens.ts`); with none configured the route 404s, and it is in `PUBLIC_PATHS` because it carries its own auth. No CORS headers, deliberately. Tool descriptions and the server instructions are prompts read by other models: say what a tool returns and when to use it, keep "not on record" honest rather than implied, and let the annotations tell the truth — `submit_design` is not idempotent, because the backend reuses a job only while it is still running. Every tool spends a per-token budget (10 designs and 60 reads a minute), since an agent polls in a loop where a person would pause; a refusal says how long to wait and that nothing was lost, so a throttled poll is never read as a missing job.
- **MCP Apps (views in a chat host)** — `get_design` carries `_meta.ui.resourceUri`, and `app/api/mcp/ui/design-view.ts` is the HTML shown for a finished design. It is one self-contained document that loads exactly one script, `/mcp/app-bridge.js`, which `scripts/copy-mcp-app-bridge.mjs` copies out of `@modelcontextprotocol/ext-apps` on install and before each build (gitignored). That asset is served with `Access-Control-Allow-Origin: *` from `next.config.ts` and is in `PUBLIC_PATHS`: the view runs on the host's origin and has no session, and a module script is fetched with CORS, so without both it cannot load. The view renders only what the tool result contains — including the results with no design in them, so a running or failed job says so instead of sitting at "Waiting for the result…"; the tool always returns structured content too, which is what hosts without the extension show. Both the view and the `_meta.ui.resourceUri` that points at it appear only when `NEXT_PUBLIC_SITE_URL` is set, because the view's CSP must name an origin: advertising a `ui://` resource the server does not serve makes a host ask for it and fail, where it would otherwise have shown the structured result. `design-view.ts` has no build step of its own, so `design-view.test.ts` mounts the document and runs its script with the client library stubbed — otherwise nothing in CI would notice the view showing the wrong thing.
- **Job actions vs. the work** — `design-tool/api/job-backend.ts` runs a job: backend routing, the circuit breaker, idempotency, and submit/status/cancel. It authorizes nothing and reads no request, so both callers share it — `design-tool/api/jobs.ts` is the `'use server'` wrapper that checks the session and rate-limits per request, and `app/api/mcp/server.ts` calls the same functions and rate-limits per token. Put new work in `job-backend.ts`, and authorization in the caller.
- **Run records** — every design result carries a `run_record`: the options as applied, a digest and length of the input sequence, the seed the run used, the algorithm/dnachisel/Python versions, the gene dataset the deployment was serving and the timing. Built in `python/run_record.py`, mirrored as a zod schema in `src/features/design-tool/types/backend-contract.ts`, and kept in step by `python/tests/test_contract.py`. DNAChisel's mutation sampling draws on the global RNGs, so the algorithm seeds them per run (`resolve_seed`/`apply_seed` in `python/algorithm.py`) and the record carries that seed: the same sequence and options submitted with it reproduce the design. `corpus_version` says what the deployment was serving, never where a sequence came from — nothing downstream can tell a pasted sequence from an isoform's own CDS, so neither the record nor the copy may imply it. The reproducibility tests in `python/tests/test_run_record.py` run the optimizer on a sequence whose design actually depends on the seed; a shorter one optimizes identically whatever the RNG does and would pass with the seeding deleted. `src/features/design-tool/utils/methods-paragraph.ts` turns the record into prose by a plain template; it may state only what the record contains.
- **Every chart has a table** — `src/components/chart-data-table.tsx` renders the numbers a chart was drawn from, behind a "View as table" toggle, with an optional CSV. A new chart gets one, built from the same rows the chart draws so the two cannot disagree. The toggle is remembered per `storageKey` for the session through `useSyncExternalStore`, so charts of a kind open together and the server never renders a state the client disagrees with; blocked storage falls back to memory, because a reader who asks for the numbers must get them.
- **"What changed"** — `design-tool/components/objective-replay.tsx` steps through the objectives one at a time, pairing `objectives_report_before` with `objectives_report_after` (`utils/objective-steps.ts`). It is a view over data the result already carries: there is no record of the order the optimizer worked in, so it must not present itself as a replay of the run, and it must not invent states between the two reports. A run with only one of the two reports says so rather than reading as "nothing changed" — the backend swallows a failure in the final evaluation, so that case is real.
- **Observability** — Sentry (`instrumentation-client.ts`, `src/sentry.*.config.ts`, loaded from `src/instrumentation.ts`) handles errors and traces; it registers its own OpenTelemetry provider, so there's no separate OTel SDK on the Next.js side. Google Tag Manager (`NEXT_PUBLIC_GTM_ID`) ships Web Vitals to the dataLayer. Upstash Redis powers distributed rate limiting (`src/lib/rate-limit.ts`), falling back to in-memory when unconfigured.

## Key Directories

| Path                     | Purpose                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `src/app/`               | Next.js pages, layouts, and route-specific `_components/` (App Router). User-facing routes nest under `(app)/`.    |
| `src/features/`          | Self-contained feature modules (`gene-search`, `design-tool`, `disease-associations`, `auth`); server actions here |
| `src/components/ui/`     | shadcn/ui primitives                                                                                               |
| `src/components/bio/`    | Bio-domain widgets (species select, diagnostic badges, DNA icon)                                                   |
| `src/components/`        | Generic shared widgets (top-level)                                                                                 |
| `src/lib/bio/`           | Bio-domain utilities (species types, FASTA, sequence utils, reverse translation, design suitability)               |
| `src/lib/analytics/`     | GTM / Web Vitals helpers                                                                                           |
| `src/lib/`               | Generic shared utilities (`cn`, file download, rate-limit, env, logger, retry) at the top level                    |
| `src/hooks/`             | Generic shared React hooks                                                                                         |
| `src/stores/`            | Shared Zustand stores (e.g. species filter)                                                                        |
| `src/copy/`              | Shared user-facing copy (`errors.ts`, `common.ts`, `app.ts`). Feature copy lives in `src/features/<f>/copy.ts`     |
| `src/drizzle/`           | DB schema, client, migrations (`schema.ts`, `db.ts`, `migrations/`)                                                |
| `src/proxy.ts`           | Next.js middleware — session gate, CSRF and body-size checks, CSP                                                  |
| `src/instrumentation.ts` | Env validation at boot + Sentry server/edge init                                                                   |
| `python/`                | FastAPI Python backend (`index.py`, `algorithm.py`); dependencies in the root `pyproject.toml` + `uv.lock`         |
| `rust/`                  | Rust port of the optimizer, built to WebAssembly so designs can run in the browser (see `rust/README.md`)          |
| `docs/`                  | Longer-form plans and decisions (e.g. `cloudflare-migration.md`)                                                   |
| `modal/`                 | Modal deployment for the Python backend (production compute)                                                       |
| `scripts/`               | Dev tooling — worktree bootstrap, DB build/load, bundle-size checks, schema verify, type generation                |
| `.github/workflows/`     | CI (tests, build + bundle budgets, Storybook, zizmor), security, DB/Python CI, Lighthouse, deploys                 |

## Development Commands

```bash
pnpm dev          # Start Next.js + FastAPI concurrently
pnpm build        # Production build (Vercel target)
pnpm lint         # Oxlint, then ESLint (feature-boundary rules)
pnpm lint:fix     # Auto-fix lint
pnpm format       # Prettier
pnpm type-check   # TypeScript 7 (native compiler) type check
pnpm test         # Run vitest (one-shot)
pnpm test:watch   # Run vitest in watch mode
pnpm test:coverage # Run vitest with coverage
pnpm test:e2e     # Playwright smoke tests (starts a gated `next dev` on :3000)
pnpm verify       # lint + type-check + test (pre-push gate)
uv sync           # Python env (.venv) for the FastAPI backend, from uv.lock
pnpm storybook    # Storybook dev server on :6006
pnpm next analyze # Explore the client/server bundles (Turbopack bundle analyzer)
pnpm build-storybook --test # What CI's Storybook job runs
pnpm db:build     # Emit neutral JSONL seed from source CSV (data/*.jsonl)
pnpm db:migrate   # Apply the committed migrations (src/drizzle/migrations) to $DATABASE_URL
pnpm db:generate  # Write a migration for schema.ts changes (commit it with the schema)
pnpm db:upload    # Load JSONL into $DATABASE_URL via Drizzle (dialect-neutral)
pnpm db:studio    # Browse DB in Drizzle Studio (local.drizzle.studio)
pnpm wasm:build   # Build the Rust optimizer and install it in public/ (needs Rust)
pnpm wasm:verify  # Check the committed .wasm matches its digest manifest
pnpm wasm:smoke   # Run the committed .wasm through Node against the parity fixtures
```

## Toolchain

- **Node.js 26 LTS** — pinned by `.nvmrc` and `engines` in `package.json` (Vercel follows `engines`). CI uses the same.
- **pnpm 12** — pinned by `packageManager`. pnpm 11+ ignores the `"pnpm"` field in `package.json`; its settings live in `pnpm-workspace.yaml`: the `catalog` (versions shared with the overrides), the security `overrides`, and `allowBuilds` (dependency install scripts are blocked unless listed). pnpm 12 also refuses packages published less than a day ago by default, so a just-released version may not install until the next day.
- **TypeScript** — two versions on purpose. `typescript` (6.x) is the library that Next, typescript-eslint, knip and Storybook load; `typescript-native` is TypeScript 7 (the Go compiler), used only by `pnpm type-check` because it's ~6× faster. TypeScript 7.0 has no stable programmatic API yet; once 7.1 ships one and the tools support it, drop the alias.
- **Lint** — Oxlint (`.oxlintrc.json`) runs first and owns the React Hooks / React Compiler, Next.js and jsx-a11y rules, plus type-aware rules (`no-floating-promises`, `no-base-to-string`, `no-misused-spread`, …) through `oxlint-tsgolint` on the TypeScript 7 compiler (`options.typeAware`). ESLint (`eslint.config.mjs`) runs after it only for what Oxlint lacks: the `import/no-restricted-paths` feature boundaries and the `no-restricted-syntax` guard against react-hook-form's `watch()`. `eslint-plugin-oxlint` turns off the ESLint rules Oxlint covers. Keep `eslint-disable` comments using the original rule names (`react-hooks/...`, `@next/next/...`); Oxlint honors them and reports stale ones. Spread on sequence strings is flagged by `no-misused-spread`: use `split('')`, which also counts the same UTF-16 units as `indexOf`.
- **React Compiler** — enabled (`reactCompiler: true` in `next.config.ts`), so components get automatic memoization; prefer plain code over hand-written `useMemo`/`useCallback`.
- **Python** — managed with [uv](https://docs.astral.sh/uv/): `uv sync` creates `.venv` from `uv.lock` using the interpreter in `.python-version`; run tools with `uv run` (e.g. `uv run pytest`). Slated for removal once the browser optimizer serves production; see `docs/stack-review-2026-11.md`.
- **Rust** — pinned by `rust/rust-toolchain.toml` (version, clippy, rustfmt, the `wasm32-unknown-unknown` target); `(cd rust && rustup toolchain install)` installs exactly that, and CI does the same. Only needed for `pnpm wasm:build`: the `.wasm` is committed. Lint levels live in `[workspace.lints]` in `rust/Cargo.toml`; CI adds `-D warnings` and also clippy-checks the wasm32 build, because the unsafe ABI in `rust/optimizer/src/lib.rs` is `cfg(target_arch = "wasm32")` and a native run never compiles it. Every `unsafe` block needs a `// SAFETY:` comment. Dependencies are policed by `rust/deny.toml` (`cargo deny check`, in the Security workflow).

## User-Facing Copy

User-facing strings (headings, descriptions, toasts, validation messages, error pages, button labels, aria-labels with real text) are centralized in typed objects rather than inlined in JSX:

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
- Corner radius follows the Rhea primitives by role. Use `Card` for cards (its radius is `rounded-[min(var(--radius-4xl),24px)]`). Bordered or filled panels inside a card are `rounded-2xl`, and boxes nested in a panel are `rounded-xl`. Controls (inputs, buttons, segmented-control tracks) are `rounded-2xl`; segments and hoverable rows are `rounded-xl`, dense table/chart rows `rounded-lg`. Chips, badges, icon-only buttons, progress bars and dots are `rounded-full`. Use `Skeleton` for loading bars. Inline text highlights and focus rings around plain text stay `rounded-sm`, and chart marks keep whatever they're drawn with.
- **Design history lives in IndexedDB**, not localStorage: `src/features/design-tool/hooks/use-job-history.ts` persists through `idb-keyval` (`utils/job-history-storage.ts`, database `rej-studio-job-history`). It loads asynchronously, so gate UI on `useJobHistoryHydrated()` (or `await whenJobHistoryHydrated()` outside React) before treating history as empty; in tests, await it before writing to the store (`fake-indexeddb` is loaded in `src/test/setup.ts`). The store holds writes until the first load, migrates the old `rej-studio:job-history` localStorage key once, and falls back to localStorage, then memory. Small preferences (favorites, recents, species filter, sidebar state, form drafts) stay in localStorage on purpose.
- **In-browser runs** hold a Web Lock (`rej-studio:browser-run:<id>`) and a `beforeunload` guard until they settle (`utils/browser-run-guard.ts`). `BrowserRuns` in the app shell marks running browser entries whose lock is free as interrupted and offers a re-run. Finish notifications (`utils/finish-notification.ts`) fire only while the page is hidden, and permission is requested only from the opt-in button.
- Oxlint + ESLint for linting (`.oxlintrc.json`, `eslint.config.mjs`) and Prettier for formatting (`prettier.config.mjs`).
- ESLint enforces feature boundaries: features cannot import from each other, and shared layers (`src/components`, `src/lib`, `src/hooks`, `src/stores`) cannot import from features or app. Features auto-discovered from `src/features/` at config load.

## Database

Primary store is a Neon (Postgres) database. The Next.js server connects via the Neon HTTP driver (`src/drizzle/db.ts`); every query is a serverless HTTP round-trip. Schema is in `src/drizzle/schema.ts`; tables: `genes`, `isoforms`.

App code uses dialect-neutral SQL (Drizzle query builder + `LOWER(col) LIKE '%x%'`) so the DB backend can be swapped without touching queries.

**Local dev (PGlite):** No setup needed. On first `getDb()` call, `initPglite()` checks for the `genes` table and, if missing, applies `src/drizzle/migrations/0000_initial.sql` and loads the committed sample seed at `data/sample-genes.jsonl` + `data/sample-isoforms.jsonl`. Delete `data/local.db/` to re-bootstrap. The sample covers 24 well-known genes (TP53, BRCA1/2, EGFR, KRAS, MYC, INS, etc.) with real CDS + protein sequences for all 228 isoforms — gene search and the design-tool optimizer both work end-to-end with no further setup.

**Full corpus locally (`pnpm db:fetch`):** Downloads the prebuilt PGlite tarball pinned in `package.json`'s `corpus` field from a GitHub Release via `gh release download` (auth flows through your existing `gh auth login`), verifies SHA-256, and extracts to `data/local.db/`. One command, no Python, no CSV. `initPglite()` reads the version from `data/local.db/.corpus-version` and logs `[pglite] Full corpus (vN, …)` on boot. Run `pnpm db:reset` to wipe `data/local.db/` and fall back to the sample seed.

**Maintainer-only — publishing a new corpus version:**

1. Build a fresh `data/local.db/` from Neon (e.g. via `pnpm db:build && pnpm db:migrate && pnpm db:upload` against `drizzle/transcript_metadata.csv`, or by snapshotting Neon directly).
2. `tar czf rej-corpus-vN.tar.gz -C data local.db && shasum -a 256 rej-corpus-vN.tar.gz`
3. `gh release create corpus-vN --title "Corpus vN" --notes "…"` (creates the release with no asset).
4. `gh release upload corpus-vN rej-corpus-vN.tar.gz` (upload separately — uploading at create time has hit `HTTP 400` for ~250 MB assets).
5. Bump `package.json`'s `corpus.{version,tag,asset,sha256}` and open a PR. Contributors pick up the new version on next `pnpm db:fetch`.

For seeding a Neon database (production), the same `db:build`/`db:migrate`/`db:upload` pipeline works against `$DATABASE_URL`. New or updated databases always get their schema from `pnpm db:migrate`; `pnpm db:push` syncs `schema.ts` directly and skips the migration files, so keep it for throwaway prototyping.

**Gene data as a static corpus (replacing the database).** Gene and isoform data can be served as a static, versioned set of files (`src/features/gene-search/corpus/format.ts`): `index.json` (searchable fields, columnar), `genes/<id>.json`, `transcripts/<n>.json` and `symbols/<key>.json`. Build it from the JSONL seed with `pnpm corpus:build`. By default it builds the committed sample into `public/gene-data/sample`; for the full corpus, pass `--genes … --isoforms … --version vN --out <dir>`. Versions are immutable: publish a new one rather than rebuilding. `NEXT_PUBLIC_GENE_DATA_URL` points at one version, as an absolute URL or a `/path` under `public/`.

- **When it's unset,** dev and tests use the sample, and production keeps reading Postgres until the corpus is hosted (R2).
- **When it's set,** the palette and `/genes` search in the browser, and server pages read through `gene-queries.ts` / `isoform-queries.ts`. `corpus/search-index.ts` ports the Postgres ranking exactly; `corpus/text-search.ts` implements Postgres's `'simple'` parser and `ts_rank`.
- **After changing the seed or the format,** rerun `pnpm corpus:build --force` and commit `public/gene-data/sample`. `corpus/build.test.ts` checks it byte for byte.

## Environment Variables

`.env.example` is the source of truth — consult it when adding new config. Variables group by purpose:

- **Core** — `DATABASE_URL` (omit for PGlite dev), `COMPUTE_BACKEND`, `MODAL_API_URL`, `MODAL_API_TOKEN` (bearer token for the Modal API; must equal `JOB_API_TOKEN` in the Modal secret), `LOCAL_API_URL`.
- **Auth** — `BASIC_AUTH_PASSWORD`, `SESSION_SECRET` (32+ chars, required with the password), `BYPASS_AUTH` (dev only).
- **Public / client** — `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GTM_ID`.
- **Observability** — `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_*`.
- **Optional features** — `HEALTH_AUTH_TOKEN`, `MAINTENANCE_MESSAGE`, `UPSTASH_REDIS_REST_*`, `NEXT_PUBLIC_ENABLE_MULTI_SPLIT`, `NEXT_PUBLIC_ENABLE_BROWSER_OPTIMIZER` (run the optimizer in a Web Worker instead of calling the compute backend).
- **Build-time** — `GIT_COMMIT_SHA`.

Local dev needs nothing to boot (PGlite + in-memory rate limit fill in). Production requires at minimum a Neon `DATABASE_URL` and `COMPUTE_BACKEND=modal` with `MODAL_API_URL` and `MODAL_API_TOKEN`, plus `BASIC_AUTH_PASSWORD` and `SESSION_SECRET` to keep the gate on.

## Commits & Branches

This repo enforces [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) and [Conventional Branch](https://conventional-branch.github.io/) naming via husky hooks and CI. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the allowed types, examples, and bypass instructions.

## Testing

[Vitest](https://vitest.dev) is configured (`vitest.config.ts`). Tests are co-located with the code they cover (`*.test.ts` / `*.test.tsx`) across features, lib, stores, and components. Run `pnpm test` (one-shot), `pnpm test:watch`, or `pnpm test:coverage`. The `pnpm verify` script chains lint + type-check + test and is the standard pre-push gate.

Drizzle has an integration test at `src/drizzle/queries.integration.test.ts` that runs against PGlite — it needs no real DB.

Server modules `import 'server-only'`. Vitest aliases it to Next's empty module (`vitest.config.ts`), and tsx scripts that reach them run with `--conditions=react-server` (see the `db:*` scripts); without either, the package throws on import.

Storybook stories live next to their components (`*.stories.tsx`); CI builds them with `pnpm build-storybook --test`.

[Playwright](https://playwright.dev) smoke tests live in `e2e/` (`pnpm test:e2e`). They start `next dev` with the password gate on and the in-memory sample data, sign in once (`e2e/auth.setup.ts`), and check the gate plus the main signed-in pages. Assert on roles and data rather than copy. The server uses port 3000, so stop a local `pnpm dev` first; first-time setup needs `pnpm exec playwright install chromium`.

## Working in Git Worktrees

Claude agents often run in git worktrees at `.claude/worktrees/<name>/`. A fresh worktree contains only tracked files — it has no `node_modules/`, no `.venv/`, and no `.env` (all gitignored), so the app cannot start until it's bootstrapped.

**Before running or building the app in a worktree, run:**

```bash
./scripts/bootstrap-worktree.sh
```

This symlinks `.env` from the main repo, creates the Python environment with `uv sync`, and runs `pnpm install` in the worktree.

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
      "Trusted internal services: Neon Postgres at *.neon.tech, Modal at *.modal.run, Vercel deployments at *.vercel.app"
    ]
  }
}
```

## Common Tasks

- **Adding a new UI primitive**: Use `pnpm exec shadcn add <component>` (the pinned CLI, which reads the `base-rhea` style from `components.json`). Components go in `src/components/ui/`.
- **Adding a server action**: Place it in the owning feature's `api/` folder (e.g. `src/features/gene-search/api/`). Import `db` from `@/drizzle/db`.
- **Adding a new feature**: Create `src/features/<name>/` with the standard subfolders. ESLint boundary rules apply automatically (no config changes needed).
- **Adding shared code**: If used by ≥2 features, decide by domain: bio-specific → `src/lib/bio/` or `src/components/bio/`; generic → `src/lib/` or `src/components/`.
- **Modifying the optimization algorithm**: Edit `python/algorithm.py`. The FastAPI endpoint is in `python/index.py`. In production this runs on Modal (see `modal/app.py`); `.github/workflows/modal-deploy.yml` redeploys it when the change merges to `main`. **There is a second implementation** — the Rust port in `rust/` that runs in the browser — so an algorithm change must be made in both, or the two will disagree. Regenerate the parity fixtures (`scripts/gen-parity-fixtures.py`) and run `cd rust && cargo test`; the tests compare the two directly. See `rust/README.md`.
- **Database schema changes**: Edit `src/drizzle/schema.ts`, run `pnpm db:generate` and commit the new SQL in `src/drizzle/migrations/` (DB CI fails if `schema.ts` and the migrations disagree), then `pnpm db:migrate` against each database. Update `scripts/build-db.py` too if the JSONL shape changes, then `pnpm db:build && pnpm db:upload`.
- **Switching DB backend**: Edit `src/drizzle/client.ts` and the connection driver — it's a 5-file change.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
