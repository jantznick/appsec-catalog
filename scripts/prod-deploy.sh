#!/bin/sh
set -eu

TARGET="${1:-both}" # frontend | backend | both

case "$TARGET" in
  frontend|backend|both) ;;
  *)
    echo "Usage: $0 [frontend|backend|both]" >&2
    exit 2
    ;;
esac

PROJECT_NAME="${COMPOSE_PROJECT_NAME:-appsec-catalog}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required" >&2
  exit 2
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose (plugin) is required" >&2
  exit 2
fi

echo "[deploy] target=$TARGET"

if command -v git >/dev/null 2>&1; then
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    BEFORE="$(git rev-parse HEAD 2>/dev/null || true)"
    BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
    echo "[deploy] git fetch"
    git fetch --prune || true

    # Prefer fast-forward only to avoid accidental merges.
    if [ -n "${BRANCH:-}" ] && [ "$BRANCH" != "HEAD" ]; then
      echo "[deploy] git pull --ff-only"
      git pull --ff-only || true
    fi

    AFTER="$(git rev-parse HEAD 2>/dev/null || true)"
    if [ -n "${BEFORE:-}" ] && [ -n "${AFTER:-}" ] && [ "$BEFORE" = "$AFTER" ]; then
      echo "[deploy] no git changes detected (HEAD unchanged); skipping docker build/up"
      exit 0
    fi
    echo "[deploy] git updated: ${BEFORE:-unknown} -> ${AFTER:-unknown}"
  else
    echo "[deploy] git not a repo in current directory; skipping git fetch/pull"
  fi
else
  echo "[deploy] git not installed; skipping git fetch/pull"
fi

SERVICES=""
if [ "$TARGET" = "frontend" ]; then
  SERVICES="frontend"
elif [ "$TARGET" = "backend" ]; then
  SERVICES="backend"
else
  SERVICES="frontend backend"
fi

# If backend is part of this deploy, run DB migrations safely before restarting it.
# We run migrations in a one-off backend container with an overridden entrypoint, so we don't
# accidentally start the web server while migrating. We also use --no-deps to avoid touching
# postgres lifecycle; postgres must already be running.
if [ "$TARGET" = "backend" ] || [ "$TARGET" = "both" ]; then
  echo "[deploy] building backend image (for migrations)"
  docker compose -p "$PROJECT_NAME" build backend

  echo "[deploy] running prisma migrate deploy"
  docker compose -p "$PROJECT_NAME" run --rm --no-deps --entrypoint sh backend -lc "npx prisma migrate deploy"
fi

echo "[deploy] docker compose -p $PROJECT_NAME up -d --build $SERVICES"
docker compose -p "$PROJECT_NAME" up -d --build $SERVICES

# Optional: reclaim disk space (volume-safe; never prunes volumes).
# Enable by setting: DOCKER_PRUNE=true
# Optionally: DOCKER_PRUNE_UNTIL=168h (default)
if [ "${DOCKER_PRUNE:-false}" = "true" ]; then
  UNTIL="${DOCKER_PRUNE_UNTIL:-168h}"
  echo "[deploy] pruning docker resources older than $UNTIL (no volumes)"
  # Build cache (usually biggest win, and safest).
  docker builder prune -f --filter "until=$UNTIL" || true
  # Dangling/unused images older than UNTIL.
  docker image prune -f --filter "until=$UNTIL" || true
  # Stopped containers older than UNTIL.
  docker container prune -f --filter "until=$UNTIL" || true
fi

# Optional: record deployments via token (dogfooding).
# Set:
# - APPSEC_CATALOG_API_URL (e.g. https://catalog.example.com/api/deployment-tokens)
# - APPSEC_CATALOG_DEPLOYMENT_TOKEN
# - APPSEC_CATALOG_DEPLOY_ENV (e.g. prod)
# - APPSEC_CATALOG_FRONTEND_APP_ID / APPSEC_CATALOG_BACKEND_APP_ID
# - APPSEC_CATALOG_DEPLOY_VERSION (optional)
post_deploy() {
  APP_ID="$1"
  COMPONENT="$2"

  if [ -z "${APPSEC_CATALOG_API_URL:-}" ] || [ -z "${APPSEC_CATALOG_DEPLOYMENT_TOKEN:-}" ] || [ -z "${APPSEC_CATALOG_DEPLOY_ENV:-}" ]; then
    return 0
  fi
  if [ -z "$APP_ID" ]; then
    return 0
  fi

  TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  VERSION="${APPSEC_CATALOG_DEPLOY_VERSION:-$TS}"

  BODY="$(cat <<EOF
{
  "token": "${APPSEC_CATALOG_DEPLOYMENT_TOKEN}",
  "applicationId": "${APP_ID}",
  "deployedAt": "${TS}",
  "environment": "${APPSEC_CATALOG_DEPLOY_ENV}",
  "version": "${VERSION}",
  "gitBranch": "${APPSEC_CATALOG_DEPLOY_GIT_BRANCH:-}",
  "deployedBy": "AppSec Catalog settings deploy",
  "notes": "Automated deploy: ${COMPONENT}"
}
EOF
)"

  echo "[deploy] recording deployment for ${COMPONENT} appId=${APP_ID}"
  # Use wget for maximum compatibility in minimal images.
  wget -qO- \
    --method=POST \
    --header="Content-Type: application/json" \
    --body-data="$BODY" \
    "${APPSEC_CATALOG_API_URL}" >/dev/null || true
}

if [ "$TARGET" = "frontend" ] || [ "$TARGET" = "both" ]; then
  post_deploy "${APPSEC_CATALOG_FRONTEND_APP_ID:-}" "frontend"
fi
if [ "$TARGET" = "backend" ] || [ "$TARGET" = "both" ]; then
  post_deploy "${APPSEC_CATALOG_BACKEND_APP_ID:-}" "backend"
fi

echo "[deploy] done"

