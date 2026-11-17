# Moving REJ Studio to Cloudflare

A plan to retire the server that humans depend on. Written November 2026,
after porting the optimizer to Rust and running it in the browser.

**One server stays**, and deliberately: the MCP endpoint that lets a
scientist's own agent search genes and run designs. See
[Agent access](#agent-access-mcp). Everything else goes.

**Nothing here has been started.** Step 0 is done and merged behind a flag;
steps 1 to 4 are proposals. Each one ships on its own and makes the next
smaller, so the plan can be stopped at any point and still leave the app in a
better state than it started.

## Why

Almost everything in `src/` that is not the user interface exists to support
one thing: the optimizer runs on a server. Postgres, Drizzle and the
migrations exist to hold gene data that never changes. Modal, the job API,
polling, the circuit breaker, bearer tokens and submission rate limits exist
because designing a sequence happens somewhere else. The password gate,
sessions and most of the proxy exist because that somewhere else is on the
public internet.

The Rust port removes the reason. A design now runs in the user's tab in less
time than the server took, so the scaffolding around the server has nothing
left to hold up.

Three secondary benefits matter for a lab:

- **Unpublished sequences stop leaving the building.** Today every design is
  POSTed to Modal. Afterwards it never leaves the machine it was typed on.
- **Nothing is left to abuse.** No endpoint means no rate limit to tune and no
  compute budget to burn through.
- **Cost falls to roughly $5 a month**, from seven vendors to three.

## Where this ends up

| Today                                                | After                                            | What goes away                                                      |
| ---------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| Vercel                                               | Cloudflare Workers with static assets            | —                                                                   |
| Modal + FastAPI                                      | the Rust optimizer in the tab                    | job API, polling, circuit breaker, bearer tokens, submit rate limit |
| Neon + Drizzle                                       | static gene files on R2, searched in the browser | database, migrations, search API, PGlite                            |
| Shared password                                      | Cloudflare Access                                | gate, sessions, `requireSession`, most of `proxy.ts`                |
| Google Tag Manager + GA4                             | Cloudflare Web Analytics                         | GTM script, its CSP allowances, cookie consent                      |
| Upstash Redis                                        | nothing left to rate-limit                       | —                                                                   |
| Vercel, Neon, Modal, Upstash, Sentry, Google, GitHub | Cloudflare, Sentry, GitHub                       | four vendors                                                        |

Roughly 3,300 lines of application code are deleted rather than rewritten,
along with `@neondatabase/serverless`, `drizzle-orm`, `@upstash/ratelimit`,
`@upstash/redis` and `@next/third-parties`.

## Step 0 — run designs in the browser (done, behind a flag)

Merged. `NEXT_PUBLIC_ENABLE_BROWSER_OPTIMIZER=true` runs the design in a Web
Worker; without it every request still goes to Modal. See
[`rust/README.md`](../rust/README.md).

Measured on three real coding sequences, same options and seed. All four
runtimes produce the **same design, base for base**:

| Sequence         | CPython (server) | Pyodide | Rust   | Rust → WebAssembly |
| ---------------- | ---------------- | ------- | ------ | ------------------ |
| 1,182 bp         | 0.95 s           | 1.96 s  | 0.13 s | 0.17 s             |
| 3,633 bp         | 7.95 s           | 16.28 s | 1.22 s | 1.35 s             |
| 5,592 bp (BRCA1) | 21.14 s          | 42.50 s | 3.81 s | 3.91 s             |

In Chrome through the real UI, the 5,592 bp gene designs in **1.9 s** with no
network calls beyond fetching the 146 KB module once.

## Step 1 — make the browser the default

**Do this first.** It is the only step that changes what users experience, and
every later step depends on the server path being gone.

1. Run both paths side by side for a week or two of real designs. They
   produce identical sequences for the same seed, so **any disagreement is a
   bug, not drift** — that is the whole point of the parity tests.
2. Flip the default. Keep the flag so the backend can be switched back on.
3. Once the lab has used it for a few weeks without reaching for the fallback,
   delete `modal/`, `python/`, `src/app/api/jobs/`, the polling in
   `JobWatcher`, the circuit breaker, the idempotency cache, the submit rate
   limit, and the Modal halves of `job-backend.ts` and `jobs.ts`.

**Decide first:** is there a gene large enough that the browser is too slow?
Running time grows roughly with the square of sequence length, so a 15 kb gene
lands near 30 s. If the lab routinely designs something much larger, keep a
fallback (see "The big-gene fallback" below) rather than making people wait.

**Also worth doing here:** design history currently lives in `localStorage`,
which tops out around 5 MB. A browser design stores full sequences, so history
will hit that ceiling sooner than it used to. Move it to IndexedDB.

## Step 2 — gene data as static files on R2

The corpus is 39,991 genes and 143,858 isoforms, about 330 MB, read-only, and
changes only when a new snapshot is published (the current one is from April
2026). It is a set of files that is being kept in a database.

- Extend the existing corpus build to emit one JSON file per gene plus a
  search index of roughly 1 MB, and publish them to R2 instead of the GitHub
  Release tarball.
- Gene search runs in the browser against the index. Gene pages fetch one
  file.
- R2 charges **nothing for egress**, which is what makes this viable: 330 MB
  costs about half a cent a month to store, and serving it is free.

Deletes Neon, `src/drizzle/`, the migrations, `/api/genes/search`, the PGlite
development path and the `db:*` scripts.

**Decide first:** how fast must search feel, and does it need to match on
anything beyond symbol, name and alias? A 1 MB index handles prefix and
substring matching instantly. Full-text ranking over descriptions would need
more thought.

## Step 3 — Cloudflare Access instead of the shared password

Cloudflare Access sits in front of the site and asks each person to sign in
with their own identity (Google, GitHub, or an email code). Free up to 50
users; $7 per user per month beyond that.

This is better than what is there now on every axis that matters: one person
can be removed without changing anyone else's password, you can see who used
the tool, and there is no shared secret to leak. It also deletes
`src/lib/auth/`, `src/features/auth/`, `/api/login`, `/api/logout`, the
session cookie handling, the `requireSession()` call in every server action,
and most of `src/proxy.ts`.

**Decide first:** who administers the Cloudflare account, and does everyone in
the lab have an identity provider the whole group can use?

## Step 4 — TanStack Start on Vite+, hosted on Cloudflare

Decided November 2026: **TanStack Start in SPA mode, on the Vite+ toolchain,
deployed with the Cloudflare Vite plugin.** One Worker serves everything:

- **The app:** a prerendered shell and pages as static assets, which are free
  and don't invoke the Worker.
- **Server routes:** the MCP endpoint, the cloud-designs API and
  health/version.
- **The cloud-designs Workflow** runs on the same Worker.

Cloudflare supports Start officially (framework guide, prerendering,
auxiliary Workers), so this skips OpenNext entirely.

A test run in November 2026 confirmed why Next shouldn't be lifted over
instead. Next 16.4 on OpenNext 1.20 worked for sign-in and in-browser
designs, but resuming `cacheComponents`/PPR pages on workerd renders a
different tree from the build. React falls back to client rendering and logs
an error on every page view. That spike is parked on the local branch
`feat/cloudflare-hosting`.

### What there is to move

Measured on the branch after steps 2 and 3:

- **7 pages, 11 Next route handlers, 1 `'use server'` module.**
- **88 of 125 components are already client components** and carry over
  unchanged.
- **Next APIs in use:** `next/link` (21 files), `next/navigation` (12),
  `next/server` (14), `next/headers` (9), `next/og` (5), `next/cache` (2), and
  one each of `next/image`, `next/font`, `next/script` and `next/web-vitals`.

| Today                                               | After                                                                                                                             |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `app/` routes and layouts                           | `src/routes/` file routes; `head()` replaces `metadata`                                                                           |
| `next/link`, `next/navigation`                      | TanStack Router `Link`, `useNavigate`, `useSearch` (typed search params)                                                          |
| `next/font`                                         | self-hosted fonts via `@fontsource` or CSS                                                                                        |
| `next/image` (1 use)                                | plain `<img>`                                                                                                                     |
| server components reading genes                     | route `loader`s reading the static corpus                                                                                         |
| `jobs.ts` server action, `/api/jobs`, Modal         | deleted: designs run in the browser (step 1) or the Workflow                                                                      |
| `/api/genes/search`, Upstash limiter                | deleted: search runs in the browser (step 2)                                                                                      |
| `/login`, `/logout`, `src/proxy.ts`, sessions, CSRF | deleted: Cloudflare Access gates the hostname                                                                                     |
| `/api/csp-report`, CSP built in the proxy           | static `_headers`, or headers set by the Worker                                                                                   |
| `/api/og`, `icon`, `apple-icon`                     | prerendered at build (the gene set is fixed per corpus) or dropped. The app is gated, so link previews only work for public pages |
| `sitemap`, `robots`, `manifest`                     | prerendered static files                                                                                                          |
| `/api/health`, `/api/version`                       | Start server routes                                                                                                               |
| ESLint + Prettier + Vitest                          | `vp`: Oxlint (feature-boundary rules permitting), Oxfmt, Vitest                                                                   |
| Storybook `nextjs-vite`                             | Storybook `react-vite`                                                                                                            |
| GTM/GA4                                             | Cloudflare Web Analytics                                                                                                          |

### Slices

Each slice is its own PR into a long-lived `feat/tanstack-start` branch.
That branch only replaces the release branch once the last slice and the
Cloudflare cutover are done. Everything here is reversible until DNS moves.

1. **Toolchain and shell.** Vite+, Start in SPA mode and the Cloudflare
   plugin; the root route with theme, query client, sidebar and header; the
   error and not-found boundaries; Storybook on `react-vite`. Also check that
   Oxlint can carry the feature-boundary rules, or keep a minimal ESLint for
   them. (Oxfmt replaced Prettier, including Tailwind class sorting.)
2. **Pages.** Home, genes, gene page, design tool, disease associations and
   architecture, with loaders reading the static corpus and typed search
   params replacing `useSearchParams`.
3. **Deletions.** The job API and Modal path, sessions and the proxy, the
   search API, the database layer (Drizzle, Neon, PGlite, migrations, `db:*`),
   Upstash and GTM. Python leaves here as well (see the stack review).
4. **Server routes.** Health and version; the MCP endpoint ported from #280
   and #281 with inline designs; the cloud-designs API and Workflow (planned
   below).
