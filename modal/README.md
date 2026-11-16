# Modal Deployment

This directory contains the Modal app that runs gene optimization jobs asynchronously.

## Setup

1. Install the pinned Modal CLI (plus the runtime lock, which `app.py` imports at deploy time) and authenticate:

```bash
pip install -r python/requirements.txt -r modal/requirements.txt
modal setup
```

The image installs `python/requirements.txt`, a lock compiled from `python/requirements.in` with `pip-compile` on Python 3.11. To change a dependency, edit the `.in` file and regenerate the lock rather than editing it by hand.

2. Deploy (the algorithm is sourced from `python/algorithm.py` automatically):

```bash
modal deploy modal/app.py
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
