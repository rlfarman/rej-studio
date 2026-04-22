#!/usr/bin/env bash
# Generate TypeScript types from the Python FastAPI OpenAPI schema.
#
# How it works:
#   1. Starts a temporary uvicorn server on port 8321
#   2. Fetches /api/py/openapi.json
#   3. Runs openapi-typescript to emit src/lib/api-types.ts
#   4. Kills the server
#
# Prerequisites: venv activated, python deps installed, openapi-typescript
# installed (pnpm add -D openapi-typescript).
#
# Usage: ./scripts/generate-api-types.sh
#        Or: pnpm api:types

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

PORT=8321
OPENAPI_URL="http://127.0.0.1:${PORT}/api/py/openapi.json"
OUTPUT="src/lib/api-types.ts"

# Start the FastAPI server in the background
echo "Starting temporary FastAPI server on port $PORT..."
python3 -m uvicorn python.index:app --port "$PORT" --no-access-log &
SERVER_PID=$!

# Ensure we clean up the server on exit
cleanup() { kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT

# Wait for the server to be ready
for i in $(seq 1 30); do
  if curl -s "$OPENAPI_URL" >/dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: FastAPI server didn't start within 30 seconds."
    exit 1
  fi
  sleep 1
done

echo "Generating types from $OPENAPI_URL → $OUTPUT..."
npx openapi-typescript "$OPENAPI_URL" --output "$OUTPUT"

echo "Done. Types written to $OUTPUT."
echo "Run \`pnpm format\` to clean up the generated file."