5. **Cutover**, which needs the owner's Cloudflare account:
   - Workers Paid, with a spending limit.
   - The corpus uploaded to R2.
   - Access on the hostname, with a bypass policy for the MCP path, which
     uses bearer tokens instead.
   - Web Analytics, Sentry for Start, and secrets.
   - A preview deploy on `workers.dev`, then DNS moves from Vercel.

   Vercel stays up until the new deploy has served the lab for a while.

### Before slice 1

- **Land the open PRs.** #279–#286 (with #281 rebased onto #280 first) all
  touch files this rewrite replaces, so they should merge into the release
  branch first. Rewriting on top of eight unmerged branches would mean
  rebasing all of them across a framework change.
- **Step 1:** the browser optimizer on by default in production, so slice 3
  can delete the server design path.

## Agent access (MCP)

REJ Studio exposes itself to AI assistants over MCP: `search_genes`,
`get_gene`, `submit_design` and `get_design`, reachable with a named bearer
token, plus an MCP Apps view so a finished design renders inside the chat
host. The work lives on the `feat/mcp-server` and `feat/mcp-apps` branches.

**This survives the migration, and Cloudflare suits it better than Vercel
does.** But it is the one part of the product that genuinely needs a server,
so "no backend" is the wrong way to describe the end state. The accurate
description is: static for humans, one small Worker for agents.

