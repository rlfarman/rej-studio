# Modal Deployment

This directory contains the Modal app that runs gene optimization jobs asynchronously.

## Setup

1. Install the Modal CLI and authenticate:

```bash
pip install modal
modal setup
```

2. Copy the algorithm into this directory (it needs to be bundled with the Modal image):

```bash
cp api/algorithm.py modal/algorithm.py
```

3. Deploy:

```bash
modal deploy modal/app.py
```

After deploying, Modal will print the web endpoint URL. Set this as `MODAL_API_URL` in your `.env.local`:

```
MODAL_API_URL=https://your-username--rej-studio-web.modal.run
```

## Local development

To test locally before deploying:

```bash
modal serve modal/app.py
```

This starts a local dev server with hot reload.
