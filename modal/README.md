# Modal Deployment

This directory contains the Modal app that runs gene optimization jobs asynchronously.

## Setup

1. Install the Modal CLI and authenticate:

```bash
pip install modal
modal setup
```

2. Deploy (the algorithm is sourced from `api/algorithm.py` automatically):

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