What the Worker needs, and where each piece comes from afterwards:

| Need             | Today                      | After                                                  |
| ---------------- | -------------------------- | ------------------------------------------------------ |
| An HTTP endpoint | `/api/mcp` route handler   | a Worker                                               |
| Gene lookups     | Neon                       | R2 binding over the static corpus                      |
| Running a design | Modal                      | the same Rust crate, as WebAssembly                    |
| Rate limiting    | Upstash                    | Cloudflare's Rate Limiting binding                     |
| Caller identity  | `MCP_TOKENS` bearer tokens | the same, as a Worker secret, or Access service tokens |
| The design view  | static HTML                | unchanged                                              |

The port is close to mechanical, because the endpoint is already stateless:
it builds a server per request with `createMcpHandler` and calls
`handler.fetch(request)` — a `Request` in, a `Response` out, which is exactly
a Worker's shape. Cloudflare now steers new MCP servers towards stateless
handlers rather than the older session-backed `McpAgent`, so the existing
design is already the one they recommend.

### The job model: decided, inline

`submit_design` returns the finished design rather than a job id to poll.
The Worker needs no job state, so no Durable Object, no Workflow, no storage.

**This is a smaller change than it sounds**, because the contract already
allows it. `submit_design` returns `{ job_id, status: 'completed', result }`
whenever the backend hands back a result — which the local development
backend already does — and tells the agent outright that there is nothing to
poll for. `get_design`'s own description already ends "unless submit_design
already returned the result". Running the optimizer in the Worker simply
makes the inline branch the only one taken.

