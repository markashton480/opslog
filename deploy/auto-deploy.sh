#!/usr/bin/env bash
# deploy/auto-deploy.sh — Polls main branch and redeploys if new commits detected.
# Intended to run via systemd timer (opslog-deploy.timer).
set -euo pipefail

REPO_DIR="/opt/opslog"
LOCK_FILE="/run/opslog/deploy.lock"
LOG_TAG="opslog-deploy"

log() { logger -t "$LOG_TAG" "$@"; echo "[$(date -Iseconds)] $*"; }

# Prevent concurrent runs using flock
mkdir -p "$(dirname "$LOCK_FILE")"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
    log "Another deploy is running, skipping"
    exit 0
fi
echo $$ >&9

cd "$REPO_DIR"

# Source .env for port configuration
LISTEN_ADDR="${LISTEN_ADDR:-127.0.0.1}"
DASHBOARD_PORT="${DASHBOARD_PORT:-8601}"
if [ -f .env ]; then
    # shellcheck source=/dev/null
    set -a; source .env; set +a
fi
HEALTH_URL="http://${LISTEN_ADDR:-127.0.0.1}:${DASHBOARD_PORT:-8601}/api/v1/health"

# Fetch latest from origin
git fetch origin main --quiet

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    exit 0
fi

log "New commits detected: $LOCAL -> $REMOTE"
log "Pulling latest..."
git pull origin main --ff-only --quiet

log "Building and deploying..."
/usr/bin/docker compose build --quiet 2>&1 | tail -5
/usr/bin/docker compose up -d --remove-orphans 2>&1

log "Waiting for health check..."
sleep 10
if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    log "Deploy successful — now at $(git rev-parse --short HEAD)"
else
    log "WARNING: Health check failed after deploy"
    exit 1
fi
