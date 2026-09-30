#!/usr/bin/env bash
set -euo pipefail

export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-parallax}"
export PGDATABASE="${PGDATABASE:-parallax}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"

mkdir -p "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
output="$BACKUP_DIR/parallax-$timestamp.dump"
pg_dump --format=custom --file="$output" --no-owner --no-privileges
if command -v sha256sum >/dev/null 2>&1; then sha256sum "$output" > "$output.sha256"; else shasum -a 256 "$output" > "$output.sha256"; fi
printf 'Created %s\nChecksum: %s\n' "$output" "$output.sha256"
