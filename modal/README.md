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
```

To switch back to local FastAPI, set `COMPUTE_BACKEND=local` or remove the variable.

## Local development

To test locally before deploying:

```bash
modal serve modal/app.py
```

This starts a local dev server with hot reload.
