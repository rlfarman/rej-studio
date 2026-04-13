# Observability

## Sentry (Error Tracking)

Set `NEXT_PUBLIC_SENTRY_DSN` to enable Sentry on both client and server.

**Next.js** — `@sentry/nextjs` is configured via:

- `src/sentry.client.config.ts` — browser-side init (replay, 10% traces)
- `src/sentry.server.config.ts` — Node.js server-side init
- `src/sentry.edge.config.ts` — Edge runtime init
- `src/instrumentation.ts` — wires the server/edge configs at boot
- `next.config.ts` — wraps the config with `withSentryConfig` for source-map uploads

**Modal (Python)** — Set `SENTRY_DSN` as a Modal secret. The `sentry-sdk` is installed in the Modal image and initialised at module load in `modal/app.py`.

Build-time env vars for source-map uploads:

- `SENTRY_ORG` — Sentry organisation slug
- `SENTRY_PROJECT` — Sentry project slug
- `SENTRY_AUTH_TOKEN` — API token with `project:releases` scope

## Axiom (Logs & Traces via OpenTelemetry)

The OTel integration in `src/instrumentation.ts` ships traces to any OTLP-compatible collector using the vendor-neutral OpenTelemetry SDK (`@opentelemetry/sdk-node` + `@opentelemetry/exporter-trace-otlp-http`). No Vercel-specific dependencies.

For Axiom:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.axiom.co
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer <API_TOKEN>,X-Axiom-Dataset=<DATASET>"
```

For Grafana Cloud:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-<region>.grafana.net/otlp
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic <base64>"
```

The SDK auto-instruments `fetch`, `http`, and other Node.js builtins. Next.js adds its own spans for routes, server actions, and data fetches on top.

### Modal → Axiom log shipping

Modal logs are available via `modal logs` CLI and the Modal dashboard. To ship them to Axiom:

1. Use Modal's webhook log drain (when available), or
2. Run a `modal.Cron` that calls `modal logs --json` and forwards to Axiom's ingest API, or
3. Capture structured JSON logs from the worker (already emitted by `_log()` in `modal/app.py`) and parse them in the Modal dashboard.

The structured `_log()` function already emits JSON with `ts`, `event`, `call_id`, `stage_timings_s`, etc. — these are directly parseable by any log aggregator.

## OpenStatus (Uptime + Status Page)

Uptime monitoring and the public status page are hosted on [OpenStatus](https://openstatus.dev).

### Setup

1. Sign up at [openstatus.dev](https://openstatus.dev), create a workspace and a public status page.
2. Create three HTTP monitors:
   - **Production health** — `https://<domain>/api/health`, expect `200`. Add `Authorization: Bearer <HEALTH_AUTH_TOKEN>` if health auth is configured.
   - **Homepage** — `https://<domain>/`, expect `200`.
   - **Modal backend** — the `MODAL_API_URL` health/ping endpoint, expect `200`.
3. Attach each monitor to the status page as a component (e.g. "App", "Homepage", "Compute").
4. Configure notifications (Slack/Discord/email/PagerDuty) per monitor.
5. Set env vars:
   - `NEXT_PUBLIC_OPENSTATUS_SLUG` — public page slug, powers the footer `StatusWidget`.
   - `OPENSTATUS_API_KEY` — workspace API key, powers the server-side SDK (`src/lib/openstatus.ts`) for programmatic monitor/incident access.

### Footer widget

`src/app/_components/layout/footer.tsx` renders `@openstatus/react`'s `StatusWidget` (a React Server Component) when `NEXT_PUBLIC_OPENSTATUS_SLUG` is set. It fetches status on each render via OpenStatus's public API — no API key required for display.

### SDK

`src/lib/openstatus.ts` exposes `getOpenStatusClient()` which returns a configured `@openstatus/sdk-node` client (or `null` when `OPENSTATUS_API_KEY` is unset). Use it from server actions to list/create monitors, report incidents, or query summaries programmatically.

## Health Endpoint Auth

When `HEALTH_AUTH_TOKEN` is set, the `/api/health` endpoint requires `Authorization: Bearer <token>` to return full check details (DB latency, Modal status). Unauthenticated requests still receive `200`/`503` with a minimal `{ status: "ok" | "degraded" }` body — enough for load-balancer probes without leaking internal details.
