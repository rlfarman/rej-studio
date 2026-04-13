# Migration Guide

What changed on the `claude/lucid-hofstadter` branch and what you need to do to adopt it.

## Quick Start

After merging this branch:

```bash
pnpm install                     # new deps: @upstash/redis, @upstash/ratelimit
pnpm db:push                     # apply new DB indexes
```

Then add these to your `.env` (optional but recommended for production):

```env
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=AX...
NEXT_PUBLIC_SITE_URL=https://rejstudio.com
```

Everything works without Redis — it falls back to in-memory state per instance.

---

## 1. Upstash Redis Integration

**What:** All distributed state (rate limiting, idempotency, circuit breaker, dead letter queue, DB latency samples) is now backed by Upstash Redis with automatic in-memory fallback.

**Why:** Single-instance in-memory state doesn't survive Vercel redeploys and isn't shared across auto-scaled instances. Redis gives you consistent rate limits and circuit breaker state across all instances.

**New dependencies:** `@upstash/redis`, `@upstash/ratelimit`

**New files:**

- `src/lib/upstash.ts` — Redis client factory + rate limiter factory with fallback

**Changed files:**

- `src/features/design-tool/api/jobs.ts` — idempotency, circuit breaker, DLQ all Redis-backed
- `src/features/gene-search/api/genes.ts` — search rate limiter uses Upstash
- `src/app/api/health/route.ts` — health rate limiter + latency samples use Redis

**Env vars:**
| Variable | Required | Notes |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | No | Get from [console.upstash.com](https://console.upstash.com) |
| `UPSTASH_REDIS_REST_TOKEN` | No | Free tier: 10k requests/day |

**Fallback behavior:** Every Redis call is wrapped in try/catch. If Redis is not configured, quota-exhausted, or unreachable, the code falls back to per-instance in-memory state. No errors, no downtime — just reduced consistency across instances.

**Redis keys used:**

| Key pattern         | Type      | TTL            | Purpose                                          |
| ------------------- | --------- | -------------- | ------------------------------------------------ |
| `rl:jobs:*`         | Ratelimit | sliding window | Job submission rate limit (10/min/IP)            |
| `rl:search:*`       | Ratelimit | sliding window | Gene search rate limit (30/min/IP)               |
| `rl:health:*`       | Ratelimit | sliding window | Health endpoint rate limit (20/min/IP)           |
| `inflight:<sha256>` | STRING    | 600s           | Idempotency — dedup identical job submissions    |
| `circuit:modal`     | HASH      | 30s            | Circuit breaker state (failures, open, openedAt) |
| `dlq:jobs`          | LIST      | none           | Dead letter queue (capped at 50 entries)         |
| `health:db_latency` | LIST      | none           | Rolling DB latency samples (capped at 100)       |

**To set up Upstash:**

1. Create a free account at [console.upstash.com](https://console.upstash.com)
2. Create a Redis database (any region — pick closest to your Vercel region)
3. Copy the REST URL and token to your `.env`
4. That's it — no schema setup needed, keys are created on first write

---

## 2. CORS Origin Deduplication

**What:** CORS origin validation was duplicated between `src/proxy.ts` and `src/lib/api-cors.ts`. Now both import from a single shared module.

**New file:** `src/lib/allowed-origins.ts`

**Changed files:**

- `src/proxy.ts` — imports `isAllowedOrigin` from shared module
- `src/lib/api-cors.ts` — imports `isAllowedOrigin` from shared module

**Action needed:** If you've customized the CORS allowlist, update it in `src/lib/allowed-origins.ts` (one place now, not two).

---

## 3. Search Error Distinction

**What:** Gene search now distinguishes "no results" from "search is broken" at the type level.

**Changed type:**

```typescript
// Before
async function searchGenes(...): Promise<GeneSearchResult[]>

// After
interface SearchGenesResult {
  results: GeneSearchResult[]
  error?: string  // present when DB query failed
}
async function searchGenes(...): Promise<SearchGenesResult>
```

**Changed files:**

- `src/features/gene-search/api/genes.ts` — returns `SearchGenesResult`
- `src/features/gene-search/hooks/use-gene-search.ts` — consumes `.results` and `.error`
- `src/features/gene-search/components/gene-search.tsx` — updated prop type
- `src/features/gene-search/components/gene-search-results.tsx` — shows error banner on DB failure

**Action needed:** If you consume `searchGenes()` anywhere else, update to read `.results` from the return value.

---

## 4. Isoform Query Caching

**What:** Isoform queries are wrapped with React `cache()` for per-request deduplication.

**Changed file:** `src/features/gene-search/api/isoforms.ts`

**Action needed:** None. If the same isoform query runs twice in one request (e.g., page + OG image), it now only hits the DB once.

---

## 5. Security Hardening

### HSTS Header

`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` added via `next.config.ts` headers.

### Proxy Rename (middleware → proxy)

`src/middleware.ts` renamed to `src/proxy.ts` per Next.js 16 convention. Export changed from `middleware()` to `proxy()`.

### Rate-limited Basic Auth

Auth login attempts are capped at 5/min per IP (inline sliding window in proxy). Prevents brute-force attacks on the basic auth endpoint.

### Request Size Cap

Mutating requests (POST/PUT/PATCH/DELETE) are capped at 256 KB in the proxy. Prevents oversized payloads from reaching server actions.

### Sequence Case Normalization

CDS input is normalized to uppercase at two levels:

- Zod schema `.transform()` in `src/features/design-tool/types/form-schema.ts`
- Server action in `src/features/design-tool/api/jobs.ts`

---

## 6. PWA Manifest & Icons

**New files:**

- `src/app/manifest.ts` — PWA manifest (standalone, start_url `/genes`)
- `src/app/icon.tsx` — dynamically generated favicon (32x32)
- `src/app/apple-icon.tsx` — dynamically generated Apple touch icon (180x180)

---

## 7. Database Indexes

Two new indexes on the `isoforms` table:

- `idx_isoforms_species` on `species`
- `idx_isoforms_cds_length` on `codingSequenceLength`

**Action needed:** Run `pnpm db:push` to apply the indexes to your database.

---

## 8. API Response Consistency

`POST /api/auth` now returns JSON (`{ error: 'Authentication required.' }`) instead of plain text. If you have monitoring that parses auth responses, update the expected format.

---

## 9. Environment Validation

`NEXT_PUBLIC_SITE_URL` is now required in production (validated via Zod superRefine in `src/lib/env.ts`). The app will fail to boot without it in non-development environments.

**Action needed:** Add `NEXT_PUBLIC_SITE_URL=https://rejstudio.com` to your production env vars (Vercel dashboard, Cloudflare dashboard, etc.).

---

## Checklist

- [ ] `pnpm install` (picks up `@upstash/redis`, `@upstash/ratelimit`)
- [ ] `pnpm db:push` (applies new indexes)
- [ ] Add `NEXT_PUBLIC_SITE_URL` to production env vars
- [ ] (Optional) Create Upstash Redis database and add credentials to env
- [ ] (Optional) Set `HEALTH_AUTH_TOKEN` for authenticated health checks
- [ ] Verify: `pnpm verify` passes
- [ ] Deploy and check `/api/health` returns `{ status: "ok" }`
