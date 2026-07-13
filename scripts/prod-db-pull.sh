#!/usr/bin/env bash
#
# Download a PostgreSQL dump from the production Docker Compose database.
#
# Defaults are intentionally conservative: this script creates a local backup
# file only. Pass --restore-local to also load that dump into your local dev DB.
#
# Requirements:
#   - Local: ssh, gzip
#   - Production host: docker compose, running postgres service
#   - Local restore: psql, docker compose, docker-compose, or docker exec
#
# Examples:
#   PROD_SSH_HOST=appsec-prod PROD_APP_DIR=/opt/appsec-catalog ./scripts/prod-db-pull.sh
#   PROD_SSH_HOST=user@example.com ./scripts/prod-db-pull.sh --restore-local
#   PROD_SSH_HOST=user@example.com BACKUP_DIR=/secure/backups ./scripts/prod-db-pull.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$REPO_DIR/backend"
ENV_FILE="${ENV_FILE:-$BACKEND_DIR/.env}"

usage() {
  cat <<'EOF'
Usage: PROD_SSH_HOST=<ssh-host> [options] ./scripts/prod-db-pull.sh

Options:
  --restore-local       Restore the downloaded dump into local development DB.
  --force               Skip the local restore confirmation prompt.
  --help                Show this help.

Environment:
  PROD_SSH_HOST         Required. SSH target for production, e.g. appsec-prod or user@host.
  PROD_APP_DIR          Production repo path. Default: /opt/appsec-catalog
  PROD_PROJECT_NAME     Docker Compose project name. Default: appsec-catalog
  PROD_DB_SERVICE       Compose service name. Default: postgres
  PROD_DB_USER          Postgres user inside production container. Default: appsec
  PROD_DB_NAME          Postgres database inside production container. Default: appsec_catalog
  BACKUP_DIR            Local destination directory. Default: backend/backups
  BACKUP_PREFIX         Local dump filename prefix. Default: appsec-catalog-prod
  LOCAL_DATABASE_URL    Restore target URL. Default: DATABASE_URL from backend/.env
  LOCAL_DB_SERVICE      Local compose service for fallback restore. Default: postgres
  LOCAL_DB_CONTAINER    Local Docker container fallback. Default: appsec-catalog-db
  LOCAL_DB_USER         Local compose fallback Postgres user. Default: appsec
  LOCAL_DB_NAME         Local compose fallback Postgres database. Default: appsec_catalog
EOF
}

RESTORE_LOCAL=0
FORCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --restore-local)
      RESTORE_LOCAL=1
      shift
      ;;
    --force)
      FORCE=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "prod-db-pull: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "${PROD_SSH_HOST:-}" ]]; then
  echo "prod-db-pull: PROD_SSH_HOST is required." >&2
  usage >&2
  exit 2
fi

for bin in ssh gzip; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "prod-db-pull: $bin not found on PATH." >&2
    exit 2
  fi
done

PROD_APP_DIR="${PROD_APP_DIR:-/opt/appsec-catalog}"
PROD_PROJECT_NAME="${PROD_PROJECT_NAME:-appsec-catalog}"
PROD_DB_SERVICE="${PROD_DB_SERVICE:-postgres}"
PROD_DB_USER="${PROD_DB_USER:-appsec}"
PROD_DB_NAME="${PROD_DB_NAME:-appsec_catalog}"

BACKUP_DIR="${BACKUP_DIR:-$BACKEND_DIR/backups}"
BACKUP_PREFIX="${BACKUP_PREFIX:-appsec-catalog-prod}"

mkdir -p "$BACKUP_DIR"

stamp="$(date -u +%Y%m%d-%H%M%S)"
outfile="$BACKUP_DIR/${BACKUP_PREFIX}-${stamp}.sql.gz"

remote_dump_cmd=$(printf \
  'cd %q && docker compose -p %q exec -T %q pg_dump -U %q -d %q --format=plain --clean --if-exists --no-owner --no-privileges' \
  "$PROD_APP_DIR" \
  "$PROD_PROJECT_NAME" \
  "$PROD_DB_SERVICE" \
  "$PROD_DB_USER" \
  "$PROD_DB_NAME")

echo "prod-db-pull: downloading production dump from $PROD_SSH_HOST:$PROD_APP_DIR"
echo "prod-db-pull: writing $outfile"

ssh "$PROD_SSH_HOST" "$remote_dump_cmd" | gzip -c >"$outfile"

echo "prod-db-pull: backup complete ($(du -h "$outfile" | cut -f1))"

if [[ "$RESTORE_LOCAL" -ne 1 ]]; then
  echo "prod-db-pull: restore skipped. Re-run with --restore-local to load this into local dev."
  exit 0
fi

if [[ -z "${LOCAL_DATABASE_URL:-}" ]] && [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  LOCAL_DATABASE_URL="${DATABASE_URL:-}"
fi

if [[ "$FORCE" -ne 1 ]]; then
  echo
  echo "prod-db-pull: about to replace local dev database contents using:"
  if [[ -n "${LOCAL_DATABASE_URL:-}" ]]; then
    echo "  LOCAL_DATABASE_URL=$LOCAL_DATABASE_URL"
  else
    echo "  docker compose service ${LOCAL_DB_SERVICE:-postgres}"
  fi
  read -r -p "Type 'restore local' to continue: " confirm
  if [[ "$confirm" != "restore local" ]]; then
    echo "prod-db-pull: local restore cancelled."
    exit 0
  fi
fi

echo "prod-db-pull: restoring $outfile into local dev database"

if [[ -n "${LOCAL_DATABASE_URL:-}" ]] && command -v psql >/dev/null 2>&1; then
  gunzip -c "$outfile" | psql "$LOCAL_DATABASE_URL"
elif command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  LOCAL_DB_SERVICE="${LOCAL_DB_SERVICE:-postgres}"
  LOCAL_DB_USER="${LOCAL_DB_USER:-appsec}"
  LOCAL_DB_NAME="${LOCAL_DB_NAME:-appsec_catalog}"
  gunzip -c "$outfile" | docker compose -f "$REPO_DIR/docker-compose.yml" exec -T "$LOCAL_DB_SERVICE" \
    psql -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME"
elif command -v docker-compose >/dev/null 2>&1; then
  LOCAL_DB_SERVICE="${LOCAL_DB_SERVICE:-postgres}"
  LOCAL_DB_USER="${LOCAL_DB_USER:-appsec}"
  LOCAL_DB_NAME="${LOCAL_DB_NAME:-appsec_catalog}"
  gunzip -c "$outfile" | docker-compose -f "$REPO_DIR/docker-compose.yml" exec -T "$LOCAL_DB_SERVICE" \
    psql -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME"
elif command -v docker >/dev/null 2>&1; then
  LOCAL_DB_CONTAINER="${LOCAL_DB_CONTAINER:-appsec-catalog-db}"
  LOCAL_DB_USER="${LOCAL_DB_USER:-appsec}"
  LOCAL_DB_NAME="${LOCAL_DB_NAME:-appsec_catalog}"
  gunzip -c "$outfile" | docker exec -i "$LOCAL_DB_CONTAINER" \
    psql -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME"
else
  echo "prod-db-pull: cannot restore. Install psql or start local Docker postgres." >&2
  exit 1
fi

echo "prod-db-pull: local restore complete"
