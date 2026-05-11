#!/usr/bin/env bash
#
# Full PostgreSQL logical backup for appsec-catalog (Prisma / DATABASE_URL).
#
# Requirements: pg_dump (postgresql-client / postgresql on PATH), gzip.
#
# Usage:
#   ./db-backup.sh
#   BACKUP_DIR=/var/backups/appsec-catalog ./db-backup.sh
#   DATABASE_URL='postgresql://...' ./db-backup.sh
#
# Cron (hourly, load .env from repo backend dir):
#   0 * * * * cd /path/to/appsec-catalog/backend && ./scripts/db-backup.sh >> /var/log/appsec-db-backup.log 2>&1
#
# Restore (example — replace connection string and backup file):
#   gunzip -c /path/to/appsec-catalog-db-20260428-120000.sql.gz | psql "$DATABASE_URL"
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$BACKEND_DIR/.env}"

if [[ -z "${DATABASE_URL:-}" ]] && [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "db-backup: DATABASE_URL is not set and $ENV_FILE not found or empty." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "db-backup: pg_dump not found. Install PostgreSQL client tools (e.g. postgresql-client)." >&2
  exit 1
fi

if ! command -v gzip >/dev/null 2>&1; then
  echo "db-backup: gzip not found." >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-$BACKEND_DIR/backups}"
BACKUP_PREFIX="${BACKUP_PREFIX:-appsec-catalog-db}"
# Keep this many newest dumps; set to 0 to disable rotation.
BACKUP_KEEP="${BACKUP_KEEP:-48}"

mkdir -p "$BACKUP_DIR"

stamp="$(date -u +%Y%m%d-%H%M%S)"
outfile="$BACKUP_DIR/${BACKUP_PREFIX}-${stamp}.sql.gz"

echo "db-backup: writing $outfile"

# Plain SQL, compressed — easy to inspect and restore with psql.
pg_dump \
  --dbname="$DATABASE_URL" \
  --format=plain \
  --verbose \
  | gzip -c >"$outfile"

echo "db-backup: done ($(du -h "$outfile" | cut -f1))"

if [[ "$BACKUP_KEEP" =~ ^[0-9]+$ ]] && [[ "$BACKUP_KEEP" -gt 0 ]]; then
  shopt -s nullglob
  paths=("$BACKUP_DIR/${BACKUP_PREFIX}"-*.sql.gz)
  shopt -u nullglob
  if [[ ${#paths[@]} -gt "$BACKUP_KEEP" ]]; then
    ls -1t "${paths[@]}" | tail -n +"$((BACKUP_KEEP + 1))" | while read -r old; do
      echo "db-backup: removing old backup $old"
      rm -f "$old"
    done
  fi
fi
