#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_FILE:?Set BACKUP_FILE to a .dump created by backup_postgres.sh}"
: "${CONFIRM_RESTORE:?Set CONFIRM_RESTORE=YES to restore and overwrite the target database}"
if [[ "$CONFIRM_RESTORE" != "YES" ]]; then
  printf 'Refusing restore: CONFIRM_RESTORE must equal YES.\n' >&2
  exit 2
fi

export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-parallax}"
export PGDATABASE="${PGDATABASE:-parallax}"

if [[ -f "$BACKUP_FILE.sha256" ]]; then
  if command -v sha256sum >/dev/null 2>&1; then sha256sum --check "$BACKUP_FILE.sha256"; else shasum -a 256 --check "$BACKUP_FILE.sha256"; fi
fi
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$PGDATABASE" "$BACKUP_FILE"
printf 'Restored %s into %s@%s:%s/%s\n' "$BACKUP_FILE" "$PGUSER" "$PGHOST" "$PGPORT" "$PGDATABASE"