What still needs doing when the endpoint is ported:

- **Lead with it in the tool descriptions.** `submit_design` still says it
  "returns a job id" and that a design "takes seconds to minutes, so call
  get_design". Both become wrong.
- **Move the MCP Apps view onto `submit_design`.** `_meta.ui.resourceUri` is
  registered only on `get_design` today. If the result arrives from
  `submit_design`, the view has to travel with it or the design never renders
  in the chat host.
- **Decide what becomes of `get_design`.** With no job to collect it has
  nothing to read. Removing it is honest; keeping it to answer "designs are
  returned directly now" is kinder to an agent working from a stale schema.
- **Guard the sequence length.** The limit is not Cloudflare — a Worker gets
  5 minutes of CPU, and even a 30 kb gene fits. It is the MCP client's own
  request timeout. Refuse clearly above some length, with a message pointing
  at the web app, rather than holding a connection open until the client
  gives up.

**Sequencing matters here.** Inline is right only once the optimizer is fast
and local. Today the endpoint calls Modal, where a design really does take
minutes, so making `submit_design` synchronous now would be a regression. It
lands when the endpoint moves to the Worker, after steps 1 and 2.

## Budget: Workers Paid, $5/month

Decided November 2026. The free plan's 10 ms of CPU per request can't run a
design, and agents must be able to do everything inside their own harness,
not be sent to the web app. Workers Paid allows up to 5 minutes of CPU per
request. That restores the inline MCP design (`submit_design` runs the Rust
WebAssembly in the Worker and returns the finished design as a tool result)
and makes closeable cloud designs (below) possible. Everything else stays
within the included allowances: static asset requests are free, the corpus
fits R2's free tier, and Access is free up to 50 users.

## Designs you can close the tab on

In the browser, a design runs in a Web Worker. It keeps running when the tab
is in the background and stops when the tab closes. Nothing in the browser
outlives the last open tab: SharedWorkers die with it, and Service Workers
are cut off after about 30 seconds idle. So "close it and come back" means
running the design on Cloudflare. The client-side half (finish
notifications, a warning before closing mid-run, re-running an interrupted
design, which reproduces it exactly because runs are seeded) is built in the
app regardless.

An earlier draft said a plain Worker request was enough for this. It isn't:
the request is tied to the browser connection. The work has to be detached
from the request, and **Workflows** is the fit. Each step can run for
unlimited wall time and up to 5 minutes of CPU, an instance keeps its output
for 7 days by default (up to 30), so it can hold the finished design itself,
and the client fetches it by id later.

