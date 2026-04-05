#!/usr/bin/env bash
# Import the local SQLite seed database into Turso.
#
# Prerequisites:
#   - `data/rej-studio.db` exists (run `pnpm db:build` to generate it).
#   - `turso` CLI installed and authenticated (`turso auth login`).
#   - $TURSO_DB_NAME is the Turso database name (not the full libsql URL).
#
# Usage:
#   TURSO_DB_NAME=rej-studio ./scripts/upload-to-turso.sh
#
# WARNING: This destroys and recreates the database. All existing data is replaced.

set -euo pipefail

SEED_DB="${SEED_DB:-data/rej-studio.db}"
DB_NAME="${TURSO_DB_NAME:-}"
GROUP="${TURSO_GROUP:-default}"

if [[ -z "$DB_NAME" ]]; then
  echo "ERROR: set TURSO_DB_NAME to your Turso database name" >&2
  exit 1
fi

if [[ ! -f "$SEED_DB" ]]; then
  echo "ERROR: $SEED_DB not found. Run \`pnpm db:build\` first." >&2
  exit 1
fi

if ! command -v turso >/dev/null 2>&1; then
  echo "ERROR: turso CLI not found. Install: https://docs.turso.tech/cli/install" >&2
  exit 1
fi

# turso db import names the database after the filename stem, so stage the file
# under the correct name in a temp dir if needed.
STAGE_DIR=$(mktemp -d)
trap 'rm -rf "$STAGE_DIR"' EXIT
STAGE_FILE="$STAGE_DIR/${DB_NAME}.db"
cp "$SEED_DB" "$STAGE_FILE"

echo "Destroying existing database '$DB_NAME' (if it exists)..."
turso db destroy "$DB_NAME" --yes 2>/dev/null || true

echo "Importing $SEED_DB into Turso as '$DB_NAME' (group: $GROUP)..."
turso db import "$STAGE_FILE" --group "$GROUP"

echo "Verifying row counts..."
turso db shell "$DB_NAME" "SELECT 'genes', COUNT(*) FROM genes; SELECT 'isoforms', COUNT(*) FROM isoforms;"
echo "Done."
