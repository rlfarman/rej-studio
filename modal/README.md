# Modal Deployment

This directory contains the Modal app that runs gene optimization jobs asynchronously.

## Setup

1. Install the runtime dependencies (which `app.py` imports at deploy time) plus the pinned Modal client from the `deploy` dependency group, then authenticate:

```bash
uv sync --group deploy
uv run modal setup
```

Dependencies live in the repo-root `pyproject.toml` and are pinned in `uv.lock`. The image is built from that same lock with `Image.uv_sync` (runtime dependencies only, on Python 3.14), so production changes only when the lock does. To change a dependency, use `uv add` / `uv lock --upgrade-package <name>` rather than editing `uv.lock` by hand.

2. Deploy (the algorithm is sourced from `python/algorithm.py` automatically). Pin the image builder the same way CI does (`.github/workflows/modal-deploy.yml`): `uv_sync` and Python 3.14 both need builder 2025.06 or newer, and the env var overrides whatever the workspace default is:

```bash
MODAL_IMAGE_BUILDER_VERSION=2026.10 uv run modal deploy modal/app.py
```

After deploying, Modal will print the web endpoint URL. Set this as `MODAL_API_URL` in your `.env.local`:

```
COMPUTE_BACKEND=modal
MODAL_API_URL=https://your-username--rej-studio-web.modal.run
MODAL_API_TOKEN=<the JOB_API_TOKEN from the rej-studio-runtime secret>
```

To switch back to local FastAPI, set `COMPUTE_BACKEND=local` or remove the variable.

## Runtime secret

Both functions mount one Modal secret, `rej-studio-runtime`:

| Key                           | Required | Purpose                                                              |
| ----------------------------- | -------- | -------------------------------------------------------------------- |
| `JOB_API_TOKEN`               | yes      | Shared bearer token the `/jobs` routes require                       |
| `SENTRY_DSN`                  | no       | Error reporting; Sentry is a no-op without it                        |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | no       | Tracing endpoint; OTEL is a no-op without it                         |
| `OTEL_EXPORTER_OTLP_HEADERS`  | no       | Tracing auth headers (`Authorization=Bearer …,X-Axiom-Dataset=…`)    |
| `CORS_ORIGIN`                 | no       | Extra allowed browser origin on top of the built-in production hosts |

The deploy workflow creates/updates it from the `MODAL_JOB_API_TOKEN` and
`MODAL_SENTRY_DSN` GitHub secrets before every deploy. To set it by hand:

```bash
modal secret create rej-studio-runtime JOB_API_TOKEN="$(openssl rand -hex 32)" --force
```

Until the secret exists the `/jobs` routes stay open and log an
`auth.disabled` warning once per container, so a deploy that lands before the
secret does doesn't take production down. The same token must be set as
`MODAL_API_TOKEN` on the Next.js side, which sends it as
`Authorization: Bearer <token>`.

## Endpoints

| Route               | Auth   | Purpose                             |
| ------------------- | ------ | ----------------------------------- |
| `GET /health`       | public | Liveness probe: `{status, git_sha}` |
| `POST /jobs`        | bearer | Submit a job, returns `{call_id}`   |
| `GET /jobs/{id}`    | bearer | Poll status / progress / result     |
| `DELETE /jobs/{id}` | bearer | Cancel a running job                |

FastAPI's docs and OpenAPI schema are disabled — this app is called by the
Next.js server, not browsed.

## Cost controls

`run_job` is capped at 10 containers and `web` at 2, so concurrent spend is
bounded; jobs get no automatic retries because a failure is nearly always
deterministic. There is deliberately no `min_containers`: a cold start costs
a few seconds, while idle capacity would cost money around the clock.

## Local development

To test locally before deploying:

```bash
modal serve modal/app.py
```

This starts a local dev server with hot reload.