**The real limit is 5 minutes of CPU per invocation.** That applies to
Workers, Workflow steps and Queue consumers alike. Optimizer time grows about
with the square of CDS length (5.6 kb ≈ 4 s in WebAssembly), so one step
covers sequences up to roughly **45 kb**. Beyond that (titin's ~100 kb CDS
would need about 20 minutes), the options are:

- checkpoint the optimizer between Workflow steps (serialize the sequence, the
  RNG state and the position in the objective list), which is real Rust work;
- or run the native binary in a **Container**, which has no CPU cap but means
  a Docker image, cold starts and a Worker to orchestrate it.

Neither is worth building until someone needs a gene that big.

### What it costs

Every option below needs **Workers Paid at $5/month**: the free plan allows
10 ms of CPU per request, which can't run a design. The MCP Worker needs Paid
for the same reason, since its designs run inline, so this is not a new
cost.

| Option                    | Covers                   | Marginal cost at lab scale                                                                                                                                |
| ------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workflows                 | up to ~45 kb per step    | ≈ $0: 30M CPU-ms (≈ 8.3 CPU-hours), 500k steps and 1 GB storage are included monthly; beyond that, $0.02 per million CPU-ms (≈ $0.0006 for a 30 s design) |
| Workflows + checkpointing | any length               | same as above, plus the Rust work                                                                                                                         |
| Containers                | any length, native speed | 375 vCPU-minutes and 25 GiB-hours of memory included; then $0.00002 per vCPU-second (≈ $0.024 for a 20-minute design)                                     |

A worked example: 1,500 cloud designs a month averaging 30 s is 45,000
CPU-seconds. That's 15,000 over the included amount, about **$0.30**, so the
month comes to about $5.30.

The rest of the plan fits the free tiers: the static app (static asset
requests are free and unlimited), the corpus in R2 (10 GB, 10M reads/month
and egress all free), and Access (free up to 50 users). One trap: a deployment
holds at most 20,000 static files on the free plan (100,000 on Paid), so the
~40k per-gene files have to live in R2, not in the app bundle.

