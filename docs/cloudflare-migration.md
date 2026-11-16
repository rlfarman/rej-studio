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

## Step 4 — host on Cloudflare

By this point the browser-facing app is static, and the only server left is
the MCP endpoint. Two routes for the app itself:

- **Static export.** Fewest moving parts. The remaining dynamic pieces (OG
  images, `/api/health`, `/api/version`) become pre-generated files or one
  Worker.
- **TanStack Start.** The framework migration from the earlier plan. Start is
  Vite-based and first-class on Cloudflare, and the app is a single-page tool
  rather than a content site, so little of Next's server rendering is being
  used by then anyway.

### Why hosting moves last

**Next.js does not run natively on Cloudflare**; it runs through the OpenNext
adapter. That adapter is in real production use, but it still describes itself
as pre-1.0, it does not support the edge runtime, and this app leans on
middleware (`src/proxy.ts`), `cacheComponents` and partial prerendering —
exactly the features most likely to have rough edges.

Moving hosting last means that by the time the question arises, the middleware
is gone (step 3), the server rendering has little left to do (step 2), and the
adapter can be skipped entirely.

If being on Cloudflare sooner matters more than that, the alternative is a
lift-and-shift through OpenNext now, accepting the risk and re-testing after
each later step.

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

**The one real design question** is the job model. Today `submit_design`
returns a job id and the agent polls `get_design`, because a design on Modal
took minutes. The Rust optimizer takes seconds, so there are two options:

- **Run it inline** and have `submit_design` return the finished design. Far
  simpler — no job state, no polling, no storage — but it changes the tool
  contract and risks an MCP client timing out on a very large gene.
- **Keep the asynchronous model**, which needs somewhere to hold job state: a
  Durable Object per job, or Workflows.

A reasonable middle: run inline when the sequence is small enough to finish
quickly, and fall back to the asynchronous path beyond that. Decide this
before porting, because it determines whether any state store is needed at
all.

**Sequencing:** the MCP endpoint depends on the optimizer and on gene
lookups, so port it after steps 1 and 2, alongside step 4. Until then it
keeps working as it does today.

## The big-gene fallback

If some genes really are too slow in the browser, the same Rust crate can run
on a Cloudflare Worker — no second implementation, no Modal, no containers.

Workers Paid allows **5 minutes of CPU per request** (the default is 30
seconds and must be raised in Wrangler config), and WebAssembly counts toward
that budget. A 5,592 bp gene takes 3.8 s, so a 15 kb gene near 30 s fits
comfortably. Memory is capped at 128 MB, which the optimizer stays well under.

Offer it only for sequences past some threshold, so the common case stays
local and private.

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

Relevant only if agent access keeps its asynchronous job model: **Durable
Objects** or **Workflows** to hold a design's state between `submit_design`
and `get_design`, and the **Rate Limiting binding** to replace Upstash.

Not worth taking for this app: Workers AI, Hyperdrive (the database goes
away), Zaraz (GTM goes away).

## Open questions

Verify before committing:

1. **Does Cloudflare count Access "users" as provisioned identities or active
   ones?** Decides whether the free tier really covers the lab.
2. **Is OpenNext currently compatible with Next.js 16.4's middleware and cache
   features?** Only matters if step 4 takes the lift-and-shift route.
3. **What is the largest sequence the lab actually designs?** Decides whether
   the fallback is needed at all.
4. **Should `submit_design` return the design inline, or keep the job id and
   polling?** Decides whether the MCP Worker needs any state store.
5. **Is anyone relying on sharing a `?job=` link?** Browser designs exist only
   on the device that made them, so that capability goes away in step 1.

## What does not change

The React components, the shadcn/Base UI setup, the feature-module layout, the
zod schemas, the Rust optimizer and its test suite, the corpus build script
and Sentry all carry over untouched.
