# Vercel Python runtime entrypoint.
# The canonical FastAPI app lives in python/ — this thin wrapper re-exports it
# so Vercel's /api/ convention can still discover it. On Cloudflare, this file
# is unused (Cloudflare has no Python runtime; compute runs on Modal instead).
from python.index import app

__all__ = ["app"]