The privacy trade-off stays: a design sent to a Workflow leaves the user's
machine. Make it explicit and opt-in ("run in the cloud so I can close this
tab"), or apply it only above a size threshold.

Sources (Cloudflare docs, November 2026): Workers pricing and limits,
Workflows pricing and limits, Containers pricing, R2 pricing.

### Plan: cloud designs (decided, opt-in)

Ships with the Cloudflare step, in the same small Worker as the MCP endpoint,
since both need Workers Paid and the Rust WebAssembly.

**User flow.**

1. Next to "Run designer", a "Run in the cloud" option, off by default. One
   line of copy says what it means: the sequence leaves this machine, is
   kept for up to 30 days, and can be deleted.
2. The design is submitted, the tab can close, and history shows "Running in
   the cloud".
3. Back later, on any signed-in device, the finished design appears in
   history.

**Request path.**

- `POST /api/designs` is behind Access, like the rest of the app. The Worker
  validates the request against the same contract the browser uses
  (`contract.rs` / zod), rejects sequences over the size cap, and creates a
  Workflow instance.
- **The instance id is a hash of the canonical request plus the optimizer's
  `.wasm` digest.** Designs are deterministic given that pair, so a
  resubmitted request finds its existing instance rather than paying twice.
  `create()` throws on an id that is still within retention, which is the
  dedupe signal. Including the digest means a new optimizer build never
  serves a stale design.
- The Access JWT's email is recorded in the instance params, so history can
  show who ran what and deletion can be limited to the owner.

**The Workflow.**

- One step, `design`, runs the Rust WebAssembly with `cpu_ms = 300000`
  (5 minutes) and returns the result. A step return value is capped at
  1 MiB. A 45 kb design is a few hundred KB, but if a result ever exceeds
  ~900 KB, write it to R2 and return the key.
- Retention: `successRetention: "30 days"` and `errorRetention: "7 days"`,
  the Paid plan's maximums.
- If the step exceeds the CPU limit, the instance errors. Report it as "too
  large for the cloud — run it in the browser". No retries for that case;
  retry only transient failures.

**Status, results, deletion.**

- `GET /api/designs/:id` returns `instance.status()`: queued, running,
  complete with the result, or errored.
- Workflows can't stream progress from inside a step, so the UI shows an
  estimate from sequence length, not a live bar.
- The history entry (IndexedDB) stores the cloud id. On load, and when the
  tab regains focus, running entries are polled with backoff. Once fetched,
  the result is stored locally, so the 30-day retention only matters for
  devices that never opened it.
- `DELETE /api/designs/:id` calls `instance.delete()`, which removes the
  stored state; history has a "delete from cloud" action. `?job=<id>` links
  work again for anyone signed in to the lab.

**Guards.**

- Size cap at about 45 kb, estimated from the measured scaling and enforced
  on both client and server.
- Cloudflare's Rate Limiting binding per signed-in user, for example 20 cloud
  designs an hour.
- A Workers spending limit on the account as a backstop. At the measured
  scale, 1,500 designs a month costs about $0.30 over the $5 base.

**MCP.** `submit_design` stays inline: an agent wants the tool result in the
same turn. Optionally, `submit_design` could hand very large sequences to
the same Workflow and return an id for `get_design`, which is the old async
contract, kept for the cases that would otherwise time out.

**Tests.**

- Unit tests for the id derivation, so the same request and digest always
  give the same id, and anything else differs.
- The Worker and Workflow under `@cloudflare/vitest-pool-workers`, including
  the CPU-limit error path.
- A parity check that a cloud design equals the browser design for the
  fixture genes, since it's the same `.wasm` and the same seed.
- An e2e test that runs a cloud design, closes the page, reopens it and finds
  the result.

**Not in scope.** Checkpointing for titin-scale genes (over 45 kb), and
Containers. Revisit only if someone needs them.

## Cloudflare features worth taking

| Feature               | Why it matters here                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| R2 free egress        | Makes the 330 MB corpus a set of files instead of a database                                                 |
| Access                | Per-person identity, free for this lab's size                                                                |
| Web Analytics         | Free and cookie-free, which suits a tool handling unpublished sequences better than GA4                      |
| Workers static assets | Static requests are unlimited and unbilled                                                                   |
| Workers KV Instant    | Sub-2 ms reads (new, September 2026) if shared state is ever needed                                          |
| D1                    | If the lab later wants shared history rather than per-device                                                 |
| Workers Issues        | Groups Worker errors and posts stack traces to a webhook; complements Sentry, which stays for browser errors |

The **Rate Limiting binding** replaces Upstash for the MCP endpoint.

Not worth taking for this app: Durable Objects and Workflows (the inline job
model leaves no state to hold), Workers AI, Hyperdrive (the database goes
away), Zaraz (GTM goes away).

## Open questions

Verify before committing:

0. ~~How should agents run designs on the free tier?~~ **Resolved: Workers
   Paid,** so they run inline in the MCP Worker. For the record, before that
   decision we researched running designs inside an MCP Apps view instead.
   The spec's CSP forbids WebAssembly there; a wasm2js build worked, giving
   identical designs about 10x slower, but only in hosts that render views.
   It isn't needed now.

1. **Does Cloudflare count Access "users" as provisioned identities or active
   ones?** Decides whether the free tier really covers the lab.
2. **Is OpenNext currently compatible with Next.js 16.4's middleware and cache
   features?** Only matters if step 4 takes the lift-and-shift route.
3. **What is the largest sequence the lab actually designs?** Decides whether
   the fallback is needed at all.
4. **Is anyone relying on sharing a `?job=` link?** Browser designs exist only
   on the device that made them, so that capability goes away in step 1.

## What does not change

The React components, the shadcn/Base UI setup, the feature-module layout, the
zod schemas, the Rust optimizer and its test suite, the corpus build script
and Sentry all carry over untouched.
