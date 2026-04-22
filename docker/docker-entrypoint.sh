#!/bin/sh
set -e

# ── Required env var guard ──────────────────────────────────────────────────
# Fails fast with a clear message if critical environment variables are missing.
# Add any mandatory vars to the REQUIRED list below.

REQUIRED="DATABASE_URL"

for var in $REQUIRED; do
  eval val=\$$var
  if [ -z "$val" ]; then
    echo "ERROR: Required environment variable $var is not set." >&2
    echo "       Copy .env.example to .env and fill in the values." >&2
    exit 1
  fi
done

exec "$@"
